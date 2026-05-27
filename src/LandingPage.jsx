import React, { useEffect, useMemo, useRef, useState } from "react";
import { Shield, Star, Trophy, TrendingUp, Users, ArrowRight, Menu, X, Zap } from "lucide-react";
import initialPlayers from "./data/players.json";

const groupLink = "https://wa.me/5511999999999?text=Quero%20participar%20do%20Fut%20de%20Terca";
const STORAGE_KEY = "fut-terca-players";
const TEAM_PAIR_HISTORY_KEY = "fut-terca-team-pair-history";
const SHEETS_API_URL = (import.meta.env.VITE_SHEETS_API_URL || "").trim();
const DEFAULT_PLAYER_ROLE = "linha";
const DEFAULT_PLAYER_ATTACK = 5;
const DEFAULT_PLAYER_DEFENSE = 5;

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

  return players
    .filter((player) => player && typeof player.name === "string")
    .map((player, index) => ({
      id: Number.isFinite(player.id) ? player.id : index + 1,
      name: player.name,
      goals: Number.isFinite(player.goals) ? player.goals : 0,
      assists: Number.isFinite(player.assists) ? player.assists : 0,
      championships: Number.isFinite(player.championships) ? player.championships : 0,
      attack: sanitizeRating(player.attack ?? player.weight, DEFAULT_PLAYER_ATTACK),
      defense: sanitizeRating(player.defense ?? player.weight, DEFAULT_PLAYER_DEFENSE),
      role: sanitizeRole(player.role),
    }));
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

function updatePairHistoryWithTeams(currentHistory, teams) {
  const nextHistory = Object.fromEntries(
    Object.entries(currentHistory)
      .map(([key, value]) => [key, value * 0.9])
      .filter(([, value]) => value >= 0.05)
  );

  teams.forEach((team) => {
    for (let i = 0; i < team.players.length; i += 1) {
      for (let j = i + 1; j < team.players.length; j += 1) {
        const pairKey = createPairKey(team.players[i].id, team.players[j].id);
        nextHistory[pairKey] = (nextHistory[pairKey] || 0) + 1;
      }
    }
  });

  return nextHistory;
}

function getHiddenLevelScore(player) {
  return (sanitizeRating(player.attack, DEFAULT_PLAYER_ATTACK) + sanitizeRating(player.defense, DEFAULT_PLAYER_DEFENSE)) / 2;
}

