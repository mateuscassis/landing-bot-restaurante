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

// Stages: "group" (round robin), then with 4 teams the knockout: "semi", "third" and "final".
export const PLAYOFF_TEAMS = 4;

export function getStage(match) {
  return match.stage || "group";
}

export function getMatchLabel(match) {
  return match.label || `Jogo ${match.number}`;
}

function makeMatch(number, homeId, awayId, extra = {}, durationSec = DEFAULT_MATCH_MINUTES * 60) {
  return {
    id: `m${number}`,
    number,
    stage: "group",
    homeId,
    awayId,
    status: "pending",
    events: [],
    timer: { durationSec, running: false, startedAt: 0, elapsedMs: 0 },
    ...extra,
  };
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
    matches: buildRoundRobin(storedTeams.map((team) => team.id)).map(([homeId, awayId], index) => makeMatch(index + 1, homeId, awayId)),
    activeMatchId: null,
  };
}

// Knockout matches can't end tied: a draw needs winnerId (penalties or the group's own rule).
export function getMatchWinnerId(match) {
  const score = getMatchScore(match);
  if (score.home === score.away) {
    return match.winnerId || null;
  }
  return score.home > score.away ? match.homeId : match.awayId;
}

function getMatchLoserId(match) {
  const winnerId = getMatchWinnerId(match);
  if (!winnerId) {
    return null;
  }
  return winnerId === match.homeId ? match.awayId : match.homeId;
}

// Adds the next knockout round once the previous one is over: semis (1st x 4th, 2nd x 3rd) after the
// group stage, then the 3rd place match and the final after both semis. New matches keep the
// duration of the last one played.
export function withPlayoffs(state) {
  if (!state || getTeams(state).length !== PLAYOFF_TEAMS) {
    return state;
  }
  const matches = getMatches(state);
  const byStage = (stage) => matches.filter((match) => getStage(match) === stage);
  const allFinished = (list) => list.length > 0 && list.every((match) => match.status === "finished");
  const lastDuration = [...matches].reverse().find((match) => match.status === "finished")?.timer?.durationSec;
  const next = [...matches];
  const add = (homeId, awayId, extra) => next.push(makeMatch(next.length + 1, homeId, awayId, extra, lastDuration));

  if (!byStage("semi").length) {
    if (!allFinished(byStage("group"))) {
      return state;
    }
    const table = getStandings(state);
    add(table[0].team.id, table[3].team.id, { stage: "semi", label: "Semifinal 1" });
    add(table[1].team.id, table[2].team.id, { stage: "semi", label: "Semifinal 2" });
    return { ...state, matches: next };
  }

  const semis = byStage("semi");
  if (byStage("final").length || !allFinished(semis) || semis.some((match) => !getMatchWinnerId(match))) {
    return state;
  }
  add(getMatchLoserId(semis[0]), getMatchLoserId(semis[1]), { stage: "third", label: "Disputa de 3º lugar" });
  add(getMatchWinnerId(semis[0]), getMatchWinnerId(semis[1]), { stage: "final", label: "Final" });
  return { ...state, matches: next };
}

// Champion: winner of the final when there is a knockout, otherwise the top of the table once every
// match is over.
export function getChampion(tournament) {
  const matches = getMatches(tournament);
  const teamsById = new Map(getTeams(tournament).map((team) => [team.id, team]));
  const final = matches.find((match) => getStage(match) === "final");
  if (final) {
    return final.status === "finished" ? teamsById.get(getMatchWinnerId(final)) || null : null;
  }
  if (getTeams(tournament).length === PLAYOFF_TEAMS) {
    return null;
  }
  const allFinished = matches.length > 0 && matches.every((match) => match.status === "finished");
  return allFinished ? getStandings(tournament)[0]?.team || null : null;
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
    .filter((match) => match.status === "finished" && getStage(match) === "group")
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
