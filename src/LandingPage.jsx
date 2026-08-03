import React, { useEffect, useMemo, useRef, useState } from "react";
import { Shield, Star, Trophy, TrendingUp, Users, ArrowRight, Menu, X, Zap } from "lucide-react";
import initialPlayers from "./data/players.json";

const groupLink = "https://wa.me/5511999999999?text=Quero%20participar%20do%20Fut%20de%20Terca";
const STORAGE_KEY = "fut-terca-players";
const TEAM_PAIR_HISTORY_KEY = "fut-terca-team-pair-history";
const SHEETS_API_URL = (import.meta.env.VITE_SHEETS_API_URL || "").trim();
const DEFAULT_PLAYER_ROLE = "linha";
const DEFAULT_PLAYER_SPEED = 5;
const DEFAULT_PLAYER_FINISHING = 5;
const DEFAULT_PLAYER_DEFENSE = 5;
const DEFAULT_PLAYER_PASSING = 5;
const DEFAULT_PLAYER_LINE_POSITION = "meio";
const TEAM_SIZE = 4;
const PAIR_HISTORY_DECAY = 0.95;
const PAIR_HISTORY_INCREMENT = 2;
const PAIR_REPEAT_WEIGHT = 8;
const POSITION_PRIORITY_WEIGHT = 0.1;
const RATING_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const LINE_POSITION_OPTIONS = [
  { value: "defesa", label: "Defesa" },
  { value: "meio", label: "Meio" },
  { value: "ataque", label: "Ataque" },
];

function sanitizeRating(value, fallback = 5) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.min(10, parsed));
}

function sanitizeRole(role) {
  return role === "goleiro" ? "goleiro" : DEFAULT_PLAYER_ROLE;
}

function sanitizeLinePosition(position) {
  return LINE_POSITION_OPTIONS.some((option) => option.value === position) ? position : DEFAULT_PLAYER_LINE_POSITION;
}

function normalizePlayerName(name) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function sanitizePlayers(players) {
  if (!Array.isArray(players)) {
    return [];
  }

  const sanitized = players
    .filter((player) => player && typeof player.name === "string")
    .map((player, index) => {
      const legacyAttack = sanitizeRating(player.attack ?? player.weight, DEFAULT_PLAYER_FINISHING);
      const legacyDefense = sanitizeRating(player.defense ?? player.weight, DEFAULT_PLAYER_DEFENSE);

      return {
        id: Number.isFinite(player.id) ? player.id : index + 1,
        name: player.name,
        goals: Number.isFinite(player.goals) ? player.goals : 0,
        assists: Number.isFinite(player.assists) ? player.assists : 0,
        championships: Number.isFinite(player.championships) ? player.championships : 0,
        speed: sanitizeRating(player.speed ?? legacyAttack, DEFAULT_PLAYER_SPEED),
        finishing: sanitizeRating(player.finishing ?? legacyAttack, DEFAULT_PLAYER_FINISHING),
        defense: sanitizeRating(player.defense ?? legacyDefense, DEFAULT_PLAYER_DEFENSE),
        passing: sanitizeRating(player.passing ?? (legacyAttack + legacyDefense) / 2, DEFAULT_PLAYER_PASSING),
        linePosition: sanitizeLinePosition(player.linePosition ?? player.position),
        role: sanitizeRole(player.role),
      };
    });

  const mergedByName = new Map();

  sanitized.forEach((player) => {
    const key = normalizePlayerName(player.name);
    const existing = mergedByName.get(key);

    if (!existing) {
      mergedByName.set(key, { ...player });
      return;
    }

    existing.goals += player.goals;
    existing.assists += player.assists;
    existing.championships += player.championships;
    existing.speed = Math.max(existing.speed, player.speed);
    existing.finishing = Math.max(existing.finishing, player.finishing);
    existing.defense = Math.max(existing.defense, player.defense);
    existing.passing = Math.max(existing.passing, player.passing);
    existing.role = existing.role === "goleiro" || player.role === "goleiro" ? "goleiro" : DEFAULT_PLAYER_ROLE;
    if (existing.role !== "goleiro") {
      existing.linePosition = sanitizeLinePosition(player.linePosition);
    }
  });

  const usedIds = new Set();
  let nextGeneratedId = 1;

  return Array.from(mergedByName.values()).map((player) => {
    let safeId = Number.isFinite(player.id) ? player.id : 0;

    if (!safeId || usedIds.has(safeId)) {
      while (usedIds.has(nextGeneratedId)) {
        nextGeneratedId += 1;
      }
      safeId = nextGeneratedId;
      nextGeneratedId += 1;
    }

    usedIds.add(safeId);
    return {
      ...player,
      id: safeId,
    };
  });
}

function loadInitialPlayers() {
  if (typeof window === "undefined") {
    return sanitizePlayers(initialPlayers);
  }

  if (SHEETS_API_URL) {
    // When remote sync is enabled, avoid preferring stale local cache at boot.
    return sanitizePlayers(initialPlayers);
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const sanitized = sanitizePlayers(parsed);
      if (sanitized.length) {
        return sanitized;
      }
    }
  } catch {
    // Fallback to seed data when localStorage is unavailable or invalid.
  }

  return sanitizePlayers(initialPlayers);
}

function playersChanged(currentPlayers, incomingPlayers) {
  return JSON.stringify(currentPlayers) !== JSON.stringify(incomingPlayers);
}