function buildBalancedTeams(players, teamsCount, randomSeed, pairHistory = {}) {
  if (!teamsCount) {
    return [];
  }

  const randomSalt = Number.isFinite(randomSeed) ? randomSeed : Date.now();
  const randomByPlayer = (player, teamId = 0) => {
    const base = Math.sin((player.id + 1) * 97 + (teamId + 1) * 37 + randomSalt * 0.001) * 10000;
    return base - Math.floor(base);
  };

  const teams = Array.from({ length: teamsCount }, (_, index) => ({
    id: index + 1,
    name: `Time ${index + 1}`,
    players: [],
    totalAverage: 0,
  }));

  const playersForTeams = players.slice(0, teamsCount * 4);
  const remainingPlayers = [...playersForTeams].sort((a, b) => {
    const averageDiff = getHiddenLevelScore(b) - getHiddenLevelScore(a);
    if (averageDiff !== 0) {
      return averageDiff;
    }

    return randomByPlayer(a) - randomByPlayer(b);
  });

  // Keep the classic snake distribution to prioritize weight balance.
  const snakeOrder = [];
  let teamIndex = 0;
  let direction = 1;

  for (let slot = 0; slot < playersForTeams.length; slot += 1) {
    snakeOrder.push(teamIndex);

    if (direction === 1) {
      if (teamIndex === teams.length - 1) {
        direction = -1;
      } else {
        teamIndex += 1;
      }
    } else if (teamIndex === 0) {
      direction = 1;
    } else {
      teamIndex -= 1;
    }
  }

  const scoreTolerance = 0.55;
  const minimumCandidatePool = 6;

  snakeOrder.forEach((targetTeamIndex) => {
    const team = teams[targetTeamIndex];
    if (!remainingPlayers.length || team.players.length >= 4) {
      return;
    }

    const topScore = getHiddenLevelScore(remainingPlayers[0]);
    let lastCandidateIndex = Math.min(minimumCandidatePool - 1, remainingPlayers.length - 1);

    for (let i = 1; i < remainingPlayers.length; i += 1) {
      if (topScore - getHiddenLevelScore(remainingPlayers[i]) <= scoreTolerance) {
        lastCandidateIndex = i;
      } else {
        break;
      }
    }

    let selectedIndex = 0;
    let selectedCost = Number.POSITIVE_INFINITY;

    for (let i = 0; i <= lastCandidateIndex; i += 1) {
      const candidate = remainingPlayers[i];
      const repeatPenalty = team.players.reduce((acc, teammate) => {
        const pairKey = createPairKey(teammate.id, candidate.id);
        const repeatCount = pairHistory[pairKey] || 0;
        if (repeatCount <= 0) {
          return acc;
        }

        // Strongly discourage repeated pairs while keeping weight as the first filter.
        return acc + repeatCount * repeatCount + 1.5;
      }, 0);
      const noise = randomByPlayer(candidate, team.id) * 0.2;
      const cost = repeatPenalty * 2.2 + noise;

      if (cost < selectedCost) {
        selectedCost = cost;
        selectedIndex = i;
      }
    }

    const [selectedPlayer] = remainingPlayers.splice(selectedIndex, 1);
    team.players.push(selectedPlayer);
    team.totalAverage += getHiddenLevelScore(selectedPlayer);
  });

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
    attack: String(DEFAULT_PLAYER_ATTACK),
    defense: String(DEFAULT_PLAYER_DEFENSE),
    role: DEFAULT_PLAYER_ROLE,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [weeklySearchTerm, setWeeklySearchTerm] = useState("");
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
    attack: String(DEFAULT_PLAYER_ATTACK),
    defense: String(DEFAULT_PLAYER_DEFENSE),
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
        current.attack = Math.max(current.attack, sanitizeRating(player.attack, DEFAULT_PLAYER_ATTACK));
        current.defense = Math.max(current.defense, sanitizeRating(player.defense, DEFAULT_PLAYER_DEFENSE));
        return;
      }
      grouped.set(key, {
        id: player.id,
        name: player.name,
        goals: player.goals,
        assists: player.assists,
        championships: player.championships || 0,
        attack: sanitizeRating(player.attack, DEFAULT_PLAYER_ATTACK),
        defense: sanitizeRating(player.defense, DEFAULT_PLAYER_DEFENSE),
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
    () => [...consolidatedPlayers].sort((a, b) => b.goals - a.goals || b.assists - a.assists).slice(0, 5),
    [consolidatedPlayers]
  );

  const topAssists = useMemo(
    () => [...consolidatedPlayers].sort((a, b) => b.assists - a.assists || b.goals - a.goals).slice(0, 5),
    [consolidatedPlayers]
  );

  const topChampions = useMemo(
    () =>
      [...consolidatedPlayers]
        .sort((a, b) => b.championships - a.championships || b.goals - a.goals || b.assists - a.assists)
        .slice(0, 5),
    [consolidatedPlayers]
  );

  const filteredPlayers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return players;
    }
    return players.filter((player) => player.name.toLowerCase().includes(term));
  }, [players, searchTerm]);

  const displayedPlayers = useMemo(() => {
    const sorted = [...filteredPlayers].sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name, "pt-BR");
      }
      if (sortBy === "goals") {
        return a.goals - b.goals;
      }
      if (sortBy === "assists") {
        return a.assists - b.assists;
      }
      return (a.championships || 0) - (b.championships || 0);
    });

    return sortDirection === "asc" ? sorted : sorted.reverse();
  }, [filteredPlayers, sortBy, sortDirection]);

  const weeklyAvailablePlayers = useMemo(
    () =>
      consolidatedPlayers
        .filter((player) => sanitizeRole(player.role) !== "goleiro")
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
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

  const weeklyTeamsCount = Math.floor(weeklySelectedPlayers.length / 4);
  const weeklyReservePlayers = useMemo(
    () => weeklySelectedPlayers.slice(weeklyTeamsCount * 4),
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
      lines.push(`${team.name} (${team.players.length}/4)`);
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

    lines.push("Goleiros fixos ficam fora da montagem automatica.");

    const message = encodeURIComponent(lines.join("\n"));
    window.open(`https://wa.me/?text=${message}`, "_blank", "noopener,noreferrer");
  }

  function handleAddPlayer(event) {
    event.preventDefault();
    const name = formData.name.trim();
    const goals = Number.parseInt(formData.goals || "0", 10);
    const assists = Number.parseInt(formData.assists || "0", 10);
    const championships = Number.parseInt(formData.championships || "0", 10);
    const attack = sanitizeRating(formData.attack, DEFAULT_PLAYER_ATTACK);
    const defense = sanitizeRating(formData.defense, DEFAULT_PLAYER_DEFENSE);
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
              attack,
              defense,
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
          attack,
          defense,
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
      attack: String(DEFAULT_PLAYER_ATTACK),
      defense: String(DEFAULT_PLAYER_DEFENSE),
      role: DEFAULT_PLAYER_ROLE,
    });
  }

  function toBulkDraft(player) {
    return {
      name: player.name,
      goals: String(player.goals),
      assists: String(player.assists),
      championships: String(player.championships || 0),
      attack: String(sanitizeRating(player.attack, DEFAULT_PLAYER_ATTACK)),
      defense: String(sanitizeRating(player.defense, DEFAULT_PLAYER_DEFENSE)),
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
        attack: sanitizeRating(draft.attack, DEFAULT_PLAYER_ATTACK),
        defense: sanitizeRating(draft.defense, DEFAULT_PLAYER_DEFENSE),
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
      attack: String(sanitizeRating(player.attack, DEFAULT_PLAYER_ATTACK)),
      defense: String(sanitizeRating(player.defense, DEFAULT_PLAYER_DEFENSE)),
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
      attack: String(DEFAULT_PLAYER_ATTACK),
      defense: String(DEFAULT_PLAYER_DEFENSE),
      role: DEFAULT_PLAYER_ROLE,
    });
  }

  function saveEdit(playerId) {
    const name = editDraft.name.trim();
    const goals = Number.parseInt(editDraft.goals || "0", 10);
    const assists = Number.parseInt(editDraft.assists || "0", 10);
    const championships = Number.parseInt(editDraft.championships || "0", 10);
    const attack = sanitizeRating(editDraft.attack, DEFAULT_PLAYER_ATTACK);
    const defense = sanitizeRating(editDraft.defense, DEFAULT_PLAYER_DEFENSE);
    const role = sanitizeRole(editDraft.role);

    const nextPlayers = players.map((player) =>
      player.id === playerId
        ? {
            ...player,
            name: name || player.name,
            goals: Number.isNaN(goals) || goals < 0 ? 0 : goals,
            assists: Number.isNaN(assists) || assists < 0 ? 0 : assists,
            championships: Number.isNaN(championships) || championships < 0 ? 0 : championships,
            attack,
            defense,
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
          <div className="ranking-grid">
            {topScorers.map((player, index) => (
              <article className={`ranking-card${index === 0 ? " top" : ""}`} key={player.name}>
                <div className="ranking-head">
                  <span className="badge-pos">#{index + 1}</span>
                  <Star size={18} />
                </div>
                <h3 className="ranking-name">{player.name}</h3>
                {renderTrophies(player.championships)}
                <div className="ranking-value">{player.goals} gols</div>
                <small>{player.assists} assistencias</small>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="assistencias" className="section-pad">
        <div className="container">
          <div className="section-header">
            <p className="section-eyebrow">Assistencias</p>
            <h2>Lideres de assistencia</h2>
          </div>
          <div className="ranking-grid">
            {topAssists.map((player, index) => (
              <article className={`ranking-card${index === 0 ? " top" : ""}`} key={player.name}>
                <div className="ranking-head">
                  <span className="badge-pos">#{index + 1}</span>
                  <TrendingUp size={18} />
                </div>
                <h3 className="ranking-name">{player.name}</h3>
                {renderTrophies(player.championships)}
                <div className="ranking-value">{player.assists} assistencias</div>
                <small>{player.goals} gols</small>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="campeoes" className="section-pad section-alt">
        <div className="container">
          <div className="section-header">
            <p className="section-eyebrow">Campeoes</p>
            <h2>Ranking de campeoes</h2>
          </div>
          <div className="ranking-grid">
            {topChampions.map((player, index) => (
              <article className={`ranking-card${index === 0 ? " top" : ""}`} key={player.name}>
                <div className="ranking-head">
                  <span className="badge-pos">#{index + 1}</span>
                  <Trophy size={18} />
                </div>
                <h3 className="ranking-name">{player.name}</h3>
                {renderTrophies(player.championships)}
                <div className="ranking-value">{player.championships} titulos</div>
                <small>{player.goals} gols · {player.assists} assistencias</small>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="times" className="section-pad">
        <div className="container">
          <div className="section-header">
            <p className="section-eyebrow">Times equilibrados</p>
            <h2>Montagem automatica por media</h2>
            <p className="sync-note">Os times sao equilibrados pela media entre ataque e defesa.</p>
            <p className="sync-note">Goleiros sao fixos e ficam fora dessa montagem automatica.</p>
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
                return (
                  <label key={player.id} className={`weekly-player-item${checked ? " checked" : ""}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleWeeklyPlayer(player.id)}
                    />
                    <span>{player.name}</span>
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
                <span>{weeklyReservePlayers.length} reserva(s) para completar o próximo time de 4</span>
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
                    <p className="team-meta">{team.players.length}/4 jogadores</p>
                  <ul>
                    {team.players.map((player) => (
                      <li key={player.id}>
                        <span>{player.name}</span>
                        <small>{player.goals}G · {player.assists}A</small>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
              </div>
              {weeklyReservePlayers.length > 0 && (
                <div className="reserve-card">
                  <h3>Reservas para o próximo time</h3>
                  <p className="team-meta">Ficam de fora da montagem atual até fechar 4.</p>
                  <ul>
                    {weeklyReservePlayers.map((player) => (
                      <li key={player.id}>
                        <span>{player.name}</span>
                        <small>{player.goals}G · {player.assists}A</small>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="sync-note">Selecione pelo menos um jogador de linha para montar os times.</p>
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
                Gols
                <input
                  type="number"
                  min="0"
                  value={formData.goals}
                  onChange={(event) => setFormData((current) => ({ ...current, goals: event.target.value }))}
                  placeholder="0"
                />
              </label>
              <label>
                Assistencias
                <input
                  type="number"
                  min="0"
                  value={formData.assists}
                  onChange={(event) => setFormData((current) => ({ ...current, assists: event.target.value }))}
                  placeholder="0"
                />
              </label>
              <label>
                Titulos de campeao
                <input
                  type="number"
                  min="0"
                  value={formData.championships}
                  onChange={(event) => setFormData((current) => ({ ...current, championships: event.target.value }))}
                  placeholder="0"
                />
              </label>
              <label>
                Ataque
                <select
                  value={formData.attack}
                  onChange={(event) => setFormData((current) => ({ ...current, attack: event.target.value }))}
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                  <option value="6">6</option>
                  <option value="7">7</option>
                  <option value="8">8</option>
                  <option value="9">9</option>
                  <option value="10">10</option>
                </select>
              </label>
              <label>
                Defesa
                <select
                  value={formData.defense}
                  onChange={(event) => setFormData((current) => ({ ...current, defense: event.target.value }))}
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                  <option value="6">6</option>
                  <option value="7">7</option>
                  <option value="8">8</option>
                  <option value="9">9</option>
                  <option value="10">10</option>
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
                  <option value="goals">Gols</option>
                  <option value="assists">Assistencias</option>
                  <option value="championships">Titulos</option>
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
                      <th>Ataque</th>
                      <th>Defesa</th>
                      <th>Gols</th>
                      <th>Assistencias</th>
                      <th>Titulos</th>
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
                        <td data-label="Ataque">
                          {isBulkEditing ? (
                            <select
                              className="stat-select"
                              value={bulkDrafts[player.id]?.attack || String(DEFAULT_PLAYER_ATTACK)}
                              onChange={(event) => updateBulkDraftField(player.id, "attack", event.target.value)}
                            >
                              <option value="1">1</option>
                              <option value="2">2</option>
                              <option value="3">3</option>
                              <option value="4">4</option>
                              <option value="5">5</option>
                              <option value="6">6</option>
                              <option value="7">7</option>
                              <option value="8">8</option>
                              <option value="9">9</option>
                              <option value="10">10</option>
                            </select>
                          ) : editingPlayerId === player.id ? (
                            <select
                              className="stat-select"
                              value={editDraft.attack}
                              onChange={(event) => setEditDraft((current) => ({ ...current, attack: event.target.value }))}
                            >
                              <option value="1">1</option>
                              <option value="2">2</option>
                              <option value="3">3</option>
                              <option value="4">4</option>
                              <option value="5">5</option>
                              <option value="6">6</option>
                              <option value="7">7</option>
                              <option value="8">8</option>
                              <option value="9">9</option>
                              <option value="10">10</option>
                            </select>
                          ) : (
                            sanitizeRating(player.attack, DEFAULT_PLAYER_ATTACK)
                          )}
                        </td>
                        <td data-label="Defesa">
                          {isBulkEditing ? (
                            <select
                              className="stat-select"
                              value={bulkDrafts[player.id]?.defense || String(DEFAULT_PLAYER_DEFENSE)}
                              onChange={(event) => updateBulkDraftField(player.id, "defense", event.target.value)}
                            >
                              <option value="1">1</option>
                              <option value="2">2</option>
                              <option value="3">3</option>
                              <option value="4">4</option>
                              <option value="5">5</option>
                              <option value="6">6</option>
                              <option value="7">7</option>
                              <option value="8">8</option>
                              <option value="9">9</option>
                              <option value="10">10</option>
                            </select>
                          ) : editingPlayerId === player.id ? (
                            <select
                              className="stat-select"
                              value={editDraft.defense}
                              onChange={(event) => setEditDraft((current) => ({ ...current, defense: event.target.value }))}
                            >
                              <option value="1">1</option>
                              <option value="2">2</option>
                              <option value="3">3</option>
                              <option value="4">4</option>
                              <option value="5">5</option>
                              <option value="6">6</option>
                              <option value="7">7</option>
                              <option value="8">8</option>
                              <option value="9">9</option>
                              <option value="10">10</option>
                            </select>
                          ) : (
                            sanitizeRating(player.defense, DEFAULT_PLAYER_DEFENSE)
                          )}
                        </td>
                        <td data-label="Gols">
                          {isBulkEditing ? (
                            <input
                              className="stat-input"
                              type="number"
                              min="0"
                              value={bulkDrafts[player.id]?.goals || "0"}
                              onChange={(event) => updateBulkDraftField(player.id, "goals", event.target.value)}
                            />
                          ) : editingPlayerId === player.id ? (
                            <input
                              className="stat-input"
                              type="number"
                              min="0"
                              value={editDraft.goals}
                              onChange={(event) => setEditDraft((current) => ({ ...current, goals: event.target.value }))}
                            />
                          ) : (
                            player.goals
                          )}
                        </td>
                        <td data-label="Assistencias">
                          {isBulkEditing ? (
                            <input
                              className="stat-input"
                              type="number"
                              min="0"
                              value={bulkDrafts[player.id]?.assists || "0"}
                              onChange={(event) => updateBulkDraftField(player.id, "assists", event.target.value)}
                            />
                          ) : editingPlayerId === player.id ? (
                            <input
                              className="stat-input"
                              type="number"
                              min="0"
                              value={editDraft.assists}
                              onChange={(event) => setEditDraft((current) => ({ ...current, assists: event.target.value }))}
                            />
                          ) : (
                            player.assists
                          )}
                        </td>
                        <td data-label="Titulos">
                          {isBulkEditing ? (
                            <input
                              className="stat-input"
                              type="number"
                              min="0"
                              value={bulkDrafts[player.id]?.championships || "0"}
                              onChange={(event) => updateBulkDraftField(player.id, "championships", event.target.value)}
                            />
                          ) : editingPlayerId === player.id ? (
                            <input
                              className="stat-input"
                              type="number"
                              min="0"
                              value={editDraft.championships}
                              onChange={(event) => setEditDraft((current) => ({ ...current, championships: event.target.value }))}
                            />
                          ) : (
                            renderTrophies(player.championships)
                          )}
                        </td>
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
                        <td colSpan="8">Nenhum jogador encontrado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
