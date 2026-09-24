<template>
  <div class="orientacoes-page container">
    <!-- Botão Voltar para o Mapa Multei no topo da tela -->
    <div class="top-nav-bar">
      <NuxtLink to="/multei" class="btn-back-multei" title="Voltar para o mapa interativo do Multei">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round" class="back-icon" aria-hidden="true">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        <span>Voltar para a página Multei</span>
      </NuxtLink>
    </div>

    <!-- Cabeçalho da Página de Orientações Beta -->
    <header class="hero-header">
      <div class="badge-group">
        <span class="badge-pill badge-beta">🧪 Versão Beta Experimental</span>
        <span class="badge-pill">Guia do Beta Tester</span>
      </div>
      <h1 class="page-title">
        Orientações de Uso do <span class="gradient-text">Multei</span>
      </h1>
      <p class="page-subtitle">
        Obrigado por participar dos testes! Conheça o propósito da ferramenta, aprenda a capturar a foto ideal para a nossa Inteligência Artificial e saiba como enviar seu feedback anônimo.
      </p>
    </header>

    <!-- 1. O que é o Multei -->
    <section class="info-card glass-panel" aria-labelledby="sec-about">
      <div class="info-card-header">
        <span class="info-icon" aria-hidden="true">🛡️</span>
        <div>
          <span class="section-tag">O Projeto</span>
          <h2 id="sec-about" class="card-title">O que é o Multei?</h2>
        </div>
      </div>
      <p class="card-text">
        O <strong>Multei</strong> é uma plataforma colaborativa e educativa do portal <strong>Vale PcD</strong> para mapeamento de uso irregular de vagas exclusivas para Pessoas com Deficiência. Nosso objetivo é gerar conscientização cidadã e dados estatísticos sobre acessibilidade urbana — <strong>sem expor dados pessoais</strong>.
      </p>
      <p class="card-text">
        Toda imagem enviada passa por uma camada de visão computacional e Inteligência Artificial que <strong>detecta e desfoca automaticamente placas de veículos e rostos de pessoas</strong> antes de qualquer publicação no mapa. O envio é 100% anônimo.
      </p>
    </section>

    <!-- 2. Como Utilizar para Denunciar & Dica da Foto Ideal -->
    <section class="guide-section" aria-labelledby="sec-how-to">
      <div class="section-heading">
        <span class="section-tag">Passo a Passo</span>
        <h2 id="sec-how-to" class="section-title">Como utilizar a plataforma e tirar a foto ideal</h2>
        <p class="section-desc">
          Para que a Inteligência Artificial compreenda o contexto da vaga e aprove a ocorrência rapidamente, siga estas recomendações:
        </p>
      </div>

      <!-- Destaque da Foto Ideal -->
      <div class="photo-tip-box">
        <div class="photo-tip-badge">📸 Regra de Ouro da Fotografia</div>
        <h3 class="photo-tip-title">O que deve aparecer na foto?</h3>
        <p class="photo-tip-desc">
          A melhor foto para análise da IA é aquela que mostra claramente <strong>o veículo estacionado sobre a vaga junto com a sinalização vertical (placa PcD) ou a pintura de acessibilidade no chão</strong>.
        </p>
        <div class="photo-comparison-grid">
          <div class="comparison-item is-good">
            <div class="comparison-status">✅ Foto Ideal (Recomendada)</div>
            <p>Enquadra o carro ocupando a vaga <strong>e</strong> o símbolo internacional de acesso (no asfalto ou na placa vertical ao fundo).</p>
          </div>
          <div class="comparison-item is-bad">
            <div class="comparison-status">⚠️ Foto Difícil para a IA</div>
            <p>Fotos muito fechadas apenas no para-choque/vidro, sem mostrar que o local é de fato uma vaga regulamentada para PcD.</p>
          </div>
        </div>
      </div>

      <!-- Passos de uso -->
      <div class="steps-grid">
        <div class="step-card">
          <span class="step-number">1</span>
          <h3 class="step-title">Toque em "+ Incluir"</h3>
          <p class="step-text">Na tela do mapa, clique no botão flutuante roxo no canto inferior para iniciar um novo registro.</p>
        </div>

        <div class="step-card">
          <span class="step-number">2</span>
          <h3 class="step-title">Capture ou Envie a Foto</h3>
          <p class="step-text">Tire a foto na hora pela câmera integrada ou escolha da galeria lembrando de incluir a sinalização da vaga + veículo.</p>
        </div>

        <div class="step-card">
          <span class="step-number">3</span>
          <h3 class="step-title">Análise e Anonimização</h3>
          <p class="step-text">Aguarde alguns segundos enquanto a IA verifica a infração e aplica o desfoque (blur) em placas e rostos.</p>
        </div>

        <div class="step-card">
          <span class="step-number">4</span>
          <h3 class="step-title">Confirme o Local no Mapa</h3>
          <p class="step-text">Verifique se o pino está no endereço correto (seu GPS preenche automaticamente) e conclua a publicação!</p>
        </div>
      </div>
    </section>

    <!-- 3. Limites do Gemini & Aviso Experimental -->
    <section class="warning-banner" aria-labelledby="sec-limits">
      <div class="warning-header">
        <span class="warning-icon" aria-hidden="true">⚡</span>
        <div>
          <span class="warning-tag">Importante para Beta Testers</span>
          <h2 id="sec-limits" class="warning-title">Limites da IA Gemini e Natureza Experimental</h2>
        </div>
      </div>

      <ul class="warning-list">
        <li>
          <strong>Sistema Experimental sujeito a falhas:</strong> Esta é uma versão <em>Beta</em>. A IA pode ocasionalmente recusar uma foto válida, demorar alguns segundos extras ou não identificar um ângulo complexo de primeira.
        </li>
        <li>
          <strong>Cotas e Limites do Google Gemini:</strong> Utilizamos a API do Google Gemini para visão computacional. Para evitar sobrecarga e manter a ferramenta gratuita para a comunidade, há um limite de requisições por minuto e um intervalo de segurança (<em>cooldown</em>) após envios consecutivos.
        </li>
        <li>
          <strong>Moderação Comunitária Ativa:</strong> Caso perceba que alguma foto no mapa não borrou adequadamente uma placa ou rosto, clique no pino da ocorrência e utilize o botão <strong>"🚩 Reportar Ocorrência"</strong> para remoção imediata.
        </li>
      </ul>
    </section>

    <!-- 4. Card de Feedback Anônimo -->
    <section class="feedback-cta-card" aria-labelledby="sec-feedback">
      <div class="feedback-content">
        <span class="feedback-badge">💬 Sua opinião constrói o Multei</span>
        <h2 id="sec-feedback" class="feedback-title">Encontrou um bug ou tem uma sugestão?</h2>
        <p class="feedback-desc">
          Como Beta Tester, seu relato é fundamental! Conte para nós se a IA acertou na análise da sua foto, se o GPS funcionou bem no seu aparelho ou o que podemos melhorar. O formulário é rápido e <strong>100% anônimo</strong>.
        </p>
        <div class="feedback-actions">
          <a
            href="https://forms.gle/NiC1PMVnJEdXajjs8"
            target="_blank"
            rel="noopener noreferrer"
            class="btn-feedback-form"
          >
            <span>📝 Responder Formulário de Feedback Anônimo</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="external-icon" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>

          <NuxtLink to="/multei" class="btn-return-secondary">
            Voltar para o Mapa Multei
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
useHead({
  title: 'Orientações para Beta Testers - Multei | Vale PcD',
  meta: [
    {
      name: 'description',
      content: 'Guia de orientações para Beta Testers do Multei: como fotografar vagas PcD, funcionamento experimental da IA Gemini e formulário de feedback anônimo.'
    }
  ]
});
</script>