function loadTeamPairHistory() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const stored = window.localStorage.getItem(TEAM_PAIR_HISTORY_KEY);
    if (!stored) {
      return {};
    }

    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return Object.entries(parsed).reduce((acc, [key, value]) => {
      const count = Number(value);
      if (!Number.isNaN(count) && count > 0) {
        acc[key] = count;
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
}

function createPairKey(playerIdA, playerIdB) {
  return playerIdA < playerIdB ? `${playerIdA}-${playerIdB}` : `${playerIdB}-${playerIdA}`;
}

function getPairRepeatCount(teamPlayers, incomingPlayer, pairHistory) {
  return teamPlayers.reduce((acc, teamPlayer) => {
    const pairKey = createPairKey(teamPlayer.id, incomingPlayer.id);
    return acc + (pairHistory[pairKey] || 0);
  }, 0);
}

function computeTeamRepeatPenalty(teamPlayers, pairHistory) {
  let penalty = 0;

  for (let i = 0; i < teamPlayers.length; i += 1) {
    for (let j = i + 1; j < teamPlayers.length; j += 1) {
      const pairKey = createPairKey(teamPlayers[i].id, teamPlayers[j].id);
      penalty += pairHistory[pairKey] || 0;
    }
  }

  return penalty;
}

function updatePairHistoryWithTeams(currentHistory, teams) {
  const nextHistory = Object.fromEntries(
    Object.entries(currentHistory)
      .map(([key, value]) => [key, value * PAIR_HISTORY_DECAY])
      .filter(([, value]) => value >= 0.05)
  );

  teams.forEach((team) => {
    for (let i = 0; i < team.players.length; i += 1) {
      for (let j = i + 1; j < team.players.length; j += 1) {
        const pairKey = createPairKey(team.players[i].id, team.players[j].id);
        nextHistory[pairKey] = (nextHistory[pairKey] || 0) + PAIR_HISTORY_INCREMENT;
      }
    }
  });

  return nextHistory;
}

function getOverallWeights(player) {
  // OVR uses finishing for attacking quality.
  if (sanitizeRole(player.role) === "goleiro") {
    // Goalkeeper: defense (reflexes/positioning) + speed dominant
    return { speed: 0.24, finishing: 0.10, defense: 0.52, passing: 0.14 };
  }

  const linePosition = sanitizeLinePosition(player.linePosition);

  if (linePosition === "ataque") {
    // Striker: finishing + speed dominant; passing as secondary value
    return { speed: 0.30, finishing: 0.55, defense: 0.00, passing: 0.15 };
  }

  if (linePosition === "defesa") {
    // Defender: defense + speed dominant
    return { speed: 0.32, finishing: 0.07, defense: 0.48, passing: 0.13 };
  }

  // Midfielder: passing + speed dominant; finishing adds secondary value
  return { speed: 0.30, finishing: 0.26, defense: 0.06, passing: 0.38 };
}

function getHiddenLevelScore(player) {
  const speed = sanitizeRating(player.speed, DEFAULT_PLAYER_SPEED);
  const finishing = sanitizeRating(player.finishing, DEFAULT_PLAYER_FINISHING);
  const defense = sanitizeRating(player.defense, DEFAULT_PLAYER_DEFENSE);
  const passing = sanitizeRating(player.passing, DEFAULT_PLAYER_PASSING);
  const weights = getOverallWeights(player);

  return (
    (speed * weights.speed)
    + (finishing * weights.finishing)
    + (defense * weights.defense)
    + (passing * weights.passing)
  );
}

function displayOVR(player) {
  return Math.min(99, Math.round(getHiddenLevelScore(player) * 10));
}

function displayStat(value, fallback = 5) {
  return Math.min(99, Math.round(sanitizeRating(value, fallback) * 10));
}

function getCardTier(player) {
  const ovr = displayOVR(player);
  if (ovr >= 75) return "gold";
  if (ovr >= 51) return "silver";
  return "bronze";
}

function isGoalkeeper(player) {
  return sanitizeRole(player.role) === "goleiro";
}

function getTeamLineCount(team) {
  return team.players.filter((player) => !isGoalkeeper(player)).length;
}

function buildBalancedTeams(players, teamsCount, randomSeed, pairHistory = {}) {
  if (!teamsCount) {
    return [];
  }

  const randomSalt = Number.isFinite(randomSeed) ? randomSeed : Date.now();
  const seededRandom = (id) => {
    const base = Math.sin((id + 1) * 97 + randomSalt * 0.001) * 10000;
    return base - Math.floor(base);
  };

  const playersForTeams = players.slice(0, teamsCount * TEAM_SIZE);
  const targetAverage = playersForTeams.reduce((sum, player) => sum + getHiddenLevelScore(player), 0) / teamsCount;

  const teams = Array.from({ length: teamsCount }, (_, index) => ({
    id: index + 1,
    name: `Time ${index + 1}`,
    players: [],
    totalAverage: 0,
  }));

  // Sort players by OVR descending with seeded tiebreak for variety
  const sorted = [...playersForTeams].sort((a, b) => {
    const diff = getHiddenLevelScore(b) - getHiddenLevelScore(a);
    return diff !== 0 ? diff : seededRandom(a.id) - seededRandom(b.id);
  });

  for (const player of sorted) {
    const playerScore = getHiddenLevelScore(player);
    let bestTeamIndex = 0;
    let bestTeamScore = Infinity;

    for (let teamIndex = 0; teamIndex < teams.length; teamIndex += 1) {
      const team = teams[teamIndex];
      if (team.players.length >= TEAM_SIZE) {
        continue;
      }

      const projectedAverage = team.totalAverage + playerScore;
      const repeatPenalty = getPairRepeatCount(team.players, player, pairHistory) * PAIR_REPEAT_WEIGHT;
      const balancePenalty = Math.abs(projectedAverage - targetAverage);
      const tieBreaker = seededRandom(team.id + player.id) * 0.001;
      const placementScore = balancePenalty + repeatPenalty + tieBreaker;

      if (placementScore < bestTeamScore) {
        bestTeamScore = placementScore;
        bestTeamIndex = teamIndex;
      }
    }

    teams[bestTeamIndex].players.push(player);
    teams[bestTeamIndex].totalAverage += playerScore;
  }

  // Compute sum of squared deviations from mean (variance proxy) — lower is better
  function computeVariance() {
    const mean = teams.reduce((s, t) => s + t.totalAverage, 0) / teams.length;
    return teams.reduce((s, t) => s + (t.totalAverage - mean) ** 2, 0);
  }

  // Ideal: 1 defesa, 2 meio, 1 ataque per team of 4 — lower score is better
  function computePositionImbalance() {
    return teams.reduce((total, team) => {
      const counts = { defesa: 0, meio: 0, ataque: 0 };
      team.players.forEach((p) => {
        counts[sanitizeLinePosition(p.linePosition)] += 1;
      });
      return total + Math.abs(counts.defesa - 1) + Math.abs(counts.meio - 2) + Math.abs(counts.ataque - 1);
    }, 0);
  }

  // Phase 1 — OVR variance optimization while keeping repeated pairs in check
  let improved = true;
  while (improved) {
    improved = false;
    for (let t1 = 0; t1 < teams.length && !improved; t1 += 1) {
      for (let t2 = t1 + 1; t2 < teams.length && !improved; t2 += 1) {
        for (let i = 0; i < teams[t1].players.length && !improved; i += 1) {
          for (let j = 0; j < teams[t2].players.length && !improved; j += 1) {
            const p1 = teams[t1].players[i];
            const p2 = teams[t2].players[j];
            const s1 = getHiddenLevelScore(p1);
            const s2 = getHiddenLevelScore(p2);

            const prevVariance = computeVariance();
            const prevRepeats = computeTeamRepeatPenalty(teams[t1].players, pairHistory) + computeTeamRepeatPenalty(teams[t2].players, pairHistory);

            teams[t1].players[i] = p2;
            teams[t2].players[j] = p1;
            teams[t1].totalAverage += s2 - s1;
            teams[t2].totalAverage += s1 - s2;

            const newVariance = computeVariance();
            const newRepeats = computeTeamRepeatPenalty(teams[t1].players, pairHistory) + computeTeamRepeatPenalty(teams[t2].players, pairHistory);
            const prevScore = prevVariance + prevRepeats * 0.75;
            const newScore = newVariance + newRepeats * 0.75;

            if (newScore < prevScore - 0.0001) {
              improved = true;
            } else {
              teams[t1].players[i] = p1;
              teams[t2].players[j] = p2;
              teams[t1].totalAverage += s1 - s2;
              teams[t2].totalAverage += s2 - s1;
            }
          }
        }
      }
    }
  }

  // Phase 2 — Keep overall balance as the main goal; positions are secondary
  let posImproved = true;
  while (posImproved) {
    posImproved = false;
    for (let t1 = 0; t1 < teams.length && !posImproved; t1 += 1) {
      for (let t2 = t1 + 1; t2 < teams.length && !posImproved; t2 += 1) {
        for (let i = 0; i < teams[t1].players.length && !posImproved; i += 1) {
          for (let j = 0; j < teams[t2].players.length && !posImproved; j += 1) {
            const p1 = teams[t1].players[i];
            const p2 = teams[t2].players[j];
            const s1 = getHiddenLevelScore(p1);
            const s2 = getHiddenLevelScore(p2);

            const prevVariance = computeVariance();
            const prevPos = computePositionImbalance();
            const prevRepeats = computeTeamRepeatPenalty(teams[t1].players, pairHistory) + computeTeamRepeatPenalty(teams[t2].players, pairHistory);

            teams[t1].players[i] = p2;
            teams[t2].players[j] = p1;
            teams[t1].totalAverage += s2 - s1;
            teams[t2].totalAverage += s1 - s2;

            const newVariance = computeVariance();
            const newPos = computePositionImbalance();
            const newRepeats = computeTeamRepeatPenalty(teams[t1].players, pairHistory) + computeTeamRepeatPenalty(teams[t2].players, pairHistory);
            const prevScore = (prevVariance * 5) + prevRepeats + (prevPos * POSITION_PRIORITY_WEIGHT);
            const newScore = (newVariance * 5) + newRepeats + (newPos * POSITION_PRIORITY_WEIGHT);

            if (newScore < prevScore - 0.0001) {
              posImproved = true;
            } else {
              teams[t1].players[i] = p1;
              teams[t2].players[j] = p2;
              teams[t1].totalAverage += s1 - s2;
              teams[t2].totalAverage += s2 - s1;
            }
          }
        }
      }
    }
  }

  // Phase 3 — Pair history: still keep overall balance above position perfection
  const tolerance = 0.0001;
  let pairImproved = true;
  while (pairImproved) {
    pairImproved = false;
    for (let t1 = 0; t1 < teams.length && !pairImproved; t1 += 1) {
      for (let t2 = t1 + 1; t2 < teams.length && !pairImproved; t2 += 1) {
        for (let i = 0; i < teams[t1].players.length && !pairImproved; i += 1) {
          for (let j = 0; j < teams[t2].players.length && !pairImproved; j += 1) {
            const p1 = teams[t1].players[i];
            const p2 = teams[t2].players[j];
            const s1 = getHiddenLevelScore(p1);
            const s2 = getHiddenLevelScore(p2);

            const prevVariance = computeVariance();
            const prevPos = computePositionImbalance();
            const prevRepeats = computeTeamRepeatPenalty(teams[t1].players, pairHistory) + computeTeamRepeatPenalty(teams[t2].players, pairHistory);

            teams[t1].players[i] = p2;
            teams[t2].players[j] = p1;
            teams[t1].totalAverage += s2 - s1;
            teams[t2].totalAverage += s1 - s2;

            const newVariance = computeVariance();
            const newPos = computePositionImbalance();
            const newRepeats = computeTeamRepeatPenalty(teams[t1].players, pairHistory) + computeTeamRepeatPenalty(teams[t2].players, pairHistory);
            const prevScore = (prevVariance * 5) + (prevRepeats * PAIR_REPEAT_WEIGHT) + (prevPos * POSITION_PRIORITY_WEIGHT);
            const newScore = (newVariance * 5) + (newRepeats * PAIR_REPEAT_WEIGHT) + (newPos * POSITION_PRIORITY_WEIGHT);

            if (newScore < prevScore - tolerance) {
              pairImproved = true;
            } else {
              teams[t1].players[i] = p1;
              teams[t2].players[j] = p2;
              teams[t1].totalAverage += s1 - s2;
              teams[t2].totalAverage += s2 - s1;
            }
          }
        }
      }
    }
  }

  return teams;
}

async function fetchPlayersFromSheets(apiUrl) {
  const url = new URL(apiUrl);
  url.searchParams.set("_ts", String(Date.now()));

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Falha ao carregar dados do Google Sheets");
  }
  const payload = await response.json();
  return sanitizePlayers(payload.players || payload);
}

async function savePlayersToSheets(apiUrl, players) {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({ players }),
  });

  if (!response.ok) {
    throw new Error("Falha ao salvar dados no Google Sheets");
  }
}

