import React, { useState, useEffect } from "react";
import {
  Bot, MessageCircle, CheckCircle, Clock, ClipboardList, ShoppingCart,
  CreditCard, Gift, BarChart2, ChevronDown, ChevronUp, Menu, X,
  Zap, Users, TrendingUp, Phone, ArrowRight, Shield, Headphones,
  Star, Calendar, Bell, Send, Layers, MapPin, Scissors, Heart, Pill
} from "lucide-react";

const whatsappNumber = "5516997594653";
const whatsappLink = `https://wa.me/${whatsappNumber}?text=Ol%C3%A1!%20Tenho%20interesse%20no%20MenuBot%20para%20meu%20neg%C3%B3cio.`;
const setupPrice = "247";
const monthlyPrice = "87";

const faqs = [
  {
    q: "Preciso ter algum conhecimento tecnico?",
    a: "Nao! O MenuBot e configurado inteiramente por nos. Voce so precisa nos passar as informacoes do seu negocio e a gente cuida do resto.",
  },
  {
    q: "Funciona com qualquer tipo de negocio?",
    a: "Sim! Configuramos para restaurantes, barbearias, pet shops, clinicas, lojas, farmacias e qualquer outro comercio que usa WhatsApp.",
  },
  {
    q: "Funciona com qualquer numero de WhatsApp?",
    a: "Sim, funciona com numero pessoal ou WhatsApp Business. Recomendamos o Business para aproveitar recursos extras.",
  },
  {
    q: "Quanto tempo leva para configurar?",
    a: "Em media 2 a 3 dias uteis apos o pagamento do setup e envio das informacoes do seu negocio.",
  },
  {
    q: "E se eu quiser cancelar?",
    a: "Sem fidelidade! Voce pode cancelar a mensalidade a qualquer momento, sem multas ou burocracia.",
  },
  {
    q: "O bot atende fora do horario comercial?",
    a: "Sim! Esse e um dos maiores beneficios. O bot responde 24h por dia, 7 dias por semana, sem voce precisar estar presente.",
  },
  {
    q: "Posso personalizar as mensagens?",
    a: "Com certeza. Adaptamos o tom de voz, as mensagens e os fluxos ao estilo e necessidade do seu negocio.",
  },
  {
    q: "O bot pode fazer agendamentos?",
    a: "Sim! Para negocios como barbearias, clinicas e pet shops, o bot pode gerenciar agendamentos, enviar confirmacoes e lembretes automaticos.",
  },
];

const segments = [
  { icon: <ShoppingCart size={28} />, label: "Restaurantes & Delivery" },
  { icon: <Scissors size={28} />, label: "Barbearias & Saloes" },
  { icon: <Heart size={28} />, label: "Pet Shops & Veterinarios" },
  { icon: <Pill size={28} />, label: "Farmacias & Drogarias" },
  { icon: <Calendar size={28} />, label: "Clinicas & Consultórios" },
  { icon: <Layers size={28} />, label: "Lojas & E-commerce" },
  { icon: <MapPin size={28} />, label: "Servicos & Manutencao" },
  { icon: <Bot size={28} />, label: "Qualquer comercio local" },
];

const stats = [
  { icon: <Users size={28} />, value: "200+", label: "Negocios atendidos" },
  { icon: <MessageCircle size={28} />, value: "50k+", label: "Atendimentos/mes" },
  { icon: <TrendingUp size={28} />, value: "3x", label: "Aumento medio em vendas" },
  { icon: <Clock size={28} />, value: "24h", label: "Atendimento sem parar" },
];

const steps = [
  { num: "01", icon: <Phone size={28} />, title: "Voce entra em contato", desc: "Fale com a gente pelo WhatsApp e nos conta sobre seu negocio." },
  { num: "02", icon: <ClipboardList size={28} />, title: "Enviamos o formulario", desc: "Voce preenche: produtos, servicos, horarios, endereco e formas de pagamento." },
  { num: "03", icon: <Bot size={28} />, title: "Configuramos tudo", desc: "Montamos e testamos o bot personalizado para o seu negocio em ate 3 dias." },
  { num: "04", icon: <Zap size={28} />, title: "Bot no ar!", desc: "Seu negocio passa a atender automaticamente 24h por dia no WhatsApp." },
];

