import React from "react";
import { Bot, MessageCircle, CheckCircle, Clock, DollarSign, Utensils, ClipboardList, ShoppingCart, CreditCard, Gift, BarChart2, Star } from "lucide-react";

const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER;
const whatsappLink = `https://wa.me/${whatsappNumber}?text=Olá!%20Tenho%20interesse%20no%20MenuBot%20para%20meu%20restaurante.`;
const setupPrice = import.meta.env.VITE_SETUP_PRICE;
const monthlyPrice = import.meta.env.VITE_MONTHLY_PRICE;

export default function LandingPage() {
  return (
    <div className="bg-light min-vh-100 py-5">
      <div className="container">
        {/* Header */}
        <div className="text-center mb-5">
          <h1 className="display-4 fw-bold text-success">
            <Bot size={40} className="me-2" />
            MenuBot
          </h1>
          <p className="lead text-secondary">
            O bot mais acessível para restaurantes de todos os tipos!
          </p>
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="btn btn-success btn-lg mt-3 shadow">
            Quero meu Bot agora <MessageCircle size={20} className="ms-2" />
          </a>
        </div>

        {/* Benefícios */}
        <div className="text-center mb-5">
          <h3 className="fw-bold">BENEFÍCIOS</h3>
          <div className="d-flex justify-content-center gap-4 flex-wrap">
            <div className="card shadow-sm border-success flex-fill" style={{ minWidth: "220px", maxWidth: "260px" }}>
              <div className="card-body">
                <h5 className="card-title text-success">
                  <Clock size={24} className="me-2" /> Atendimento rápido
                </h5>
                <p className="card-text">Mesmo fora do horário comercial.</p>
              </div>
            </div>
            <div className="card shadow-sm border-warning flex-fill" style={{ minWidth: "220px", maxWidth: "260px" }}>
              <div className="card-body">
                <h5 className="card-title text-warning">
                  <CheckCircle size={24} className="me-2" /> Redução de erros
                </h5>
                <p className="card-text">Pedidos automatizados e sem falhas.</p>
              </div>
            </div>
            <div className="card shadow-sm border-primary flex-fill" style={{ minWidth: "220px", maxWidth: "260px" }}>
              <div className="card-body">
                <h5 className="card-title text-primary">
                  <Utensils size={24} className="me-2" /> Mais vendas
                </h5>
                <p className="card-text">Clientes fiéis e recorrentes.</p>
              </div>
            </div>
            <div className="card shadow-sm border-info flex-fill" style={{ minWidth: "220px", maxWidth: "260px" }}>
              <div className="card-body">
                <h5 className="card-title text-info">
                  <DollarSign size={24} className="me-2" /> Preço justo
                </h5>
                <p className="card-text">Suporte local e preço acessível.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Preço */}
        <div className="text-center mb-5">
          <h3 className="fw-bold">PREÇO JUSTO</h3>
          <p className="fs-5">
            <strong>Setup inicial:</strong> <span className="text-success">R$ {setupPrice}</span><br />
            <strong>Mensalidade:</strong> <span className="text-success">R$ {monthlyPrice}/mês</span>
          </p>
          <p className="fst-italic">Menos que uma pizza por dia para ter um atendente digital 24h.</p>
        </div>

        {/* Explicação do Produto */}
        <div className="mb-5">
          <h3 className="fw-bold text-center mb-4">Como o MenuBot pode transformar seu restaurante</h3>
          <div className="row g-4">
            <div className="col-md-6">
              <div className="d-flex align-items-start mb-3">
                <span className="me-3 text-success"><MessageCircle size={32} /></span>
                <div>
                  <h5 className="fw-bold mb-1">1. Atendimento automatizado no WhatsApp</h5>
                  <ul className="mb-0">
                    <li>Respostas automáticas para perguntas comuns: horário, endereço, cardápio.</li>
                    <li>Atendimento fora do horário para não perder clientes.</li>
                  </ul>
                </div>
              </div>
              <div className="d-flex align-items-start mb-3">
                <span className="me-3 text-primary"><ClipboardList size={32} /></span>
                <div>
                  <h5 className="fw-bold mb-1">2. Cardápio digital interativo</h5>
                  <ul className="mb-0">
                    <li>Cardápio enviado por PDF.</li>
                    <li>Navegação por categorias (“Pizzas”, “Bebidas”, “Sobremesas”).</li>
                  </ul>
                </div>
              </div>
              <div className="d-flex align-items-start mb-3">
                <span className="me-3 text-warning"><ShoppingCart size={32} /></span>
                <div>
                  <h5 className="fw-bold mb-1">3. Pedidos automatizados</h5>
                  <ul className="mb-0">
                    <li>Cliente escolhe itens, bot monta o pedido e envia resumo.</li>
                    <li>Integração com delivery, impressora da cozinha ou planilha Google Sheets.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="d-flex align-items-start mb-3">
                <span className="me-3 text-info"><CreditCard size={32} /></span>
                <div>
                  <h5 className="fw-bold mb-1">4. Pagamentos</h5>
                  <ul className="mb-0">
                    <li>Geração de link de pagamento via Pix, cartão ou QR Code.</li>
                    <li>Cliente paga antes, reduz desistências e agiliza entrega.</li>
                  </ul>
                </div>
              </div>
              <div className="d-flex align-items-start mb-3">
                <span className="me-3 text-danger"><Gift size={32} /></span>
                <div>
                  <h5 className="fw-bold mb-1">5. Programas de fidelidade</h5>
                  <ul className="mb-0">
                    <li>Cupons de desconto ou brindes automáticos.</li>
                    <li>Exemplo: “Junte 10 pizzas e ganhe 1 grátis”.</li>
                  </ul>
                </div>
              </div>
              <div className="d-flex align-items-start mb-3">
                <span className="me-3 text-secondary"><BarChart2 size={32} /></span>
                <div>
                  <h5 className="fw-bold mb-1">6. Relatórios e insights</h5>
                  <ul className="mb-0">
                    <li>Quantos clientes pediram, pratos mais vendidos, ticket médio.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <h5 className="fw-bold text-success"><Star size={24} className="me-2" />Por que MenuBot é diferente?</h5>
            <ul>
              <li>Bots atuais são caros e complicados. O MenuBot é simples, barato e direto.</li>
              <li>Atendimento local e personalizado para cada restaurante.</li>
              <li>Modelo de negócio: setup inicial acessível e mensalidade recorrente.</li>
              <li>Expanda para lanchonetes, pizzarias, hamburguerias e mais!</li>
            </ul>
          </div>
        </div>

        {/* CTA Final */}
        <div className="text-center mb-5" id="cta">
          <h2 className="fw-bold text-success">
            Não perca mais clientes. Comece hoje mesmo com o MenuBot no WhatsApp.
          </h2>
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="btn btn-success btn-lg mt-3 shadow">
            Quero meu Bot agora <MessageCircle size={20} className="ms-2" />
          </a>
        </div>
      </div>
    </div>
  );
}