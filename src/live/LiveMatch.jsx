import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Pause, Play, RotateCcw, Trophy, X } from "lucide-react";
import { liveStore } from "./liveStore";
import {
  asList,
  formatClock,
  getChampion,
  getMatchLabel,
  getMatches,
  getMatchScore,
  getMatchWinnerId,
  getRemainingMs,
  getStage,
  getStandings,
  getTeams,
  newEvent,
  PLAYOFF_TEAMS,
  summarizeEvents,
  updateMatch,
  withPlayoffs,
} from "./tournament";
import "./tournament.css";

export function useLiveTournament() {
  const [tournament, setTournament] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const unsubscribe = liveStore.subscribe((value) => {
      setTournament(value || null);
      setIsReady(true);
    });
    return unsubscribe;
  }, []);

  return { tournament, isReady };
}

function useNow(active) {
  const [now, setNow] = useState(() => liveStore.now());
  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const intervalId = setInterval(() => setNow(liveStore.now()), 250);
    return () => clearInterval(intervalId);
  }, [active]);
  return now;
}

function playWhistle() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContextClass();
    [0, 0.35, 0.7].forEach((offset) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 2200;
      gain.gain.setValueAtTime(0.25, context.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + offset + 0.3);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + offset);
      oscillator.stop(context.currentTime + offset + 0.3);
    });
  } catch {
    // Audio may be blocked until the user interacts with the page.
  }
  try {
    navigator.vibrate?.([400, 150, 400, 150, 800]);
  } catch {
    // Vibration is not available everywhere.
  }
}

function useWakeLock(enabled) {
  useEffect(() => {
    if (!enabled || !navigator.wakeLock) {
      return undefined;
    }
    let lock = null;
    let released = false;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        lock = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible" && !released) {
        request();
      }
    };
    request();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisibility);
      lock?.release().catch(() => {});
    };
  }, [enabled]);
}

export function startMatch(tournament, matchId) {
  const current = getMatches(tournament).find((match) => match.status === "live" && match.id !== matchId);
  if (current && !window.confirm(`A partida ${current.number} ainda esta em andamento. Comecar outra mesmo assim?`)) {
    return;
  }
  liveStore.update((state) => {
    if (!state) {
      return state;
    }
    const next = updateMatch(matchId, (match) => (match.status === "pending" ? { ...match, status: "live" } : match))(state);
    return { ...next, activeMatchId: matchId };
  });
}

