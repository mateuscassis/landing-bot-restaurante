import React, { useEffect, useMemo, useRef, useState } from "react";
import { Shield, Star, TrendingUp, Users, ArrowRight, Menu, X, Zap, UserPlus } from "lucide-react";
import initialPlayers from "./data/players.json";

const groupLink = "https://wa.me/5511999999999?text=Quero%20participar%20do%20Fut%20de%20Terca";

export default function LandingPage() {
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [formData, setFormData] = useState({ name: "", goals: "", assists: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: "", goals: "0", assists: "0" });
  const nextPlayerId = useRef(Math.max(...initialPlayers.map((player) => player.id), 0) + 1);
  const [players, setPlayers] = useState(initialPlayers);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const totalGoals = useMemo(() => players.reduce((acc, player) => acc + player.goals, 0), [players]);
  const totalAssists = useMemo(() => players.reduce((acc, player) => acc + player.assists, 0), [players]);

  const seasonStats = useMemo(() => {
    const avgContribution = players.length ? ((totalGoals + totalAssists) / players.length).toFixed(1) : "0.0";
    return [
      { icon: <Users size={24} />, value: players.length, label: "Jogadores cadastrados" },
      { icon: <Zap size={24} />, value: totalGoals, label: "Gols cadastrados" },
      { icon: <TrendingUp size={24} />, value: totalAssists, label: "Assistencias cadastradas" },
      { icon: <Star size={24} />, value: avgContribution, label: "Media por jogador" },
    ];
  }, [players, totalAssists, totalGoals]);

  const topScorers = useMemo(
    () => [...players].sort((a, b) => b.goals - a.goals || b.assists - a.assists).slice(0, 5),
    [players]
  );

  const topAssists = useMemo(
    () => [...players].sort((a, b) => b.assists - a.assists || b.goals - a.goals).slice(0, 5),
    [players]
  );

  const filteredPlayers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return players;
    }
    return players.filter((player) => player.name.toLowerCase().includes(term));
  }, [players, searchTerm]);

  function handleAddPlayer(event) {
    event.preventDefault();
    const name = formData.name.trim();
    const goals = Number.parseInt(formData.goals || "0", 10);
    const assists = Number.parseInt(formData.assists || "0", 10);
    if (!name) {
      return;
    }

    setPlayers((current) => [
      {
        id: nextPlayerId.current++,
        name,
        goals: Number.isNaN(goals) ? 0 : goals,
        assists: Number.isNaN(assists) ? 0 : assists,
      },
      ...current,
    ]);
    setFormData({ name: "", goals: "", assists: "" });
  }

  function startEdit(player) {
    setEditingPlayerId(player.id);
    setEditDraft({ name: player.name, goals: String(player.goals), assists: String(player.assists) });
  }

  function cancelEdit() {
    setEditingPlayerId(null);
    setEditDraft({ name: "", goals: "0", assists: "0" });
  }

  function saveEdit(playerId) {
    const name = editDraft.name.trim();
    const goals = Number.parseInt(editDraft.goals || "0", 10);
    const assists = Number.parseInt(editDraft.assists || "0", 10);
    setPlayers((current) =>
      current.map((player) =>
        player.id === playerId
          ? {
              ...player,
              name: name || player.name,
              goals: Number.isNaN(goals) || goals < 0 ? 0 : goals,
              assists: Number.isNaN(assists) || assists < 0 ? 0 : assists,
            }
          : player
      )
    );
    cancelEdit();
  }

  function handleDeletePlayer(playerId) {
    const confirmed = window.confirm("Tem certeza que deseja excluir este jogador?");
    if (!confirmed) {
      return;
    }

    setPlayers((current) => current.filter((player) => player.id !== playerId));
    if (editingPlayerId === playerId) {
      cancelEdit();
    }
  }

  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setNavOpen(false);
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
              ["cadastro", "Cadastro"],
              ["artilharia", "Artilharia"],
              ["assistencias", "Assistencias"],
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

      <section id="cadastro" className="section-pad">
        <div className="container">
          <div className="section-header">
            <p className="section-eyebrow">Cadastro</p>
            <h2>Adicionar jogador, gols e assistencias</h2>
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
              <button type="submit" className="btn-primary form-btn">
                <UserPlus size={16} className="me-2" /> Salvar jogador
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
              <div className="players-scroll">
                <table className="simple-table">
                  <thead>
                    <tr>
                      <th>Jogador</th>
                      <th>Gols</th>
                      <th>Assistencias</th>
                      <th>Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlayers.map((player) => (
                      <tr key={player.id}>
                        <td data-label="Jogador">
                          {editingPlayerId === player.id ? (
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
                        <td data-label="Gols">
                          {editingPlayerId === player.id ? (
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
                          {editingPlayerId === player.id ? (
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
                        <td data-label="Acoes">
                          {editingPlayerId === player.id ? (
                            <div className="row-actions">
                              <button className="row-btn save" type="button" onClick={() => saveEdit(player.id)}>Salvar</button>
                              <button className="row-btn cancel" type="button" onClick={cancelEdit}>Cancelar</button>
                            </div>
                          ) : (
                            <div className="row-actions">
                              <button className="row-btn edit" type="button" onClick={() => startEdit(player)}>Editar</button>
                              <button className="row-btn delete" type="button" onClick={() => handleDeletePlayer(player.id)}>Excluir</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!filteredPlayers.length && (
                      <tr>
                        <td colSpan="4">Nenhum jogador encontrado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
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
                <h3>{player.name}</h3>
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
                <h3>{player.name}</h3>
                <div className="ranking-value">{player.assists} assistencias</div>
                <small>{player.goals} gols</small>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="league-footer">
        <div className="container footer-inner">
          <p>Fut de terca - Temporada 2026</p>
        </div>
      </footer>
    </div>
  );
}