export default function LandingPage() {
  const initialState = useMemo(() => loadInitialPlayers(), []);
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isInitialSyncDone, setIsInitialSyncDone] = useState(!SHEETS_API_URL);
  const [isMutating, setIsMutating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    goals: "",
    assists: "",
    championships: "",
    speed: String(DEFAULT_PLAYER_SPEED),
    finishing: String(DEFAULT_PLAYER_FINISHING),
    defense: String(DEFAULT_PLAYER_DEFENSE),
    passing: String(DEFAULT_PLAYER_PASSING),
    linePosition: DEFAULT_PLAYER_LINE_POSITION,
    role: DEFAULT_PLAYER_ROLE,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [weeklySearchTerm, setWeeklySearchTerm] = useState("");
  const [statsSearchTerm, setStatsSearchTerm] = useState("");
  const [statsSortBy, setStatsSortBy] = useState("goals");
  const [statsSortDirection, setStatsSortDirection] = useState("desc");
  const [sortBy, setSortBy] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [teamsDrawSeed, setTeamsDrawSeed] = useState(Date.now());
  const [weeklySelectedPlayerIds, setWeeklySelectedPlayerIds] = useState([]);
  const [balancedTeams, setBalancedTeams] = useState([]);
  const [teamPairHistory, setTeamPairHistory] = useState(() => loadTeamPairHistory());
  const [syncStatus, setSyncStatus] = useState(SHEETS_API_URL ? "syncing" : "local");
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [editDraft, setEditDraft] = useState({
    name: "",
    goals: "0",
    assists: "0",
    championships: "0",
    speed: String(DEFAULT_PLAYER_SPEED),
    finishing: String(DEFAULT_PLAYER_FINISHING),
    defense: String(DEFAULT_PLAYER_DEFENSE),
    passing: String(DEFAULT_PLAYER_PASSING),
    linePosition: DEFAULT_PLAYER_LINE_POSITION,
    role: DEFAULT_PLAYER_ROLE,
  });
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkDrafts, setBulkDrafts] = useState({});
  const hasHydratedRemoteRef = useRef(false);
  const hasInitializedWeeklySelectionRef = useRef(false);
  const lastLocalMutationRef = useRef(0);
  const nextPlayerId = useRef(Math.max(...initialState.map((player) => player.id), 0) + 1);
  const [players, setPlayers] = useState(initialState);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
  }, [players]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(TEAM_PAIR_HISTORY_KEY, JSON.stringify(teamPairHistory));
  }, [teamPairHistory]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateRemotePlayers() {
      if (!SHEETS_API_URL) {
        hasHydratedRemoteRef.current = true;
        setIsInitialSyncDone(true);
        return;
      }

      setSyncStatus("syncing");
      try {
        const remotePlayers = await fetchPlayersFromSheets(SHEETS_API_URL);
        if (!cancelled && remotePlayers.length) {
          setPlayers(remotePlayers);
          nextPlayerId.current = Math.max(...remotePlayers.map((player) => player.id), 0) + 1;
        }
        if (!cancelled) {
          setSyncStatus("online");
        }
      } catch {
        if (!cancelled) {
          setSyncStatus("local");
        }
      } finally {
        if (!cancelled) {
          hasHydratedRemoteRef.current = true;
          setIsInitialSyncDone(true);
        }
      }
    }

    hydrateRemotePlayers();
    return () => {
      cancelled = true;
    };
  }, []);

  async function syncPlayersNow(nextPlayers) {
    if (!SHEETS_API_URL || !hasHydratedRemoteRef.current) {
      return;
    }

    lastLocalMutationRef.current = Date.now();
    setSyncStatus("syncing");
    setIsMutating(true);
    try {
      await savePlayersToSheets(SHEETS_API_URL, nextPlayers);
      setSyncStatus("online");
    } catch {
      setSyncStatus("local");
    } finally {
      setIsMutating(false);
    }
  }

  useEffect(() => {
    if (!SHEETS_API_URL) {
      return;
    }

    const intervalId = setInterval(async () => {
      if (!hasHydratedRemoteRef.current || editingPlayerId !== null) {
        return;
      }

      // Prevent polling from overriding a very recent local edit.
      if (Date.now() - lastLocalMutationRef.current < 3000) {
        return;
      }

      try {
        const remotePlayers = await fetchPlayersFromSheets(SHEETS_API_URL);
        setPlayers((current) => (playersChanged(current, remotePlayers) ? remotePlayers : current));
        setSyncStatus("online");
      } catch {
        setSyncStatus("local");
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [editingPlayerId]);

  const consolidatedPlayers = useMemo(() => {
    const grouped = new Map();
    players.forEach((player) => {
      const key = normalizePlayerName(player.name);
      const current = grouped.get(key);
      if (current) {
        current.goals += player.goals;
        current.assists += player.assists;
        current.championships += player.championships || 0;
        current.speed = Math.max(current.speed, sanitizeRating(player.speed, DEFAULT_PLAYER_SPEED));
        current.finishing = Math.max(current.finishing, sanitizeRating(player.finishing, DEFAULT_PLAYER_FINISHING));
        current.defense = Math.max(current.defense, sanitizeRating(player.defense, DEFAULT_PLAYER_DEFENSE));
        current.passing = Math.max(current.passing, sanitizeRating(player.passing, DEFAULT_PLAYER_PASSING));
        if (sanitizeRole(current.role) !== "goleiro") {
          current.linePosition = sanitizeLinePosition(player.linePosition);
        }
        return;
      }
      grouped.set(key, {
        id: player.id,
        name: player.name,
        goals: player.goals,
        assists: player.assists,
        championships: player.championships || 0,
        speed: sanitizeRating(player.speed, DEFAULT_PLAYER_SPEED),
        finishing: sanitizeRating(player.finishing, DEFAULT_PLAYER_FINISHING),
        defense: sanitizeRating(player.defense, DEFAULT_PLAYER_DEFENSE),
        passing: sanitizeRating(player.passing, DEFAULT_PLAYER_PASSING),
        linePosition: sanitizeLinePosition(player.linePosition),
        role: sanitizeRole(player.role),
      });
    });
    return Array.from(grouped.values());
  }, [players]);

  const totalGoals = useMemo(
    () => consolidatedPlayers.reduce((acc, player) => acc + player.goals, 0),
    [consolidatedPlayers]
  );
  const totalAssists = useMemo(
    () => consolidatedPlayers.reduce((acc, player) => acc + player.assists, 0),
    [consolidatedPlayers]
  );

  const seasonStats = useMemo(() => {
    const avgContribution = consolidatedPlayers.length
      ? ((totalGoals + totalAssists) / consolidatedPlayers.length).toFixed(1)
      : "0.0";
    return [
      { icon: <Users size={24} />, value: consolidatedPlayers.length, label: "Jogadores cadastrados" },
      { icon: <Zap size={24} />, value: totalGoals, label: "Gols cadastrados" },
      { icon: <TrendingUp size={24} />, value: totalAssists, label: "Assistencias cadastradas" },
      { icon: <Star size={24} />, value: avgContribution, label: "Media por jogador" },
    ];
  }, [consolidatedPlayers, totalAssists, totalGoals]);

  const topScorers = useMemo(
    () => [...consolidatedPlayers].sort((a, b) => b.goals - a.goals || b.assists - a.assists),
    [consolidatedPlayers]
  );

  const topAssists = useMemo(
    () => [...consolidatedPlayers].sort((a, b) => b.assists - a.assists || b.goals - a.goals),
    [consolidatedPlayers]
  );

  const topChampions = useMemo(
    () =>
      [...consolidatedPlayers]
        .sort((a, b) => b.championships - a.championships || b.goals - a.goals || b.assists - a.assists),
    [consolidatedPlayers]
  );

  const filteredPlayers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return players;
    }
    return players.filter((player) => String(player.name || "").toLowerCase().includes(term));
  }, [players, searchTerm]);

  const displayedPlayers = useMemo(() => {
    const getSafeName = (player) => String(player.name || "");
    const getSafeNumber = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const sorted = [...filteredPlayers].sort((a, b) => {
      if (sortBy === "name") {
        return getSafeName(a).localeCompare(getSafeName(b), "pt-BR");
      }
      if (sortBy === "goals") {
        return getSafeNumber(a.goals) - getSafeNumber(b.goals);
      }
      if (sortBy === "assists") {
        return getSafeNumber(a.assists) - getSafeNumber(b.assists);
      }
      if (sortBy === "overall") {
        return getHiddenLevelScore(a) - getHiddenLevelScore(b);
      }
      if (sortBy === "speed") {
        return sanitizeRating(a.speed, DEFAULT_PLAYER_SPEED) - sanitizeRating(b.speed, DEFAULT_PLAYER_SPEED);
      }
      if (sortBy === "finishing") {
        return sanitizeRating(a.finishing, DEFAULT_PLAYER_FINISHING) - sanitizeRating(b.finishing, DEFAULT_PLAYER_FINISHING);
      }
      if (sortBy === "defense") {
        return sanitizeRating(a.defense, DEFAULT_PLAYER_DEFENSE) - sanitizeRating(b.defense, DEFAULT_PLAYER_DEFENSE);
      }
      if (sortBy === "passing") {
        return sanitizeRating(a.passing, DEFAULT_PLAYER_PASSING) - sanitizeRating(b.passing, DEFAULT_PLAYER_PASSING);
      }
      return getSafeNumber(a.championships) - getSafeNumber(b.championships);
    });

    return sortDirection === "asc" ? sorted : sorted.reverse();
  }, [filteredPlayers, sortBy, sortDirection]);

  const weeklyAvailablePlayers = useMemo(
    () => [...consolidatedPlayers].filter((player) => sanitizeRole(player.role) !== "goleiro").sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [consolidatedPlayers]
  );

  useEffect(() => {
    const availableIds = new Set(weeklyAvailablePlayers.map((player) => player.id));

    setWeeklySelectedPlayerIds((current) => {
      if (!hasInitializedWeeklySelectionRef.current) {
        hasInitializedWeeklySelectionRef.current = true;
        return weeklyAvailablePlayers.map((player) => player.id);
      }

      return current.filter((id) => availableIds.has(id));
    });
  }, [weeklyAvailablePlayers]);

  const weeklySelectedPlayers = useMemo(() => {
    const selectedIds = new Set(weeklySelectedPlayerIds);
    return weeklyAvailablePlayers.filter((player) => selectedIds.has(player.id));
  }, [weeklyAvailablePlayers, weeklySelectedPlayerIds]);

  const filteredWeeklyAvailablePlayers = useMemo(() => {
    const term = weeklySearchTerm.trim().toLowerCase();
    if (!term) {
      return weeklyAvailablePlayers;
    }
    return weeklyAvailablePlayers.filter((player) => player.name.toLowerCase().includes(term));
  }, [weeklyAvailablePlayers, weeklySearchTerm]);

  const weeklyTeamsCount = Math.floor(weeklySelectedPlayers.length / TEAM_SIZE);
  const weeklyReservePlayers = useMemo(
    () => weeklySelectedPlayers.slice(weeklyTeamsCount * TEAM_SIZE),
    [weeklySelectedPlayers, weeklyTeamsCount]
  );

  useEffect(() => {
    setBalancedTeams(buildBalancedTeams(weeklySelectedPlayers, weeklyTeamsCount, teamsDrawSeed, teamPairHistory));
  }, [weeklySelectedPlayers, weeklyTeamsCount, teamsDrawSeed, teamPairHistory]);

  function toggleWeeklyPlayer(playerId) {
    setWeeklySelectedPlayerIds((current) =>
      current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId]
    );
  }

  function selectAllWeeklyPlayers() {
    setWeeklySelectedPlayerIds(weeklyAvailablePlayers.map((player) => player.id));
  }

  function clearWeeklyPlayers() {
    setWeeklySelectedPlayerIds([]);
  }

  function redrawTeams() {
    if (balancedTeams.length) {
      setTeamPairHistory((current) => updatePairHistoryWithTeams(current, balancedTeams));
    }
    setTeamsDrawSeed((current) => current + 1);
  }

  function clearPairHistory() {
    setTeamPairHistory({});
  }

  function exportTeamsToWhatsApp() {
    if (!balancedTeams.length) {
      return;
    }

    const lines = ["Times da semana", ""];

    balancedTeams.forEach((team) => {
      lines.push(`${team.name} (${team.players.length}/${TEAM_SIZE})`);
      team.players.forEach((player) => {
        lines.push(`- ${player.name}`);
      });
      lines.push("");
    });

    if (weeklyReservePlayers.length) {
      lines.push("Reservas");
      weeklyReservePlayers.forEach((player) => {
        lines.push(`- ${player.name}`);
      });
      lines.push("");
    }

    lines.push("Observacao: goleiros sao fixos e nao entram no sorteio das linhas.");

    const message = encodeURIComponent(lines.join("\n"));
    window.open(`https://wa.me/?text=${message}`, "_blank", "noopener,noreferrer");
  }

  function handleAddPlayer(event) {
    event.preventDefault();
    const name = formData.name.trim();
    const goals = Number.parseInt(formData.goals || "0", 10);
    const assists = Number.parseInt(formData.assists || "0", 10);
    const championships = Number.parseInt(formData.championships || "0", 10);
    const speed = sanitizeRating(formData.speed, DEFAULT_PLAYER_SPEED);
    const finishing = sanitizeRating(formData.finishing, DEFAULT_PLAYER_FINISHING);
    const defense = sanitizeRating(formData.defense, DEFAULT_PLAYER_DEFENSE);
    const passing = sanitizeRating(formData.passing, DEFAULT_PLAYER_PASSING);
    const linePosition = sanitizeLinePosition(formData.linePosition);
    const role = sanitizeRole(formData.role);
    if (!name) {
      return;
    }

    const safeGoals = Number.isNaN(goals) ? 0 : goals;
    const safeAssists = Number.isNaN(assists) ? 0 : assists;
    const safeChampionships = Number.isNaN(championships) ? 0 : championships;
    const normalizedName = normalizePlayerName(name);

    const existingIndex = players.findIndex((player) => normalizePlayerName(player.name) === normalizedName);
    let nextPlayers;
    if (existingIndex >= 0) {
      nextPlayers = players.map((player, index) =>
        index === existingIndex
          ? {
              ...player,
              goals: player.goals + safeGoals,
              assists: player.assists + safeAssists,
              championships: (player.championships || 0) + safeChampionships,
              speed,
              finishing,
              defense,
              passing,
              linePosition,
              role,
            }
          : player
      );
    } else {
      nextPlayers = [
        {
          id: nextPlayerId.current++,
          name,
          goals: safeGoals,
          assists: safeAssists,
          championships: safeChampionships,
          speed,
          finishing,
          defense,
          passing,
          linePosition,
          role,
        },
        ...players,
      ];
    }

    setPlayers(nextPlayers);

    syncPlayersNow(nextPlayers);
    setFormData({
      name: "",
      goals: "",
      assists: "",
      championships: "",
      speed: String(DEFAULT_PLAYER_SPEED),
      finishing: String(DEFAULT_PLAYER_FINISHING),
      defense: String(DEFAULT_PLAYER_DEFENSE),
      passing: String(DEFAULT_PLAYER_PASSING),
      linePosition: DEFAULT_PLAYER_LINE_POSITION,
      role: DEFAULT_PLAYER_ROLE,
    });
  }

  function toBulkDraft(player) {
    return {
      name: player.name,
      goals: String(player.goals),
      assists: String(player.assists),
      championships: String(player.championships || 0),
      speed: String(sanitizeRating(player.speed, DEFAULT_PLAYER_SPEED)),
      finishing: String(sanitizeRating(player.finishing, DEFAULT_PLAYER_FINISHING)),
      defense: String(sanitizeRating(player.defense, DEFAULT_PLAYER_DEFENSE)),
      passing: String(sanitizeRating(player.passing, DEFAULT_PLAYER_PASSING)),
      linePosition: sanitizeLinePosition(player.linePosition),
      role: sanitizeRole(player.role),
    };
  }

  function startBulkEdit() {
    setEditingPlayerId(null);
    const nextDrafts = {};
    players.forEach((player) => {
      nextDrafts[player.id] = toBulkDraft(player);
    });
    setBulkDrafts(nextDrafts);
    setIsBulkEditing(true);
  }

  function cancelBulkEdit() {
    setIsBulkEditing(false);
    setBulkDrafts({});
  }

  function updateBulkDraftField(playerId, field, value) {
    setBulkDrafts((current) => ({
      ...current,
      [playerId]: {
        ...current[playerId],
        [field]: value,
      },
    }));
  }

  function saveBulkEdit() {
    const nextPlayers = players.map((player) => {
      const draft = bulkDrafts[player.id];
      if (!draft) {
        return player;
      }

      const goals = Number.parseInt(draft.goals || "0", 10);
      const assists = Number.parseInt(draft.assists || "0", 10);
      const championships = Number.parseInt(draft.championships || "0", 10);

      return {
        ...player,
        name: draft.name.trim() || player.name,
        goals: Number.isNaN(goals) || goals < 0 ? 0 : goals,
        assists: Number.isNaN(assists) || assists < 0 ? 0 : assists,
        championships: Number.isNaN(championships) || championships < 0 ? 0 : championships,
        speed: sanitizeRating(draft.speed, DEFAULT_PLAYER_SPEED),
        finishing: sanitizeRating(draft.finishing, DEFAULT_PLAYER_FINISHING),
        defense: sanitizeRating(draft.defense, DEFAULT_PLAYER_DEFENSE),
        passing: sanitizeRating(draft.passing, DEFAULT_PLAYER_PASSING),
        linePosition: sanitizeLinePosition(draft.linePosition),
        role: sanitizeRole(draft.role),
      };
    });

    setPlayers(nextPlayers);
    syncPlayersNow(nextPlayers);
    cancelBulkEdit();
  }

  function startEdit(player) {
    if (isBulkEditing) {
      return;
    }

    setEditingPlayerId(player.id);
    setEditDraft({
      name: player.name,
      goals: String(player.goals),
      assists: String(player.assists),
      championships: String(player.championships || 0),
      speed: String(sanitizeRating(player.speed, DEFAULT_PLAYER_SPEED)),
      finishing: String(sanitizeRating(player.finishing, DEFAULT_PLAYER_FINISHING)),
      defense: String(sanitizeRating(player.defense, DEFAULT_PLAYER_DEFENSE)),
      passing: String(sanitizeRating(player.passing, DEFAULT_PLAYER_PASSING)),
      linePosition: sanitizeLinePosition(player.linePosition),
      role: sanitizeRole(player.role),
    });
  }

  function cancelEdit() {
    setEditingPlayerId(null);
    setEditDraft({
      name: "",
      goals: "0",
      assists: "0",
      championships: "0",
      speed: String(DEFAULT_PLAYER_SPEED),
      finishing: String(DEFAULT_PLAYER_FINISHING),
      defense: String(DEFAULT_PLAYER_DEFENSE),
      passing: String(DEFAULT_PLAYER_PASSING),
      linePosition: DEFAULT_PLAYER_LINE_POSITION,
      role: DEFAULT_PLAYER_ROLE,
    });
  }

  function saveEdit(playerId) {
    const name = editDraft.name.trim();
    const goals = Number.parseInt(editDraft.goals || "0", 10);
    const assists = Number.parseInt(editDraft.assists || "0", 10);
    const championships = Number.parseInt(editDraft.championships || "0", 10);
    const speed = sanitizeRating(editDraft.speed, DEFAULT_PLAYER_SPEED);
    const finishing = sanitizeRating(editDraft.finishing, DEFAULT_PLAYER_FINISHING);
    const defense = sanitizeRating(editDraft.defense, DEFAULT_PLAYER_DEFENSE);
    const passing = sanitizeRating(editDraft.passing, DEFAULT_PLAYER_PASSING);
    const linePosition = sanitizeLinePosition(editDraft.linePosition);
    const role = sanitizeRole(editDraft.role);

    const nextPlayers = players.map((player) =>
      player.id === playerId
        ? {
            ...player,
            name: name || player.name,
            goals: Number.isNaN(goals) || goals < 0 ? 0 : goals,
            assists: Number.isNaN(assists) || assists < 0 ? 0 : assists,
            championships: Number.isNaN(championships) || championships < 0 ? 0 : championships,
            speed,
            finishing,
            defense,
            passing,
            linePosition,
            role,
          }
        : player
    );

    setPlayers(nextPlayers);

    syncPlayersNow(nextPlayers);
    cancelEdit();
  }

  function handleDeletePlayer(playerId) {
    const nextPlayers = players.filter((player) => player.id !== playerId);
    setPlayers(nextPlayers);
    syncPlayersNow(nextPlayers);

    if (isBulkEditing) {
      setBulkDrafts((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[playerId];
        return nextDrafts;
      });
    }

    if (editingPlayerId === playerId) {
      cancelEdit();
    }
  }

  function handleQuickStat(playerId, field, delta = 1) {
    const nextPlayers = players.map((player) =>
      player.id === playerId ? { ...player, [field]: Math.max(0, (player[field] || 0) + delta) } : player
    );
    setPlayers(nextPlayers);
    syncPlayersNow(nextPlayers);
  }

  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setNavOpen(false);
  }

  function renderTrophies(count) {
    if (!count) {
      return <span className="no-trophies">-</span>;
    }

    return (
      <span className="trophy-stack" aria-label={`${count} titulos`}>
        {Array.from({ length: count }).map((_, index) => (
          <Trophy key={index} size={14} />
        ))}
      </span>
    );
  }

  if (!isInitialSyncDone) {
    return (
      <div className="sync-loading-screen">
        <div className="sync-loading-card">
          <div className="sync-spinner" aria-hidden="true" />
          <h2>Sincronizando dados</h2>
          <p>Aguarde, estamos conectando com o Google Sheets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="league-root">
      <nav className={`league-nav${scrolled ? " scrolled" : ""}`}>
        <div className="container nav-inner">
          <button className="nav-brand" onClick={() => scrollTo("hero")}>
            <Shield size={22} className="me-2" /> Fut de terca
          </button>

          <div className={`nav-links${navOpen ? " open" : ""}`}>
            {[
              ["artilharia", "Artilharia"],
              ["assistencias", "Assistencias"],
              ["campeoes", "Campeoes"],
              ["times", "Times"],
              ["cadastro", "Cadastro"],
              ["atualizacao-rapida", "Atualizacao rapida"],
            ].map(([id, label]) => (
              <button key={id} onClick={() => scrollTo(id)} className="nav-link-btn">
                {label}
              </button>
            ))}
            <a href={groupLink} target="_blank" rel="noopener noreferrer" className="btn-nav">
              Entrar no grupo
            </a>
          </div>

          <button className="nav-hamburger" onClick={() => setNavOpen(!navOpen)} aria-label="Menu">
            {navOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      <button
        type="button"
        className="mobile-quick-stats-btn"
        onClick={() => scrollTo("atualizacao-rapida")}
        aria-label="Ir para atualizacao rapida de estatisticas"
      >
        <Zap size={16} />
        Atualizar gols, assistencias e titulos
      </button>

      <section id="hero" className="hero-section">
        <div className="hero-noise" />
        <div className="container hero-content">
          <div className="hero-tag">TEMPORADA 2026</div>
          <h1 className="hero-title">Fut de terca</h1>
          <p className="hero-subtitle">
            Cadastre jogadores e acompanhe artilharia e assistencias da resenha em tempo real.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={() => scrollTo("cadastro")}>
              Cadastrar jogador <ArrowRight size={16} className="ms-2" />
            </button>
            <button className="btn-secondary" onClick={() => scrollTo("artilharia")}>Ver artilheiros</button>
          </div>
        </div>
      </section>

      <section className="stats-section">
        <div className="container stats-grid">
          {seasonStats.map((item) => (
            <div className="stat-card" key={item.label}>
              <div className="stat-icon">{item.icon}</div>
              <div className="stat-value">{item.value}</div>
              <div className="stat-label">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="artilharia" className="section-pad section-alt">
        <div className="container">
          <div className="section-header">
            <p className="section-eyebrow">Artilharia</p>
            <h2>Top goleadores</h2>
          </div>
          <div className="fifa-cards-grid">
            {topScorers.map((player, index) => {
              const tier = getCardTier(player);
              const pos = sanitizeRole(player.role) === "goleiro" ? "GOL" : sanitizeLinePosition(player.linePosition).slice(0,3).toUpperCase();
              return (
                <div className="fifa-card-wrapper" key={player.name}>
                  <div className={`fifa-card fifa-card--${tier}`}>
                    <div className="fifa-card__top">
                      <div className="fifa-card__ovr-block">
                        <span className="fifa-card__ovr">{displayOVR(player)}</span>
                        <span className="fifa-card__pos">{pos}</span>
                      </div>
                      <div className="fifa-card__rank-badge">#{index + 1}</div>
                    </div>
                    <div className="fifa-card__avatar">
                      <span className="fifa-card__initials">{player.name.slice(0,2).toUpperCase()}</span>
                    </div>
                    <div className="fifa-card__name">{player.name}</div>
                    <div className="fifa-card__stats">
                      <div className="fifa-card__stat"><span className="fifa-card__stat-val">{displayStat(player.speed, DEFAULT_PLAYER_SPEED)}</span><span className="fifa-card__stat-key">VEL</span></div>
                      <div className="fifa-card__stat"><span className="fifa-card__stat-val">{displayStat(player.passing, DEFAULT_PLAYER_PASSING)}</span><span className="fifa-card__stat-key">PAS</span></div>
                      <div className="fifa-card__stat"><span className="fifa-card__stat-val">{displayStat(player.finishing, DEFAULT_PLAYER_FINISHING)}</span><span className="fifa-card__stat-key">FIN</span></div>
                      <div className="fifa-card__stat"><span className="fifa-card__stat-val">{displayStat(player.defense, DEFAULT_PLAYER_DEFENSE)}</span><span className="fifa-card__stat-key">DEF</span></div>
                    </div>
                  </div>
                  <div className="fifa-stat-badge fifa-stat-badge--goals">
                    <span className="fifa-stat-badge__icon">⚽</span>
                    <span className="fifa-stat-badge__value">{player.goals}</span>
                    <span className="fifa-stat-badge__label">gols</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="assistencias" className="section-pad">
        <div className="container">
          <div className="section-header">
            <p className="section-eyebrow">Assistencias</p>
            <h2>Lideres de assistencia</h2>
          </div>
          <div className="fifa-cards-grid">
            {topAssists.map((player, index) => {
              const tier = getCardTier(player);
              const pos = sanitizeRole(player.role) === "goleiro" ? "GOL" : sanitizeLinePosition(player.linePosition).slice(0,3).toUpperCase();
              return (
                <div className="fifa-card-wrapper" key={player.name}>
                  <div className={`fifa-card fifa-card--${tier}`}>
                    <div className="fifa-card__top">
                      <div className="fifa-card__ovr-block">
                        <span className="fifa-card__ovr">{displayOVR(player)}</span>
                        <span className="fifa-card__pos">{pos}</span>
                      </div>
                      <div className="fifa-card__rank-badge">#{index + 1}</div>
                    </div>
                    <div className="fifa-card__avatar">
                      <span className="fifa-card__initials">{player.name.slice(0,2).toUpperCase()}</span>
                    </div>
                    <div className="fifa-card__name">{player.name}</div>
                    <div className="fifa-card__stats">
                      <div className="fifa-card__stat"><span className="fifa-card__stat-val">{displayStat(player.speed, DEFAULT_PLAYER_SPEED)}</span><span className="fifa-card__stat-key">VEL</span></div>
                      <div className="fifa-card__stat"><span className="fifa-card__stat-val">{displayStat(player.passing, DEFAULT_PLAYER_PASSING)}</span><span className="fifa-card__stat-key">PAS</span></div>
                      <div className="fifa-card__stat"><span className="fifa-card__stat-val">{displayStat(player.finishing, DEFAULT_PLAYER_FINISHING)}</span><span className="fifa-card__stat-key">FIN</span></div>
                      <div className="fifa-card__stat"><span className="fifa-card__stat-val">{displayStat(player.defense, DEFAULT_PLAYER_DEFENSE)}</span><span className="fifa-card__stat-key">DEF</span></div>
                    </div>
                  </div>
                  <div className="fifa-stat-badge fifa-stat-badge--assists">
                    <span className="fifa-stat-badge__icon">🅰️</span>
                    <span className="fifa-stat-badge__value">{player.assists}</span>
                    <span className="fifa-stat-badge__label">assist.</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="campeoes" className="section-pad section-alt">
        <div className="container">
          <div className="section-header">
            <p className="section-eyebrow">Campeoes</p>
            <h2>Ranking de campeoes</h2>
          </div>
          <div className="fifa-cards-grid">
            {topChampions.map((player, index) => {
              const tier = getCardTier(player);
              const pos = sanitizeRole(player.role) === "goleiro" ? "GOL" : sanitizeLinePosition(player.linePosition).slice(0,3).toUpperCase();
              return (
                <div className="fifa-card-wrapper" key={player.name}>
                  <div className={`fifa-card fifa-card--${tier}`}>
                    <div className="fifa-card__top">
                      <div className="fifa-card__ovr-block">
                        <span className="fifa-card__ovr">{displayOVR(player)}</span>
                        <span className="fifa-card__pos">{pos}</span>
                      </div>
                      <div className="fifa-card__rank-badge">#{index + 1}</div>
                    </div>
                    <div className="fifa-card__avatar">
                      <span className="fifa-card__initials">{player.name.slice(0,2).toUpperCase()}</span>
                    </div>
                    <div className="fifa-card__name">{player.name}</div>
                    <div className="fifa-card__stats">
                      <div className="fifa-card__stat"><span className="fifa-card__stat-val">{displayStat(player.speed, DEFAULT_PLAYER_SPEED)}</span><span className="fifa-card__stat-key">VEL</span></div>
                      <div className="fifa-card__stat"><span className="fifa-card__stat-val">{displayStat(player.passing, DEFAULT_PLAYER_PASSING)}</span><span className="fifa-card__stat-key">PAS</span></div>
                      <div className="fifa-card__stat"><span className="fifa-card__stat-val">{displayStat(player.finishing, DEFAULT_PLAYER_FINISHING)}</span><span className="fifa-card__stat-key">FIN</span></div>
                      <div className="fifa-card__stat"><span className="fifa-card__stat-val">{displayStat(player.defense, DEFAULT_PLAYER_DEFENSE)}</span><span className="fifa-card__stat-key">DEF</span></div>
                    </div>
                  </div>
                  <div className="fifa-stat-badge fifa-stat-badge--champ">
                    <span className="fifa-stat-badge__icon">🏆</span>
                    <span className="fifa-stat-badge__value">{player.championships}</span>
                    <span className="fifa-stat-badge__label">títulos</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="times" className="section-pad">
        <div className="container">
          <div className="section-header">
            <p className="section-eyebrow">Times equilibrados</p>
            <h2>Montagem automatica por overall</h2>
            <p className="sync-note">Overall ponderado por posicao: ataque prioriza finalizacao e velocidade, meio prioriza passe e velocidade, defesa prioriza defesa e velocidade.</p>
            <p className="sync-note">Goleiros sao fixos e ficam fora do sorteio das linhas.</p>
            <p className="sync-note">O algoritmo prioriza o balanceamento do overall; posicoes ficam em segundo plano.</p>
          </div>

          <div className="weekly-selection">
            <div className="weekly-selection-head">
              <h3>Jogadores da semana</h3>
              <p>{weeklySelectedPlayerIds.length} selecionados</p>
            </div>
            <div className="weekly-selection-actions">
              <button type="button" className="sort-toggle" onClick={selectAllWeeklyPlayers}>Selecionar todos</button>
              <button type="button" className="sort-toggle" onClick={clearWeeklyPlayers}>Limpar</button>
            </div>
            <input
              className="weekly-search-input"
              type="text"
              value={weeklySearchTerm}
              onChange={(event) => setWeeklySearchTerm(event.target.value)}
              placeholder="Pesquisar jogador da semana..."
            />
            <div className="weekly-players-grid">
              {filteredWeeklyAvailablePlayers.map((player) => {
                const checked = weeklySelectedPlayerIds.includes(player.id);
                const tier = getCardTier(player);
                return (
                  <label key={player.id} className={`weekly-player-item weekly-player-item--${tier}${checked ? " checked" : ""}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleWeeklyPlayer(player.id)}
                    />
                    <span className="weekly-player-item__name">{player.name}</span>
                    <span className="weekly-player-item__ovr">{displayOVR(player)}</span>
                  </label>
                );
              })}
              {!filteredWeeklyAvailablePlayers.length && (
                <p className="weekly-empty">Nenhum jogador encontrado na busca.</p>
              )}
            </div>
          </div>

          {weeklySelectedPlayers.length ? (
            <>
              <div className="teams-controls">
                <strong>Times fechados: {weeklyTeamsCount}</strong>
                <span>{weeklyReservePlayers.length} reserva(s) para completar o próximo time de {TEAM_SIZE}</span>
                <button
                  type="button"
                  className="sort-toggle"
                  onClick={redrawTeams}
                  disabled={!balancedTeams.length}
                >
                  Sortear novamente
                </button>
                <button
                  type="button"
                  className="sort-toggle"
                  onClick={clearPairHistory}
                >
                  Zerar historico de parcerias
                </button>
                <button
                  type="button"
                  className="btn-primary teams-export-btn"
                  onClick={exportTeamsToWhatsApp}
                  disabled={!balancedTeams.length}
                >
                  Exportar para WhatsApp
                </button>
              </div>
            <div className="teams-grid">
              {balancedTeams.map((team) => (
                <article key={team.id} className="team-card">
                  <h3>{team.name}</h3>
                    <p className="team-meta">{team.players.length}/{TEAM_SIZE} jogadores</p>
                  <ul>
                    {team.players.map((player) => (
                      <li key={player.id}>
                        <span>{player.name}</span>
                        <small>{sanitizeRole(player.role) === "goleiro" ? "Goleiro" : sanitizeLinePosition(player.linePosition)} · OVR {displayOVR(player)}</small>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
              </div>
              {weeklyReservePlayers.length > 0 && (
                <div className="reserve-card">
                  <h3>Reservas para o próximo time</h3>
                  <p className="team-meta">Ficam de fora da montagem atual até fechar {TEAM_SIZE}.</p>
                  <ul>
                    {weeklyReservePlayers.map((player) => (
                      <li key={player.id}>
                        <span>{player.name}</span>
                        <small>{sanitizeRole(player.role) === "goleiro" ? "Goleiro" : sanitizeLinePosition(player.linePosition)} · OVR {displayOVR(player)}</small>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="sync-note">Selecione pelo menos {TEAM_SIZE} jogadores para montar os times.</p>
          )}
        </div>
      </section>

      <section id="cadastro" className="section-pad">
        <div className="container">
          <div className="section-header">
            <p className="section-eyebrow">Cadastro</p>
            <h2>Adicionar jogador, gols e assistencias</h2>
            <p className="sync-note">
              {syncStatus === "online" && "Sincronizado com Google Sheets"}
              {syncStatus === "syncing" && "Sincronizando com Google Sheets..."}
              {syncStatus === "local" && "Modo local (sem conexao com Google Sheets)"}
            </p>
          </div>
          <div className="register-grid">
            <form className="player-form" onSubmit={handleAddPlayer}>
              <label>
                Nome do jogador
                <input
                  type="text"
                  value={formData.name}
                  onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Ex: Joao"
                  required
                />
              </label>
              <label>
                Velocidade
                <select
                  value={formData.speed}
                  onChange={(event) => setFormData((current) => ({ ...current, speed: event.target.value }))}
                >
                  {RATING_OPTIONS.map((value) => (
                    <option key={value} value={String(value)}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                Finalizacao
                <select
                  value={formData.finishing}
                  onChange={(event) => setFormData((current) => ({ ...current, finishing: event.target.value }))}
                >
                  {RATING_OPTIONS.map((value) => (
                    <option key={value} value={String(value)}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                Defesa
                <select
                  value={formData.defense}
                  onChange={(event) => setFormData((current) => ({ ...current, defense: event.target.value }))}
                >
                  {RATING_OPTIONS.map((value) => (
                    <option key={value} value={String(value)}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                Passe
                <select
                  value={formData.passing}
                  onChange={(event) => setFormData((current) => ({ ...current, passing: event.target.value }))}
                >
                  {RATING_OPTIONS.map((value) => (
                    <option key={value} value={String(value)}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                Posicao de linha
                <select
                  value={formData.linePosition}
                  onChange={(event) => setFormData((current) => ({ ...current, linePosition: event.target.value }))}
                >
                  {LINE_POSITION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Funcao
                <select
                  value={formData.role}
                  onChange={(event) => setFormData((current) => ({ ...current, role: event.target.value }))}
                >
                  <option value="linha">Linha</option>
                  <option value="goleiro">Goleiro</option>
                </select>
              </label>
              <button type="submit" className="btn-primary form-btn" disabled={isMutating}>
                {isMutating ? "Salvando..." : "Salvar jogador"}
              </button>
            </form>

            <div className="players-list">
              <h3>Jogadores cadastrados</h3>
              <input
                className="search-input"
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Pesquisar jogador por nome..."
              />
              <div className="players-filters">
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="sort-select">
                  <option value="name">Jogador</option>
                  <option value="overall">Overall</option>
                  <option value="speed">Velocidade</option>
                  <option value="finishing">Finalizacao</option>
                  <option value="defense">Defesa</option>
                  <option value="passing">Passe</option>
                </select>
                <button
                  type="button"
                  className="sort-toggle"
                  onClick={() => setSortDirection((current) => (current === "asc" ? "desc" : "asc"))}
                >
                  {sortDirection === "asc" ? "Crescente" : "Decrescente"}
                </button>
              </div>
              <div className="bulk-actions">
                {!isBulkEditing ? (
                  <button type="button" className="row-btn edit" onClick={startBulkEdit} disabled={isMutating}>Editar em massa</button>
                ) : (
                  <>
                    <button type="button" className="row-btn save" onClick={saveBulkEdit} disabled={isMutating}>Salvar tudo</button>
                    <button type="button" className="row-btn cancel" onClick={cancelBulkEdit} disabled={isMutating}>Cancelar</button>
                  </>
                )}
              </div>
              <div className="players-scroll">
                <table className="simple-table">
                  <thead>
                    <tr>
                      <th>Jogador</th>
                      <th>Funcao</th>
                      <th>Posicao</th>
                      <th className="mobile-hidden">Vel</th>
                      <th className="mobile-hidden">Fin</th>
                      <th className="mobile-hidden">Defesa</th>
                      <th className="mobile-hidden">Passe</th>
                      <th>OVR</th>
                      <th>Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedPlayers.map((player) => (
                      <tr key={player.id}>
                        <td data-label="Jogador">
                          {isBulkEditing ? (
                            <input
                              className="stat-input name-input"
                              type="text"
                              value={bulkDrafts[player.id]?.name || ""}
                              onChange={(event) => updateBulkDraftField(player.id, "name", event.target.value)}
                            />
                          ) : editingPlayerId === player.id ? (
                            <input
                              className="stat-input name-input"
                              type="text"
                              value={editDraft.name}
                              onChange={(event) => setEditDraft((current) => ({ ...current, name: event.target.value }))}
                            />
                          ) : (
                            player.name
                          )}
                        </td>
                        <td data-label="Funcao">
                          {isBulkEditing ? (
                            <select
                              className="stat-select"
                              value={bulkDrafts[player.id]?.role || DEFAULT_PLAYER_ROLE}
                              onChange={(event) => updateBulkDraftField(player.id, "role", event.target.value)}
                            >
                              <option value="linha">Linha</option>
                              <option value="goleiro">Goleiro</option>
                            </select>
                          ) : editingPlayerId === player.id ? (
                            <select
                              className="stat-select"
                              value={editDraft.role}
                              onChange={(event) => setEditDraft((current) => ({ ...current, role: event.target.value }))}
                            >
                              <option value="linha">Linha</option>
                              <option value="goleiro">Goleiro</option>
                            </select>
                          ) : (
                            sanitizeRole(player.role) === "goleiro" ? "Goleiro" : "Linha"
                          )}
                        </td>
                        <td data-label="Posicao">
                          {isBulkEditing ? (
                            <select
                              className="stat-select"
                              value={bulkDrafts[player.id]?.linePosition || DEFAULT_PLAYER_LINE_POSITION}
                              onChange={(event) => updateBulkDraftField(player.id, "linePosition", event.target.value)}
                              disabled={(bulkDrafts[player.id]?.role || DEFAULT_PLAYER_ROLE) === "goleiro"}
                            >
                              {LINE_POSITION_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          ) : editingPlayerId === player.id ? (
                            <select
                              className="stat-select"
                              value={editDraft.linePosition}
                              onChange={(event) => setEditDraft((current) => ({ ...current, linePosition: event.target.value }))}
                              disabled={editDraft.role === "goleiro"}
                            >
                              {LINE_POSITION_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          ) : sanitizeRole(player.role) === "goleiro" ? (
                            "-"
                          ) : (
                            sanitizeLinePosition(player.linePosition)
                          )}
                        </td>
                        <td data-label="Vel" className="mobile-hidden">
                          {isBulkEditing ? (
                            <select
                              className="stat-select"
                              value={bulkDrafts[player.id]?.speed || String(DEFAULT_PLAYER_SPEED)}
                              onChange={(event) => updateBulkDraftField(player.id, "speed", event.target.value)}
                            >
                              {RATING_OPTIONS.map((value) => (
                                <option key={value} value={String(value)}>{value}</option>
                              ))}
                            </select>
                          ) : editingPlayerId === player.id ? (
                            <select
                              className="stat-select"
                              value={editDraft.speed}
                              onChange={(event) => setEditDraft((current) => ({ ...current, speed: event.target.value }))}
                            >
                              {RATING_OPTIONS.map((value) => (
                                <option key={value} value={String(value)}>{value}</option>
                              ))}
                            </select>
                          ) : (
                            sanitizeRating(player.speed, DEFAULT_PLAYER_SPEED)
                          )}
                        </td>
                        <td data-label="Fin" className="mobile-hidden">
                          {isBulkEditing ? (
                            <select
                              className="stat-select"
                              value={bulkDrafts[player.id]?.finishing || String(DEFAULT_PLAYER_FINISHING)}
                              onChange={(event) => updateBulkDraftField(player.id, "finishing", event.target.value)}
                            >
                              {RATING_OPTIONS.map((value) => (
                                <option key={value} value={String(value)}>{value}</option>
                              ))}
                            </select>
                          ) : editingPlayerId === player.id ? (
                            <select
                              className="stat-select"
                              value={editDraft.finishing}
                              onChange={(event) => setEditDraft((current) => ({ ...current, finishing: event.target.value }))}
                            >
                              {RATING_OPTIONS.map((value) => (
                                <option key={value} value={String(value)}>{value}</option>
                              ))}
                            </select>
                          ) : (
                            sanitizeRating(player.finishing, DEFAULT_PLAYER_FINISHING)
                          )}
                        </td>
                        <td data-label="Defesa" className="mobile-hidden">
                          {isBulkEditing ? (
                            <select
                              className="stat-select"
                              value={bulkDrafts[player.id]?.defense || String(DEFAULT_PLAYER_DEFENSE)}
                              onChange={(event) => updateBulkDraftField(player.id, "defense", event.target.value)}
                            >
                              {RATING_OPTIONS.map((value) => (
                                <option key={value} value={String(value)}>{value}</option>
                              ))}
                            </select>
                          ) : editingPlayerId === player.id ? (
                            <select
                              className="stat-select"
                              value={editDraft.defense}
                              onChange={(event) => setEditDraft((current) => ({ ...current, defense: event.target.value }))}
                            >
                              {RATING_OPTIONS.map((value) => (
                                <option key={value} value={String(value)}>{value}</option>
                              ))}
                            </select>
                          ) : (
                            sanitizeRating(player.defense, DEFAULT_PLAYER_DEFENSE)
                          )}
                        </td>
                        <td data-label="Passe" className="mobile-hidden">
                          {isBulkEditing ? (
                            <select
                              className="stat-select"
                              value={bulkDrafts[player.id]?.passing || String(DEFAULT_PLAYER_PASSING)}
                              onChange={(event) => updateBulkDraftField(player.id, "passing", event.target.value)}
                            >
                              {RATING_OPTIONS.map((value) => (
                                <option key={value} value={String(value)}>{value}</option>
                              ))}
                            </select>
                          ) : editingPlayerId === player.id ? (
                            <select
                              className="stat-select"
                              value={editDraft.passing}
                              onChange={(event) => setEditDraft((current) => ({ ...current, passing: event.target.value }))}
                            >
                              {RATING_OPTIONS.map((value) => (
                                <option key={value} value={String(value)}>{value}</option>
                              ))}
                            </select>
                          ) : (
                            sanitizeRating(player.passing, DEFAULT_PLAYER_PASSING)
                          )}
                        </td>
                        <td data-label="OVR">{displayOVR(player)}</td>
                        <td data-label="Acoes">
                          {isBulkEditing ? (
                            <span className="sync-note">Edicao em massa</span>
                          ) : editingPlayerId === player.id ? (
                            <div className="row-actions">
                              <button className="row-btn save" type="button" onClick={() => saveEdit(player.id)} disabled={isMutating}>Salvar</button>
                              <button className="row-btn cancel" type="button" onClick={cancelEdit} disabled={isMutating}>Cancelar</button>
                            </div>
                          ) : (
                            <div className="row-actions">
                              <button className="row-btn edit" type="button" onClick={() => startEdit(player)} disabled={isMutating}>Editar</button>
                              <button className="row-btn delete" type="button" onClick={() => handleDeletePlayer(player.id)} disabled={isMutating}>Excluir</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!displayedPlayers.length && (
                      <tr>
                        <td colSpan="9">Nenhum jogador encontrado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Tabela de estatísticas rápidas */}
              <div id="atualizacao-rapida" className="stats-table-section">
                <h3>Estatísticas da temporada</h3>
                <div className="stats-table-controls">
                  <input
                    className="search-input"
                    type="text"
                    value={statsSearchTerm}
                    onChange={(event) => setStatsSearchTerm(event.target.value)}
                    placeholder="Pesquisar jogador..."
                  />
                  <select value={statsSortBy} onChange={(event) => setStatsSortBy(event.target.value)} className="sort-select">
                    <option value="goals">Gols</option>
                    <option value="assists">Assistências</option>
                    <option value="championships">Títulos</option>
                    <option value="name">Nome</option>
                  </select>
                  <button
                    type="button"
                    className="sort-toggle"
                    onClick={() => setStatsSortDirection((current) => (current === "asc" ? "desc" : "asc"))}
                  >
                    {statsSortDirection === "asc" ? "Crescente" : "Decrescente"}
                  </button>
                </div>
                <div className="players-scroll">
                  <table className="simple-table stats-season-table">
                    <thead>
                      <tr>
                        <th className="col-player">Jogador</th>
                        <th className="col-stat">⚽ Gols</th>
                        <th className="col-stat">🅰️ Assist.</th>
                        <th className="col-stat">🏆 Títulos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...consolidatedPlayers]
                        .filter((p) => !statsSearchTerm.trim() || p.name.toLowerCase().includes(statsSearchTerm.trim().toLowerCase()))
                        .sort((a, b) => {
                          const dir = statsSortDirection === "asc" ? 1 : -1;
                          if (statsSortBy === "name") return dir * a.name.localeCompare(b.name, "pt-BR");
                          return dir * ((a[statsSortBy] || 0) - (b[statsSortBy] || 0)) || a.name.localeCompare(b.name, "pt-BR");
                        })
                        .map((player) => (
                          <tr key={player.id}>
                            <td data-label="Jogador" className="col-player">{player.name}</td>
                            <td data-label="Gols" className="col-stat">
                              <div className="quick-stat-cell">
                                <button type="button" className="quick-stat-btn sub" title="Remover gol" disabled={isMutating || !player.goals} onClick={() => handleQuickStat(player.id, "goals", -1)}>−</button>
                                <span className="quick-stat-value">{player.goals}</span>
                                <button type="button" className="quick-stat-btn" title="Marcar gol" disabled={isMutating} onClick={() => handleQuickStat(player.id, "goals")}>+⚽</button>
                              </div>
                            </td>
                            <td data-label="Assist." className="col-stat">
                              <div className="quick-stat-cell">
                                <button type="button" className="quick-stat-btn sub" title="Remover assistencia" disabled={isMutating || !player.assists} onClick={() => handleQuickStat(player.id, "assists", -1)}>−</button>
                                <span className="quick-stat-value">{player.assists}</span>
                                <button type="button" className="quick-stat-btn" title="Marcar assistencia" disabled={isMutating} onClick={() => handleQuickStat(player.id, "assists")}>+🅰️</button>
                              </div>
                            </td>
                            <td data-label="Títulos" className="col-stat">
                              <div className="quick-stat-cell">
                                <button type="button" className="quick-stat-btn sub" title="Remover titulo" disabled={isMutating || !player.championships} onClick={() => handleQuickStat(player.id, "championships", -1)}>−</button>
                                <span className="quick-stat-value">{renderTrophies(player.championships)}</span>
                                <button type="button" className="quick-stat-btn" title="Marcar titulo" disabled={isMutating} onClick={() => handleQuickStat(player.id, "championships")}>+🏆</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="league-footer">
        <div className="container footer-inner">
          <p>Fut de terca - Temporada 2026</p>
        </div>
      </footer>

      {isMutating && (
        <div className="action-loading-overlay" role="status" aria-live="polite" aria-label="Salvando alteracoes">
          <div className="action-loading-box">
            <div className="sync-spinner" aria-hidden="true" />
            <p>Salvando alteracoes...</p>
          </div>
        </div>
      )}
    </div>
  );
}