<style scoped>
.orientacoes-page {
  max-width: 920px;
  margin: 0 auto;
  padding: 2rem 1.25rem 4.5rem;
}

.top-nav-bar {
  margin-bottom: 2rem;
}

.btn-back-multei {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  background: var(--surface, #ffffff);
  color: var(--primary, #86007D);
  font-weight: 700;
  font-size: 0.95rem;
  padding: 0.65rem 1.25rem;
  border-radius: 9999px;
  text-decoration: none;
  border: 1.5px solid rgba(134, 0, 125, 0.25);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  transition: all 0.2s ease;
}

.btn-back-multei:hover {
  background: var(--primary, #86007D);
  color: #ffffff;
  transform: translateX(-3px);
  box-shadow: 0 6px 16px rgba(134, 0, 125, 0.25);
}

.back-icon {
  width: 18px;
  height: 18px;
}

.hero-header {
  text-align: center;
  margin-bottom: 2.5rem;
}

.badge-group {
  display: flex;
  justify-content: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.badge-pill {
  display: inline-block;
  background: rgba(134, 0, 125, 0.1);
  color: var(--primary, #86007D);
  font-weight: 700;
  font-size: 0.78rem;
  padding: 0.35rem 0.9rem;
  border-radius: 9999px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
}

.badge-beta {
  background: #fef3c7;
  color: #b45309;
  border: 1px solid #fde68a;
}

.page-title {
  font-size: clamp(1.9rem, 4vw, 2.65rem);
  font-weight: 800;
  color: var(--text, #1e293b);
  line-height: 1.2;
  margin-bottom: 1rem;
}

.gradient-text {
  background: linear-gradient(135deg, var(--primary, #86007D), #bf4848);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.page-subtitle {
  font-size: 1.08rem;
  color: var(--text-muted, #475466);
  max-width: 720px;
  margin: 0 auto;
  line-height: 1.65;
}

/* Card Sobre o Multei */
.info-card {
  background: var(--surface, #ffffff);
  border: 1px solid rgba(134, 0, 125, 0.16);
  border-radius: 18px;
  padding: 1.75rem 2rem;
  margin-bottom: 3rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
}

.info-card-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.info-icon {
  font-size: 2.2rem;
  line-height: 1;
}

.section-tag {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--primary, #86007D);
  margin-bottom: 0.15rem;
}

.card-title {
  font-size: 1.45rem;
  font-weight: 800;
  color: var(--text, #1e293b);
  margin: 0;
}

.card-text {
  font-size: 1rem;
  color: var(--text-muted, #475569);
  line-height: 1.65;
  margin-bottom: 0.85rem;
}

.card-text:last-child {
  margin-bottom: 0;
}

/* Seção Como Utilizar & Foto Ideal */
.guide-section {
  margin-bottom: 3rem;
}

.section-heading {
  margin-bottom: 1.5rem;
}

.section-title {
  font-size: 1.55rem;
  font-weight: 800;
  color: var(--text, #1e293b);
  margin-bottom: 0.45rem;
}

.section-desc {
  font-size: 1rem;
  color: var(--text-muted, #475466);
  line-height: 1.55;
}

.photo-tip-box {
  background: linear-gradient(135deg, rgba(134, 0, 125, 0.05), rgba(191, 72, 72, 0.05));
  border: 2px solid rgba(134, 0, 125, 0.25);
  border-radius: 18px;
  padding: 1.75rem;
  margin-bottom: 2rem;
}

.photo-tip-badge {
  display: inline-block;
  background: var(--primary, #86007D);
  color: #ffffff;
  font-weight: 700;
  font-size: 0.78rem;
  padding: 0.3rem 0.85rem;
  border-radius: 9999px;
  margin-bottom: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.photo-tip-title {
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--text, #1e293b);
  margin-bottom: 0.5rem;
}

.photo-tip-desc {
  font-size: 1.02rem;
  color: var(--text, #334155);
  line-height: 1.6;
  margin-bottom: 1.25rem;
}

.photo-comparison-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1rem;
}

.comparison-item {
  padding: 1.1rem 1.25rem;
  border-radius: 14px;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.comparison-item.is-good {
  border-left: 5px solid #16a34a;
}

.comparison-item.is-bad {
  border-left: 5px solid #f59e0b;
}

.comparison-status {
  font-weight: 800;
  font-size: 0.92rem;
  margin-bottom: 0.4rem;
  color: var(--text, #1e293b);
}

.comparison-item p {
  font-size: 0.92rem;
  color: var(--text-muted, #475569);
  line-height: 1.5;
  margin: 0;
}

/* Passos em Cards */
.steps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.step-card {
  background: var(--surface, #ffffff);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 14px;
  padding: 1.35rem 1.2rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}

.step-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(134, 0, 125, 0.12);
  color: var(--primary, #86007D);
  font-weight: 800;
  font-size: 0.95rem;
  margin-bottom: 0.75rem;
}

.step-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text, #1e293b);
  margin-bottom: 0.4rem;
}

.step-text {
  font-size: 0.9rem;
  color: var(--text-muted, #475466);
  line-height: 1.5;
  margin: 0;
}

/* Banner de Aviso Experimental & Limites Gemini */
.warning-banner {
  background: #fffbeb;
  border: 1.5px solid #fde68a;
  border-radius: 18px;
  padding: 1.75rem 2rem;
  margin-bottom: 3rem;
}

.warning-header {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  margin-bottom: 1.1rem;
}

.warning-icon {
  font-size: 2rem;
  line-height: 1;
}

.warning-tag {
  display: block;
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #b45309;
}

.warning-title {
  font-size: 1.35rem;
  font-weight: 800;
  color: #92400e;
  margin: 0;
}

.warning-list {
  margin: 0;
  padding-left: 1.25rem;
  color: #78350f;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.warning-list li {
  font-size: 0.96rem;
  line-height: 1.6;
}

/* Card de Feedback Anônimo */
.feedback-cta-card {
  background: linear-gradient(135deg, #1e293b, #0f172a);
  color: #ffffff;
  border-radius: 20px;
  padding: 2.5rem 2rem;
  text-align: center;
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.22);
}

.feedback-badge {
  display: inline-block;
  background: rgba(255, 255, 255, 0.14);
  color: #f8fafc;
  font-weight: 700;
  font-size: 0.8rem;
  padding: 0.35rem 0.95rem;
  border-radius: 9999px;
  margin-bottom: 1rem;
}

.feedback-title {
  font-size: clamp(1.45rem, 3vw, 1.85rem);
  font-weight: 800;
  color: #ffffff;
  margin-bottom: 0.75rem;
}

.feedback-desc {
  font-size: 1.02rem;
  color: #cbd5e1;
  max-width: 640px;
  margin: 0 auto 1.85rem;
  line-height: 1.65;
}

.feedback-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.btn-feedback-form {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  background: linear-gradient(135deg, var(--primary, #86007D), #bf4848);
  color: #ffffff;
  font-weight: 800;
  font-size: 1rem;
  padding: 0.95rem 1.6rem;
  border-radius: 9999px;
  text-decoration: none;
  box-shadow: 0 10px 25px rgba(134, 0, 125, 0.45);
  transition: all 0.25s ease;
}

.btn-feedback-form:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 30px rgba(134, 0, 125, 0.6);
  filter: brightness(1.06);
}

.external-icon {
  width: 18px;
  height: 18px;
}

.btn-return-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  font-weight: 700;
  font-size: 0.95rem;
  padding: 0.95rem 1.4rem;
  border-radius: 9999px;
  text-decoration: none;
  border: 1px solid rgba(255, 255, 255, 0.25);
  transition: all 0.2s ease;
}

.btn-return-secondary:hover {
  background: rgba(255, 255, 255, 0.2);
}

@media (max-width: 640px) {
  .orientacoes-page {
    padding: 1.25rem 1rem 3rem;
  }
  .info-card,
  .photo-tip-box,
  .warning-banner,
  .feedback-cta-card {
    padding: 1.35rem 1.15rem;
  }
  .btn-feedback-form,
  .btn-return-secondary {
    width: 100%;
    justify-content: center;
  }
}
</style>