export function TournamentSection({ tournament, onReset, onAwardTitle, onOpenMatch }) {
  const teams = getTeams(tournament);
  const matches = getMatches(tournament);
  const standings = getStandings(tournament);
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const keepers = asList(tournament.keepers);
  const champion = getChampion(tournament);
  const groupMatches = matches.filter((match) => getStage(match) === "group");
  const knockoutMatches = matches.filter((match) => getStage(match) !== "group");
  const hasPlayoffs = teams.length === PLAYOFF_TEAMS;

  function renderMatchRow(match) {
    const home = teamsById.get(match.homeId);
    const away = teamsById.get(match.awayId);
    const score = getMatchScore(match);
    const winnerId = match.status === "finished" ? getMatchWinnerId(match) : null;
    const wonOnTiebreak = match.status === "finished" && Boolean(match.winnerId) && score.home === score.away;
    return (
      <div key={match.id} className={`tournament-match tournament-match--${match.status} tournament-match--${getStage(match)}`}>
        <span className="tournament-match__number">{getStage(match) === "group" ? `#${match.number}` : ""}</span>
        {getStage(match) !== "group" && <span className="tournament-match__label">{getMatchLabel(match)}</span>}
        <span className={`tournament-match__team${winnerId === match.homeId ? " is-winner" : ""}`} style={{ "--team-color": home?.color }}>{home?.name}</span>
        <span className="tournament-match__score">
          {match.status === "pending" ? "x" : `${score.home} x ${score.away}`}
          {wonOnTiebreak && <small className="tournament-match__tiebreak">pen.</small>}
        </span>
        <span className={`tournament-match__team${winnerId === match.awayId ? " is-winner" : ""}`} style={{ "--team-color": away?.color }}>{away?.name}</span>
        {match.status === "pending" && (
          <button type="button" className="btn-primary tournament-match__btn" onClick={() => startMatch(tournament, match.id)}>
            Comecar partida
          </button>
        )}
        {match.status === "live" && (
          <button type="button" className="tournament-match__btn tournament-match__btn--live" onClick={() => onOpenMatch(match.id)}>
            Ao vivo
          </button>
        )}
        {match.status === "finished" && <span className="tournament-match__done">Encerrada</span>}
      </div>
    );
  }

  return (
    <div className="tournament">
      <div className="tournament-head">
        <div>
          <h3>Chaveamento da semana</h3>
          <p className="sync-note">
            {liveStore.mode === "firebase"
              ? "Ao vivo: todo mundo que abrir o app ve as partidas e o placar em tempo real."
              : "Modo local: o placar ao vivo so aparece neste navegador (configure o Firebase para compartilhar)."}
          </p>
          {keepers.length > 0 && (
            <p className="sync-note">Goleiros: {keepers.map((keeper) => keeper.name).join(" e ")}</p>
          )}
        </div>
        <button type="button" className="sort-toggle" onClick={onReset}>Novo chaveamento</button>
      </div>

      <div className="tournament-teams">
        {teams.map((team) => (
          <div key={team.id} className="tournament-team" style={{ "--team-color": team.color }}>
            <strong>{team.name}</strong>
            <span>{team.players.map((player) => player.name).join(", ")}</span>
          </div>
        ))}
      </div>

      <div className="tournament-grid">
        <div className="tournament-matches">
          <h4 className="tournament-stage-title">Fase de grupos</h4>
          {groupMatches.map(renderMatchRow)}
        </div>

        <div>
          <h4 className="tournament-stage-title">Classificacao</h4>
          <div className="players-scroll">
            <table className="simple-table tournament-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Time</th>
                  <th>P</th>
                  <th>J</th>
                  <th>V</th>
                  <th>E</th>
                  <th>D</th>
                  <th>SG</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, index) => (
                  <tr key={row.team.id}>
                    <td>{index + 1}º</td>
                    <td><span className="team-dot" style={{ background: row.team.color }} />{row.team.name}</td>
                    <td><strong>{row.points}</strong></td>
                    <td>{row.played}</td>
                    <td>{row.wins}</td>
                    <td>{row.draws}</td>
                    <td>{row.losses}</td>
                    <td>{row.goalDiff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {hasPlayoffs && (
        <div className="tournament-matches tournament-knockout">
          <h4 className="tournament-stage-title">Mata-mata</h4>
          {knockoutMatches.length ? (
            knockoutMatches.map(renderMatchRow)
          ) : (
            <p className="sync-note">Semifinais (1º x 4º e 2º x 3º) aparecem quando a fase de grupos terminar.</p>
          )}
          {knockoutMatches.length > 0 && knockoutMatches.every((match) => getStage(match) === "semi") && (
            <p className="sync-note">Final e disputa de 3º lugar aparecem quando as duas semifinais terminarem.</p>
          )}
        </div>
      )}

      {champion && (
        <div className="tournament-champion">
          <Trophy size={20} />
          <span>Campeao da semana: <strong>{champion.name}</strong></span>
          {tournament.titleAwarded ? (
            <span className="tournament-match__done">Titulo registrado</span>
          ) : (
            <button type="button" className="btn-primary" onClick={() => onAwardTitle(champion)}>
              Dar titulo aos campeoes
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function LiveMatchBar({ tournament, onOpen }) {
  const match = getMatches(tournament).find((item) => item.id === tournament?.activeMatchId);
  if (!match || match.status !== "live") {
    return null;
  }
  const teamsById = new Map(getTeams(tournament).map((team) => [team.id, team]));
  const score = getMatchScore(match);
  return (
    <button type="button" className="live-bar" onClick={() => onOpen(match.id)}>
      <span className="live-dot" /> Ao vivo: {teamsById.get(match.homeId)?.name} {score.home} x {score.away} {teamsById.get(match.awayId)?.name}
    </button>
  );
}

export function MatchScreen({ tournament, matchId, onMinimize, onCommitStats }) {
  const match = getMatches(tournament).find((item) => item.id === matchId);
  const teamsById = useMemo(() => new Map(getTeams(tournament).map((team) => [team.id, team])), [tournament]);
  const now = useNow(Boolean(match));
  const whistledRef = useRef(false);
  const [pickingWinner, setPickingWinner] = useState(false);
  useWakeLock(Boolean(match));

  const remainingMs = match ? getRemainingMs(match.timer, now) : 0;
  const isOvertime = remainingMs <= 0;

  useEffect(() => {
    if (match?.timer?.running && isOvertime && !whistledRef.current) {
      whistledRef.current = true;
      playWhistle();
    }
    if (!isOvertime) {
      whistledRef.current = false;
    }
  }, [isOvertime, match?.timer?.running]);

  if (!match) {
    return null;
  }

  const home = teamsById.get(match.homeId);
  const away = teamsById.get(match.awayId);
  const score = getMatchScore(match);
  const timer = match.timer || {};
  const editable = match.status === "live";
  const isKnockout = getStage(match) !== "group";
  const update = (edit) => liveStore.update(updateMatch(matchId, edit));

  function toggleTimer() {
    const at = liveStore.now();
    update((current) => {
      const currentTimer = current.timer || {};
      if (currentTimer.running) {
        return {
          ...current,
          timer: { ...currentTimer, running: false, elapsedMs: (currentTimer.elapsedMs || 0) + Math.max(0, at - currentTimer.startedAt) },
        };
      }
      return { ...current, timer: { ...currentTimer, running: true, startedAt: at } };
    });
  }

  function resetTimer() {
    if (!window.confirm("Zerar o cronometro?")) {
      return;
    }
    update((current) => ({ ...current, timer: { ...current.timer, running: false, startedAt: 0, elapsedMs: 0 } }));
  }

  function setMinutes(value) {
    const minutes = Math.max(1, Math.min(90, Number.parseInt(value, 10) || 1));
    update((current) => ({ ...current, timer: { ...current.timer, durationSec: minutes * 60 } }));
  }

  function addEvent(type, player, teamId) {
    const event = newEvent(type, player, teamId, liveStore.now());
    event.clockMs = Math.max(0, (timer.durationSec || 0) * 1000 - remainingMs);
    update((current) => ({ ...current, events: [...asList(current.events), event] }));
  }

  function removeEvent(eventId) {
    update((current) => ({ ...current, events: asList(current.events).filter((event) => event.id !== eventId) }));
  }

  function endMatch() {
    // A knockout match can't end tied: ask who went through before finishing.
    if (isKnockout && score.home === score.away) {
      setPickingWinner(true);
      return;
    }
    if (!window.confirm(`Encerrar partida: ${home?.name} ${score.home} x ${score.away} ${away?.name}? Os gols e assistencias entram nas estatisticas da temporada.`)) {
      return;
    }
    finishMatch(null);
  }

  async function finishMatch(winnerId) {
    setPickingWinner(false);
    const at = liveStore.now();
    let finishedEvents = null;
    await liveStore.update((state) => {
      finishedEvents = null;
      if (!state) {
        return state;
      }
      const target = getMatches(state).find((item) => item.id === matchId);
      if (!target || target.status !== "live") {
        return state;
      }
      finishedEvents = target.events;
      const next = updateMatch(matchId, (current) => {
        const currentTimer = current.timer || {};
        const elapsedMs = (currentTimer.elapsedMs || 0) + (currentTimer.running ? Math.max(0, at - currentTimer.startedAt) : 0);
        return {
          ...current,
          status: "finished",
          ...(winnerId ? { winnerId } : {}),
          timer: { ...currentTimer, running: false, elapsedMs },
        };
      })(state);
      // Creates the next knockout round (semis, then 3rd place + final) when this match closes a round.
      return withPlayoffs({ ...next, activeMatchId: state.activeMatchId === matchId ? null : state.activeMatchId });
    });
    // Only the phone whose transaction actually finished the match writes to the season stats.
    if (finishedEvents) {
      onCommitStats(summarizeEvents(finishedEvents));
    }
    onMinimize();
  }

  function cancelMatch() {
    if (!window.confirm("Cancelar a partida? O placar e os eventos desta partida serao apagados.")) {
      return;
    }
    liveStore.update((state) => {
      if (!state) {
        return state;
      }
      const next = updateMatch(matchId, (current) => ({
        ...current,
        status: "pending",
        events: [],
        timer: { ...current.timer, running: false, startedAt: 0, elapsedMs: 0 },
      }))(state);
      return { ...next, activeMatchId: state.activeMatchId === matchId ? null : state.activeMatchId };
    });
    onMinimize();
  }

  function renderTeam(team) {
    if (!team) {
      return null;
    }
    return (
      <div className="match-team" style={{ "--team-color": team.color }}>
        <h3>{team.name}</h3>
        <ul>
          {team.players.map((player) => {
            const goals = match.events.filter((event) => event.type === "goal" && event.playerId === player.id).length;
            const assists = match.events.filter((event) => event.type === "assist" && event.playerId === player.id).length;
            return (
              <li key={player.id}>
                <div className="match-player">
                  <span className="match-player__name">{player.name}</span>
                  <span className="match-player__stats">
                    {goals > 0 && <span>⚽{goals}</span>}
                    {assists > 0 && <span>🅰️{assists}</span>}
                  </span>
                </div>
                {editable && (
                  <div className="match-player__actions">
                    <button type="button" className="match-btn match-btn--goal" onClick={() => addEvent("goal", player, team.id)}>+ Gol</button>
                    <button type="button" className="match-btn" onClick={() => addEvent("assist", player, team.id)}>+ Assist.</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  const events = [...match.events].reverse();

  return (
    <div className="match-screen" role="dialog" aria-label="Partida ao vivo">
      <div className="match-top">
        <button type="button" className="match-icon-btn" onClick={onMinimize} aria-label="Minimizar partida">
          <ChevronDown size={22} />
        </button>
        <span className="match-title">
          {match.status === "live" ? <><span className="live-dot" /> {getMatchLabel(match)}</> : `${getMatchLabel(match)} - encerrada`}
        </span>
        <span className="match-mode">{liveStore.mode === "firebase" ? "ao vivo" : "local"}</span>
      </div>

      <div className={`match-clock${isOvertime ? " match-clock--over" : ""}`}>{formatClock(remainingMs)}</div>

      {editable && (
        <div className="match-clock-controls">
          <button type="button" className="match-icon-btn match-icon-btn--primary" onClick={toggleTimer} aria-label={timer.running ? "Pausar" : "Iniciar"}>
            {timer.running ? <Pause size={22} /> : <Play size={22} />}
          </button>
          <button type="button" className="match-icon-btn" onClick={resetTimer} aria-label="Zerar cronometro">
            <RotateCcw size={20} />
          </button>
          <label className="match-minutes">
            <input
              type="number"
              min="1"
              max="90"
              value={Math.round((timer.durationSec || 0) / 60)}
              disabled={timer.running}
              onChange={(event) => setMinutes(event.target.value)}
            />
            min
          </label>
        </div>
      )}

      <div className="match-score">
        <span style={{ color: home?.color }}>{home?.name}</span>
        <strong>{score.home} x {score.away}</strong>
        <span style={{ color: away?.color }}>{away?.name}</span>
      </div>

      <div className="match-teams">
        {renderTeam(home)}
        {renderTeam(away)}
      </div>

      {events.length > 0 && (
        <ul className="match-events">
          {events.map((event) => (
            <li key={event.id}>
              <span className="match-events__time">{formatClock(event.clockMs || 0)}</span>
              <span>{event.type === "goal" ? "⚽ Gol" : "🅰️ Assist."} de {event.playerName}</span>
              <span className="team-dot" style={{ background: teamsById.get(event.teamId)?.color }} />
              {editable && (
                <button type="button" className="match-icon-btn match-icon-btn--small" onClick={() => removeEvent(event.id)} aria-label="Desfazer">
                  <X size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && pickingWinner && (
        <div className="match-tiebreak" role="group" aria-label="Quem passou">
          <p><strong>Empate!</strong> Quem passou? (penaltis ou a regra de voces)</p>
          <div className="match-tiebreak__options">
            {[home, away].map((team) => team && (
              <button
                type="button"
                key={team.id}
                className="match-tiebreak__team"
                style={{ "--team-color": team.color }}
                onClick={() => finishMatch(team.id)}
              >
                {team.name}
              </button>
            ))}
          </div>
          <button type="button" className="row-btn cancel" onClick={() => setPickingWinner(false)}>Voltar</button>
        </div>
      )}

      {editable && !pickingWinner && (
        <div className="match-footer">
          <button type="button" className="row-btn cancel" onClick={cancelMatch}>Cancelar partida</button>
          <button type="button" className="btn-primary" onClick={endMatch}>Encerrar partida</button>
        </div>
      )}
    </div>
  );
}
