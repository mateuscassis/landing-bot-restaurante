// Pure helpers for the weekly round robin and the live match. The state is a plain object so it
// can be stored as-is in Firebase or localStorage.

export const TEAM_COLORS = ["#f5c842", "#4f9dff", "#e05060", "#3dd68c", "#b57bff", "#ff9a3d"];
export const DEFAULT_MATCH_MINUTES = 10;

// Firebase drops empty arrays and may return sparse arrays as objects.
export function asList(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  return value ? Object.values(value) : [];
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// Circle method: every team plays every other team once, spread across rounds.
export function buildRoundRobin(teamIds) {
  const ids = [...teamIds];
  if (ids.length % 2) {
    ids.push(null);
  }
  const rounds = [];
  for (let round = 0; round < ids.length - 1; round += 1) {
    for (let i = 0; i < ids.length / 2; i += 1) {
      const home = ids[i];
      const away = ids[ids.length - 1 - i];
      if (home !== null && away !== null) {
        rounds.push([home, away]);
      }
    }
    ids.splice(1, 0, ids.pop());
  }
  return rounds;
}

export function createTournament(teams, keepers, now) {
  const storedTeams = teams.map((team, index) => ({
    id: team.id,
    name: team.name,
    color: TEAM_COLORS[index % TEAM_COLORS.length],
    players: team.players.map((player) => ({ id: player.id, name: player.name })),
  }));

  return {
    id: makeId("t"),
    createdAt: now,
    teams: storedTeams,
    keepers: keepers.map((player) => ({ id: player.id, name: player.name })),
    matches: buildRoundRobin(storedTeams.map((team) => team.id)).map(([homeId, awayId], index) => ({
      id: `m${index + 1}`,
      number: index + 1,
      homeId,
      awayId,
      status: "pending",
      events: [],
      timer: { durationSec: DEFAULT_MATCH_MINUTES * 60, running: false, startedAt: 0, elapsedMs: 0 },
    })),
    activeMatchId: null,
  };
}

export function getTeams(tournament) {
  return asList(tournament?.teams).map((team) => ({ ...team, players: asList(team.players) }));
}

export function getMatches(tournament) {
  return asList(tournament?.matches).map((match) => ({ ...match, events: asList(match.events) }));
}

export function getMatchScore(match) {
  const score = { home: 0, away: 0 };
  match.events.forEach((event) => {
    if (event.type !== "goal") {
      return;
    }
    if (event.teamId === match.homeId) {
      score.home += 1;
    } else if (event.teamId === match.awayId) {
      score.away += 1;
    }
  });
  return score;
}

export function getStandings(tournament) {
  const table = new Map(
    getTeams(tournament).map((team) => [
      team.id,
      { team, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 },
    ])
  );

  getMatches(tournament)
    .filter((match) => match.status === "finished")
    .forEach((match) => {
      const score = getMatchScore(match);
      const home = table.get(match.homeId);
      const away = table.get(match.awayId);
      if (!home || !away) {
        return;
      }
      home.played += 1;
      away.played += 1;
      home.goalsFor += score.home;
      home.goalsAgainst += score.away;
      away.goalsFor += score.away;
      away.goalsAgainst += score.home;
      if (score.home > score.away) {
        home.wins += 1;
        away.losses += 1;
      } else if (score.home < score.away) {
        away.wins += 1;
        home.losses += 1;
      } else {
        home.draws += 1;
        away.draws += 1;
      }
    });

  return Array.from(table.values())
    .map((row) => ({ ...row, points: row.wins * 3 + row.draws, goalDiff: row.goalsFor - row.goalsAgainst }))
    .sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor);
}

export function getRemainingMs(timer, now) {
  const elapsed = (timer?.elapsedMs || 0) + (timer?.running ? Math.max(0, now - timer.startedAt) : 0);
  return (timer?.durationSec || 0) * 1000 - elapsed;
}

export function formatClock(ms) {
  const negative = ms < 0;
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${negative ? "+" : ""}${minutes}:${seconds}`;
}

// Returns a transaction updater that edits one match. Matches are rewritten as a list so the
// stored shape stays the same in both backends.
export function updateMatch(matchId, edit) {
  return (current) => {
    if (!current) {
      return current;
    }
    const matches = getMatches(current).map((match) => (match.id === matchId ? edit(match) : match));
    return { ...current, matches };
  };
}

export function newEvent(type, player, teamId, now) {
  return { id: makeId("e"), type, playerId: player.id, playerName: player.name, teamId, at: now };
}

export function summarizeEvents(events) {
  const deltas = {};
  events.forEach((event) => {
    const key = event.playerId;
    deltas[key] = deltas[key] || { goals: 0, assists: 0 };
    if (event.type === "goal") {
      deltas[key].goals += 1;
    } else if (event.type === "assist") {
      deltas[key].assists += 1;
    }
  });
  return deltas;
}