function FAQItem({ q, a }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="faq-item mb-3">
      <button className="faq-question w-100 text-start d-flex justify-content-between align-items-center" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{q}</span>
        {open ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>
      {open && <div className="faq-answer">{a}</div>}
    </div>
  );
}

function StarRating({ count }) {
  return (
    <div className="d-flex gap-1 mb-2">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} size={16} fill="#ffc107" color="#ffc107" />
      ))}
    </div>
  );
}

export default function LandingPage() {
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", business: "", segment: "" });
  const [formSent, setFormSent] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function handleFormSubmit(e) {
    e.preventDefault();
    const { name, phone, business, segment } = formData;
    const msg = encodeURIComponent(
      "Ola! Me chamo *" + name + "* e tenho interesse no MenuBot.\nNegocio: *" + business + "*\nSegmento: *" + segment + "*\nTelefone: *" + phone + "*"
    );
    window.open("https://wa.me/" + whatsappNumber + "?text=" + msg, "_blank", "noopener,noreferrer");
    setFormSent(true);
  }

  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setNavOpen(false);
  }

  return (
    <div className="menubot-root">

      {/* Navbar */}
      <nav className={"menubot-nav" + (scrolled ? " scrolled" : "")}>
        <div className="nav-inner container">
          <button className="nav-brand" onClick={() => scrollTo("hero")} aria-label="Inicio">
            <Bot size={26} className="me-2" /> MenuBot
          </button>
          <div className={"nav-links" + (navOpen ? " open" : "")}>
            {[["Segmentos", "segments"], ["Beneficios", "benefits"], ["Funcionalidades", "features"], ["Como funciona", "how"], ["Preco", "pricing"], ["FAQ", "faq"]].map(([label, id]) => (
              <button key={id} onClick={() => scrollTo(id)} className="nav-link-btn">{label}</button>
            ))}
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="btn-wpp-nav">
              <MessageCircle size={16} className="me-1" /> Falar agora
            </a>
          </div>
          <button className="nav-hamburger" onClick={() => setNavOpen(!navOpen)} aria-label="Menu">
            {navOpen ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section id="hero" className="hero-section">
        <div className="hero-bg-gradient" />
        <div className="container hero-content text-center">
          <div className="hero-badge mb-3">
            <Zap size={14} className="me-1" /> Atendimento automatico 24h no WhatsApp
          </div>
          <h1 className="hero-title">
            Seu negocio<br />
            <span className="hero-highlight">nunca mais perde um cliente</span>
          </h1>
          <p className="hero-subtitle">
            O MenuBot automatiza o atendimento de qualquer comercio pelo WhatsApp — pedidos, agendamentos, orcamentos, pagamentos e muito mais, sem voce precisar estar presente.
          </p>
          <div className="d-flex gap-3 justify-content-center flex-wrap mt-4">
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="btn-hero-primary">
              <MessageCircle size={20} className="me-2" /> Quero meu Bot agora
            </a>
            <button className="btn-hero-secondary" onClick={() => scrollTo("how")}>
              <ArrowRight size={16} className="me-2" /> Como funciona
            </button>
          </div>
          <p className="hero-note mt-3">Sem fidelidade · Setup em ate 3 dias · Suporte local</p>
        </div>
        <div className="hero-wave">
          <svg viewBox="0 0 1440 80" preserveAspectRatio="none"><path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#f8f9fa" /></svg>
        </div>
      </section>

      {/* Stats */}
      <section className="stats-section">
        <div className="container">
          <div className="stats-grid">
            {stats.map((s, i) => (
              <div key={i} className="stat-card">
                <div className="stat-icon">{s.icon}</div>
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Segmentos */}
      <section id="segments" className="section-pad bg-light-custom">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">Para quem e</span>
            <h2 className="section-title">Funciona para qualquer tipo de negocio</h2>
            <p className="section-subtitle">Se voce usa WhatsApp para atender clientes, o MenuBot e para voce.</p>
          </div>
          <div className="segments-grid">
            {segments.map((s, i) => (
              <div key={i} className="segment-card">
                <div className="segment-icon">{s.icon}</div>
                <span className="segment-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Beneficios */}
      <section id="benefits" className="section-pad">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">Beneficios</span>
            <h2 className="section-title">Por que negocios escolhem o MenuBot?</h2>
          </div>
          <div className="benefits-grid">
            <div className="benefit-card benefit-green"><div className="benefit-icon"><Clock size={32} /></div><h5 className="benefit-title">Atendimento 24h</h5><p className="benefit-desc">Nunca perca um cliente fora do horario. O bot responde na hora, sempre.</p></div>
            <div className="benefit-card benefit-blue"><div className="benefit-icon"><CheckCircle size={32} /></div><h5 className="benefit-title">Pedidos sem erro</h5><p className="benefit-desc">O cliente confirma pedido ou agendamento antes de finalizar. Sem ruido.</p></div>
            <div className="benefit-card benefit-orange"><div className="benefit-icon"><TrendingUp size={32} /></div><h5 className="benefit-title">Mais vendas</h5><p className="benefit-desc">Clientes atendidos rapidamente compram mais e voltam com mais frequencia.</p></div>
            <div className="benefit-card benefit-purple"><div className="benefit-icon"><Gift size={32} /></div><h5 className="benefit-title">Fidelizacao automatica</h5><p className="benefit-desc">Cupons e programas de pontos para fazer seu cliente voltar sempre.</p></div>
            <div className="benefit-card benefit-teal"><div className="benefit-icon"><CreditCard size={32} /></div><h5 className="benefit-title">Pagamento integrado</h5><p className="benefit-desc">Pix, cartao ou QR Code direto no WhatsApp, sem sair da conversa.</p></div>
            <div className="benefit-card benefit-red"><div className="benefit-icon"><BarChart2 size={32} /></div><h5 className="benefit-title">Relatorios e insights</h5><p className="benefit-desc">Saiba o que mais vende, horario de pico e ticket medio do seu negocio.</p></div>
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section id="features" className="section-pad bg-dark-custom">
        <div className="container">
          <div className="section-header">
            <span className="section-tag light">Funcionalidades</span>
            <h2 className="section-title light">Tudo que seu negocio precisa</h2>
            <p className="section-subtitle light">Funcionalidades adaptadas para qualquer segmento comercial.</p>
          </div>
          <div className="features-grid">
            <div className="feature-card"><div className="feature-icon"><MessageCircle size={24} /></div><div><h6 className="feature-title">Atendimento automatico</h6><p className="feature-desc">Horario, endereco, precos e duvidas respondidos sem voce precisar digitar nada.</p></div></div>
            <div className="feature-card"><div className="feature-icon"><Calendar size={24} /></div><div><h6 className="feature-title">Agendamento automatico</h6><p className="feature-desc">Clientes agendam horarios diretamente pelo WhatsApp. Ideal para barbearias, clinicas e pet shops.</p></div></div>
            <div className="feature-card"><div className="feature-icon"><Bell size={24} /></div><div><h6 className="feature-title">Lembretes e confirmacoes</h6><p className="feature-desc">Envia lembretes automaticos de agendamento e confirmacoes de pedido para reduzir no-shows.</p></div></div>
            <div className="feature-card"><div className="feature-icon"><ClipboardList size={24} /></div><div><h6 className="feature-title">Catalogo digital</h6><p className="feature-desc">Cardapio, lista de servicos ou catalogo de produtos enviados diretamente no chat, por categorias.</p></div></div>
            <div className="feature-card"><div className="feature-icon"><ShoppingCart size={24} /></div><div><h6 className="feature-title">Pedidos automatizados</h6><p className="feature-desc">Bot monta o pedido, confirma com o cliente e envia para voce por WhatsApp ou planilha.</p></div></div>
            <div className="feature-card"><div className="feature-icon"><Send size={24} /></div><div><h6 className="feature-title">Orcamentos automaticos</h6><p className="feature-desc">Cliente descreve o que precisa e o bot coleta as informacoes e te encaminha o lead qualificado.</p></div></div>
            <div className="feature-card"><div className="feature-icon"><CreditCard size={24} /></div><div><h6 className="feature-title">Pagamento no WhatsApp</h6><p className="feature-desc">Link de pagamento via Pix, cartao ou QR Code sem sair da conversa.</p></div></div>
            <div className="feature-card"><div className="feature-icon"><Gift size={24} /></div><div><h6 className="feature-title">Programa de fidelidade</h6><p className="feature-desc">Pontos, cupons e cashback automaticos para recompensar clientes recorrentes.</p></div></div>
            <div className="feature-card"><div className="feature-icon"><Send size={24} /></div><div><h6 className="feature-title">Campanhas e promocoes</h6><p className="feature-desc">Disparo de mensagens em massa para sua lista de clientes com novidades e ofertas.</p></div></div>
            <div className="feature-card"><div className="feature-icon"><Star size={24} /></div><div><h6 className="feature-title">Avaliacao pos-atendimento</h6><p className="feature-desc">Bot pede avaliacao automatica apos cada atendimento ou entrega para voce monitorar qualidade.</p></div></div>
            <div className="feature-card"><div className="feature-icon"><BarChart2 size={24} /></div><div><h6 className="feature-title">Dashboard de vendas</h6><p className="feature-desc">Servicos mais pedidos, horarios de pico e ticket medio sempre atualizados.</p></div></div>
            <div className="feature-card"><div className="feature-icon"><Headphones size={24} /></div><div><h6 className="feature-title">Transferencia para humano</h6><p className="feature-desc">Quando necessario, o bot transfere o atendimento para voce em um clique.</p></div></div>
            <div className="feature-card"><div className="feature-icon"><MapPin size={24} /></div><div><h6 className="feature-title">Localizacao e rotas</h6><p className="feature-desc">Bot envia endereco, mapa e link do Google Maps automaticamente quando o cliente perguntar.</p></div></div>
            <div className="feature-card"><div className="feature-icon"><Users size={24} /></div><div><h6 className="feature-title">Gestao de lista de clientes</h6><p className="feature-desc">Base de clientes organizada automaticamente a cada novo atendimento, pronta para acoes de marketing.</p></div></div>
            <div className="feature-card"><div className="feature-icon"><Layers size={24} /></div><div><h6 className="feature-title">Integracao com Google Sheets</h6><p className="feature-desc">Pedidos, agendamentos e leads salvos automaticamente em planilhas do Google.</p></div></div>
            <div className="feature-card"><div className="feature-icon"><Shield size={24} /></div><div><h6 className="feature-title">Privacidade e seguranca</h6><p className="feature-desc">Dados dos seus clientes protegidos e sem compartilhamento com terceiros.</p></div></div>
          </div>
        </div>
      </section>

      {/* Como Funciona */}
      <section id="how" className="section-pad bg-light-custom">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">Como funciona</span>
            <h2 className="section-title">Do contato ao bot no ar em 3 dias</h2>
          </div>
          <div className="steps-grid">
            <div className="step-card"><div className="step-num">01</div><div className="step-icon"><Phone size={28} /></div><h5 className="step-title">Voce entra em contato</h5><p className="step-desc">Fale com a gente pelo WhatsApp e nos conta sobre seu negocio.</p></div>
            <div className="step-card"><div className="step-num">02</div><div className="step-icon"><ClipboardList size={28} /></div><h5 className="step-title">Enviamos o formulario</h5><p className="step-desc">Voce preenche: produtos, servicos, horarios, endereco e pagamentos.</p></div>
            <div className="step-card"><div className="step-num">03</div><div className="step-icon"><Bot size={28} /></div><h5 className="step-title">Configuramos tudo</h5><p className="step-desc">Montamos e testamos o bot personalizado para o seu negocio em ate 3 dias.</p></div>
            <div className="step-card"><div className="step-num">04</div><div className="step-icon"><Zap size={28} /></div><h5 className="step-title">Bot no ar!</h5><p className="step-desc">Seu negocio passa a atender automaticamente 24h no WhatsApp.</p></div>
          </div>
        </div>
      </section>

      {/* Preco */}
      <section id="pricing" className="section-pad">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">Preco</span>
            <h2 className="section-title">Simples, justo e sem surpresas</h2>
            <p className="section-subtitle">Um unico plano com tudo incluido para qualquer tipo de negocio.</p>
          </div>
          <div className="pricing-wrapper">
            <div className="pricing-card">
              <div className="pricing-badge">Plano unico completo</div>
              <div className="pricing-icon"><Bot size={40} /></div>
              <h3 className="pricing-name">MenuBot Completo</h3>
              <div className="pricing-setup">Setup inicial: <span>R$ {setupPrice}</span></div>
              <div className="pricing-monthly">
                <span className="pricing-value">R$ {monthlyPrice}</span>
                <span className="pricing-period">/mes</span>
              </div>
              <p className="pricing-note">Menos que R$ 3 por dia para ter um atendente digital 24h no seu negocio.</p>
              <ul className="pricing-features">
                {[
                  "Atendimento automatico 24h",
                  "Catalogo digital de produtos/servicos",
                  "Agendamento automatico",
                  "Lembretes e confirmacoes",
                  "Pedidos, orcamentos e pagamentos",
                  "Programa de fidelidade",
                  "Campanhas e disparos em massa",
                  "Avaliacao pos-atendimento",
                  "Relatorios mensais",
                  "Integracao com Google Sheets",
                  "Suporte local prioritario",
                  "Sem fidelidade - cancele quando quiser",
                ].map((f, i) => (
                  <li key={i}><CheckCircle size={16} className="me-2" />{f}</li>
                ))}
              </ul>
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="btn-pricing">
                <MessageCircle size={18} className="me-2" /> Comecar agora
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Formulario de Lead */}
      <section className="section-pad bg-green-custom" id="contact">
        <div className="container">
          <div className="lead-form-wrapper">
            <div className="lead-form-text">
              <span className="section-tag light">Contato</span>
              <h2 className="section-title light">Pronto para automatizar seu negocio?</h2>
              <p className="lead-desc">Preencha o formulario e entraremos em contato pelo WhatsApp em menos de 1 hora.</p>
            </div>
            <div className="lead-form-box">
              {formSent ? (
                <div className="form-success">
                  <CheckCircle size={48} className="mb-3" />
                  <h4>Mensagem enviada!</h4>
                  <p>Te chamaremos no WhatsApp em breve.</p>
                </div>
              ) : (
                <form onSubmit={handleFormSubmit} autoComplete="off">
                  <div className="mb-3">
                    <label className="form-label">Seu nome *</label>
                    <input type="text" required className="form-control" placeholder="Ex: Joao Silva" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Nome do seu negocio *</label>
                    <input type="text" required className="form-control" placeholder="Ex: Barbearia do Joao" value={formData.business} onChange={e => setFormData({ ...formData, business: e.target.value })} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Segmento *</label>
                    <select required className="form-control" value={formData.segment} onChange={e => setFormData({ ...formData, segment: e.target.value })}>
                      <option value="">Selecione o tipo de negocio...</option>
                      <option>Restaurante / Delivery</option>
                      <option>Barbearia / Salao de Beleza</option>
                      <option>Pet Shop / Veterinario</option>
                      <option>Farmacia / Drogaria</option>
                      <option>Clinica / Consultorio</option>
                      <option>Loja de Roupas / Calcados</option>
                      <option>Servicos / Manutencao</option>
                      <option>Outro</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">WhatsApp *</label>
                    <input type="tel" required className="form-control" placeholder="(11) 99999-9999" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">E-mail</label>
                    <input type="email" className="form-control" placeholder="seuemail@exemplo.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                  <button type="submit" className="btn-form-submit">
                    <MessageCircle size={18} className="me-2" /> Quero meu Bot agora
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="section-pad">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">FAQ</span>
            <h2 className="section-title">Perguntas frequentes</h2>
          </div>
          <div className="faq-wrapper">
            {faqs.map((f, i) => <FAQItem key={i} q={f.q} a={f.a} />)}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="menubot-footer">
        <div className="container text-center">
          <div className="footer-brand mb-2"><Bot size={22} className="me-2" /> MenuBot</div>
          <p className="footer-copy">© {new Date().getFullYear()} MenuBot · Todos os direitos reservados.</p>
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="footer-wpp">
            <MessageCircle size={16} className="me-1" /> Falar pelo WhatsApp
          </a>
        </div>
      </footer>

      {/* Floating WhatsApp button */}
      <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="wpp-float" aria-label="Falar pelo WhatsApp">
        <MessageCircle size={28} />
      </a>
    </div>
  );
}

