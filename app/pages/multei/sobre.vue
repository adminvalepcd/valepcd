<template>
  <div class="sobre-page container" :class="{ 'theme-dark': currentTheme === 'dark' }">
    <!-- Barra de Navegação Superior -->
    <div class="top-nav-bar">
      <NuxtLink to="/multei" class="btn-back-multei" title="Voltar para o mapa interativo do Multei">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round" class="back-icon" aria-hidden="true">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        <span>Ir para o Mapa Interativo</span>
      </NuxtLink>

      <NuxtLink to="/multei/orientacoes" class="btn-guide-link">
        <span>📖 Como usar o Multei</span>
      </NuxtLink>
    </div>

    <!-- Hero & Painel de Impacto em Tempo Real -->
    <header class="hero-header">
      <div class="live-status-pill" role="status" aria-live="polite">
        <span class="live-dot" aria-hidden="true"></span>
        <span>Painel em Tempo Real • Dados da Comunidade</span>
      </div>

      <h1 class="page-title">
        O Impacto do <span class="gradient-text">Multei</span> nas Cidades
      </h1>
      <p class="page-subtitle">
        Mapeamento cidadão colaborativo com Inteligência Artificial para denunciar desrespeito às vagas PcD e barreiras de acessibilidade urbana — 100% anônimo.
      </p>
    </header>

    <!-- Seção Principal de Métricas com Grande Destaque Visual -->
    <section class="metrics-showcase" aria-labelledby="metrics-heading">
      <h2 id="metrics-heading" class="sr-only">Indicadores em tempo real do sistema</h2>

      <!-- Card Destaque Principal: Total Geral -->
      <div class="metric-hero-card">
        <div class="metric-hero-glow" aria-hidden="true"></div>
        <div class="metric-hero-content">
          <div class="metric-hero-tag">
            <span class="metric-hero-icon" aria-hidden="true">📍</span>
            <span>Total Geral de Registros Ativos</span>
          </div>
          <div class="metric-hero-value" :class="{ 'is-loading': isLoadingStats }">
            {{ formatNumber(animatedStats.totalGeral) }}
          </div>
          <p class="metric-hero-caption">
            Ocorrências validadas por Inteligência Artificial e mapeadas pela comunidade em defesa da acessibilidade
          </p>
        </div>
        <div class="metric-hero-cta">
          <NuxtLink to="/multei" class="btn-explore-map">
            <span>Explorar Mapa Agora</span>
            <span aria-hidden="true">→</span>
          </NuxtLink>
        </div>
      </div>

      <!-- Grid com as 3 Métricas Detalhadas -->
      <div class="metrics-grid">
        <!-- 1. Infrações de Trânsito -->
        <article class="metric-card card-transito">
          <div class="metric-card-top">
            <span class="metric-badge badge-transito">🚗 Trânsito</span>
            <span class="metric-icon-circle" aria-hidden="true">🚨</span>
          </div>
          <div class="metric-number" :class="{ 'is-loading': isLoadingStats }">
            {{ formatNumber(animatedStats.infracoesTransito) }}
          </div>
          <h3 class="metric-label">Infrações de Trânsito</h3>
          <p class="metric-description">
            Veículos estacionados sem credencial em vagas PcD, bloqueando rampas, calçadas ou faixas de travessia.
          </p>
        </article>

        <!-- 2. Mobilidade Urbana -->
        <article class="metric-card card-urbana">
          <div class="metric-card-top">
            <span class="metric-badge badge-urbana">♿ Acessibilidade</span>
            <span class="metric-icon-circle" aria-hidden="true">🚧</span>
          </div>
          <div class="metric-number" :class="{ 'is-loading': isLoadingStats }">
            {{ formatNumber(animatedStats.mobilidadeUrbana) }}
          </div>
          <h3 class="metric-label">Mobilidade Urbana</h3>
          <p class="metric-description">
            Calçadas quebradas, ausência de rampas, piso tátil danificado, buracos e obstáculos estruturais nas vias.
          </p>
        </article>

        <!-- 3. Resolvidos -->
        <article class="metric-card card-resolvidos">
          <div class="metric-card-top">
            <span class="metric-badge badge-resolvidos">✅ Transformação</span>
            <span class="metric-icon-circle" aria-hidden="true">🎉</span>
          </div>
          <div class="metric-number" :class="{ 'is-loading': isLoadingStats }">
            {{ formatNumber(animatedStats.resolvidos) }}
          </div>
          <h3 class="metric-label">Problemas Resolvidos</h3>
          <p class="metric-description">
            Ocorrências de mobilidade urbana solucionadas ou com reparo registrado e comprovado pelos cidadãos.
          </p>
        </article>
      </div>
    </section>

    <!-- Sobre a Iniciativa e Pilares Tecnológicos -->
    <section class="about-pillars-section" aria-labelledby="pillars-heading">
      <div class="section-header-center">
        <span class="section-tag">Por dentro da plataforma</span>
        <h2 id="pillars-heading" class="section-title">Como o Multei transforma denúncias em conscientização</h2>
      </div>

      <div class="pillars-grid">
        <div class="pillar-card">
          <div class="pillar-icon" aria-hidden="true">🤖</div>
          <h3 class="pillar-title">Validação por IA Gemini</h3>
          <p class="pillar-text">
            Cada foto enviada passa por uma análise automatizada de visão computacional que verifica se há de fato uma infração de trânsito ou barreira arquitetônica antes de ir ao ar.
          </p>
        </div>

        <div class="pillar-card">
          <div class="pillar-icon" aria-hidden="true">🛡️</div>
          <h3 class="pillar-title">Privacidade e Anonimato</h3>
          <p class="pillar-text">
            Placas de veículos e rostos de pedestres são detectados e borrados automaticamente. Nenhum dado pessoal de quem envia a denúncia é coletado ou exibido.
          </p>
        </div>

        <div class="pillar-card">
          <div class="pillar-icon" aria-hidden="true">📊</div>
          <h3 class="pillar-title">Dados para Políticas Públicas</h3>
          <p class="pillar-text">
            Ao mapear os pontos críticos de desrespeito e falta de infraestrutura, criamos um termômetro público para cobrar fiscalização e obras de acessibilidade.
          </p>
        </div>
      </div>
    </section>

    <!-- Seção Preparada para Termos de Uso e Política de Privacidade -->
    <section id="termos-e-privacidade" class="legal-section" aria-labelledby="legal-heading">
      <div class="legal-header">
        <span class="section-tag">Transparência & Governança</span>
        <h2 id="legal-heading" class="section-title">Termos de Uso e Política de Privacidade</h2>
        <p class="legal-subtitle">
          Princípios fundamentais de utilização responsável, proteção de dados (LGPD) e finalidade educativa da plataforma Multei.
        </p>
      </div>

      <div class="legal-cards-grid">
        <div class="legal-card">
          <div class="legal-card-header">
            <span class="legal-card-icon" aria-hidden="true">📜</span>
            <h3 class="legal-card-title">Termos de Uso</h3>
          </div>
          <div class="legal-card-body">
            <p class="legal-paragraph">
              O <strong>Multei</strong> é uma ferramenta colaborativa de caráter estritamente <strong>educativo, informativo e estatístico</strong>. Os registros publicados não substituem o auto de infração lavrado por agentes de trânsito oficiais.
            </p>
            <ul class="legal-list">
              <li>O usuário compromete-se a enviar apenas imagens reais e autênticas de situações presenciadas em vias públicas ou estacionamentos coletivos.</li>
              <li>É vedado o envio de conteúdos ofensivos, fora de contexto ou que tenham como objetivo expor indivíduos.</li>
              <li>Qualquer cidadão pode solicitar a revisão ou remoção imediata de uma ocorrência pelo botão <strong>"Reportar Ocorrência"</strong> diretamente no mapa.</li>
            </ul>
            <span class="legal-status-note">Documento completo de Termos de Uso em atualização.</span>
          </div>
        </div>

        <div class="legal-card">
          <div class="legal-card-header">
            <span class="legal-card-icon" aria-hidden="true">🔒</span>
            <h3 class="legal-card-title">Política de Privacidade (LGPD)</h3>
          </div>
          <div class="legal-card-body">
            <p class="legal-paragraph">
              Construído sob o princípio de <em>Privacy by Design</em>, o Multei adota medidas técnicas para garantir a não identificação de terceiros e o anonimato do colaborador:
            </p>
            <ul class="legal-list">
              <li><strong>Anonimização Visual:</strong> Rostos e placas veiculares recebem desfoque antes do armazenamento definitivo.</li>
              <li><strong>Geolocalização Restrita ao Evento:</strong> As coordenadas GPS são utilizadas exclusivamente para posicionar o pino da ocorrência no mapa e buscar registros próximos.</li>
              <li><strong>Sem Cadastro Pessoal:</strong> Não exigimos nome, e-mail, CPF ou telefone para enviar ou consultar ocorrências.</li>
            </ul>
            <span class="legal-status-note">Documento completo de Política de Privacidade em atualização.</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Banner Final de Chamada para Ação -->
    <section class="bottom-cta-banner">
      <div class="bottom-cta-text">
        <h2 class="bottom-cta-title">Faça parte da mudança na sua cidade</h2>
        <p class="bottom-cta-desc">Viu uma vaga PcD ocupada irregularmente ou uma calçada inacessível? Registre em segundos.</p>
      </div>
      <div class="bottom-cta-buttons">
        <NuxtLink to="/multei" class="btn-cta-primary">
          Abrir Mapa do Multei
        </NuxtLink>
        <NuxtLink to="/multei/orientacoes" class="btn-cta-secondary">
          Ver Guia de Foto Ideal
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue';
import { subscribeToMulteiStats } from '~/services/firebaseService';

const themeCookie = useCookie('theme', { default: () => 'light' });
const currentTheme = useState('theme', () => themeCookie.value || 'light');

useHead({
  title: 'Sobre o Multei e Estatísticas em Tempo Real | Vale PcD',
  meta: [
    {
      name: 'description',
      content: 'Acompanhe em tempo real o número de denúncias de vagas PcD, ocorrências de mobilidade urbana e problemas resolvidos no Multei.'
    }
  ]
});

const isLoadingStats = ref(true);

const stats = ref({
  totalGeral: 0,
  infracoesTransito: 0,
  mobilidadeUrbana: 0,
  resolvidos: 0
});

const animatedStats = reactive({
  totalGeral: 0,
  infracoesTransito: 0,
  mobilidadeUrbana: 0,
  resolvidos: 0
});

let unsubscribeStats = null;
let animationFrameIds = {};

const animateValue = (key, targetValue) => {
  if (typeof window === 'undefined') {
    animatedStats[key] = targetValue;
    return;
  }

  if (animationFrameIds[key]) {
    cancelAnimationFrame(animationFrameIds[key]);
  }

  const startValue = animatedStats[key] || 0;
  const diff = targetValue - startValue;
  if (diff === 0) {
    animatedStats[key] = targetValue;
    return;
  }

  const duration = 650;
  const startTime = performance.now();

  const step = (now) => {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    animatedStats[key] = Math.round(startValue + diff * eased);

    if (progress < 1) {
      animationFrameIds[key] = requestAnimationFrame(step);
    } else {
      animatedStats[key] = targetValue;
    }
  };

  animationFrameIds[key] = requestAnimationFrame(step);
};

const formatNumber = (val) => {
  const num = Number(val) || 0;
  return num.toLocaleString('pt-BR');
};

onMounted(() => {
  unsubscribeStats = subscribeToMulteiStats((incoming) => {
    isLoadingStats.value = false;
    stats.value = incoming;
    animateValue('totalGeral', incoming.totalGeral);
    animateValue('infracoesTransito', incoming.infracoesTransito);
    animateValue('mobilidadeUrbana', incoming.mobilidadeUrbana);
    animateValue('resolvidos', incoming.resolvidos);
  });
});

onBeforeUnmount(() => {
  if (typeof unsubscribeStats === 'function') {
    unsubscribeStats();
  }
  Object.values(animationFrameIds).forEach((id) => {
    if (id) cancelAnimationFrame(id);
  });
});
</script>

<style scoped>
/* ==========================================================================
   TOKENS DE CORES WCAG AAA (>= 7:1 EM AMBOS OS TEMAS CLARO E ESCURO)
   ========================================================================== */
.sobre-page {
  /* Modo Claro (Default) */
  --sp-text-primary: #0f172a;     /* 17.8:1 sobre fundo claro (AAA) */
  --sp-text-secondary: #1e293b;   /* 13.5:1 sobre fundo claro (AAA) */
  --sp-accent-text: #580052;      /* 10.5:1 sobre fundo claro (AAA) */
  --sp-accent-underline: rgba(88, 0, 82, 0.35);

  --sp-surface: #ffffff;
  --sp-surface-alt: #f8fafc;
  --sp-border: #cbd5e1;
  --sp-border-dashed: #64748b;

  --sp-btn-bg: #ffffff;
  --sp-btn-text: #4a044e;         /* 12.8:1 sobre #fff (AAA) */
  --sp-btn-border: #4a044e;
  --sp-btn-hover-bg: #4a044e;
  --sp-btn-hover-text: #ffffff;

  --sp-guide-bg: #f1f5f9;
  --sp-guide-text: #0f172a;       /* 16.5:1 sobre #f1f5f9 (AAA) */
  --sp-guide-border: #64748b;

  --sp-live-bg: #ecfdf5;
  --sp-live-border: #047857;
  --sp-live-text: #064e3b;        /* 9.4:1 sobre #ecfdf5 (AAA) */
  --sp-live-dot: #059669;

  /* Trânsito (Modo Claro) */
  --sp-transito-top: #b91c1c;
  --sp-transito-bg: #fef2f2;
  --sp-transito-border: #991b1b;
  --sp-transito-text: #7f1d1d;    /* 9.2:1 sobre #fef2f2 (AAA) */
  --sp-transito-num: #991b1b;     /* 8.1:1 sobre #ffffff (AAA) */

  /* Mobilidade Urbana (Modo Claro) */
  --sp-urbana-top: #b45309;
  --sp-urbana-bg: #fffbeb;
  --sp-urbana-border: #92400e;
  --sp-urbana-text: #78350f;      /* 9.6:1 sobre #fffbeb (AAA) */
  --sp-urbana-num: #92400e;       /* 7.2:1 sobre #ffffff (AAA) */

  /* Resolvidos (Modo Claro) */
  --sp-resolvidos-top: #047857;
  --sp-resolvidos-bg: #ecfdf5;
  --sp-resolvidos-border: #065f46;
  --sp-resolvidos-text: #064e3b;  /* 9.4:1 sobre #ecfdf5 (AAA) */
  --sp-resolvidos-num: #065f46;   /* 7.7:1 sobre #ffffff (AAA) */

  max-width: 1020px;
  margin: 0 auto;
  padding: 2rem 1.25rem 5rem;
}

/* Modo Escuro — ativado tanto via classe reativa .theme-dark quanto via [data-theme="dark"] */
.sobre-page.theme-dark,
:global([data-theme="dark"] .sobre-page) {
  --sp-text-primary: #ffffff;     /* 19.1:1 sobre #0f131a / 17.4:1 sobre #171c26 (AAA) */
  --sp-text-secondary: #f1f5f9;   /* 17.2:1 sobre #0f131a / 15.6:1 sobre #171c26 (AAA) */
  --sp-accent-text: #f5d0fe;      /* 12.5:1 sobre #0f131a / 11.8:1 sobre #171c26 (AAA) */
  --sp-accent-underline: rgba(245, 208, 254, 0.45);

  --sp-surface: #171c26;
  --sp-surface-alt: #0f131a;
  --sp-border: #334155;
  --sp-border-dashed: #94a3b8;

  --sp-btn-bg: #171c26;
  --sp-btn-text: #f5d0fe;         /* 11.8:1 sobre #171c26 (AAA) */
  --sp-btn-border: #f0abfc;
  --sp-btn-hover-bg: #f0abfc;
  --sp-btn-hover-text: #0f172a;   /* 11.8:1 sobre #f0abfc (AAA) */

  --sp-guide-bg: #171c26;
  --sp-guide-text: #ffffff;       /* 17.4:1 sobre #171c26 (AAA) */
  --sp-guide-border: #64748b;

  --sp-live-bg: #022c22;
  --sp-live-border: #6ee7b7;
  --sp-live-text: #ecfdf5;        /* 14.1:1 sobre #022c22 (AAA) */
  --sp-live-dot: #34d399;

  /* Trânsito (Modo Escuro) */
  --sp-transito-top: #f87171;
  --sp-transito-bg: #450a0a;
  --sp-transito-border: #fca5a5;
  --sp-transito-text: #fef2f2;    /* 13.2:1 sobre #450a0a (AAA) */
  --sp-transito-num: #fca5a5;     /* 8.9:1 sobre #171c26 (AAA) */

  /* Mobilidade Urbana (Modo Escuro) */
  --sp-urbana-top: #fbbf24;
  --sp-urbana-bg: #451a03;
  --sp-urbana-border: #fcd34d;
  --sp-urbana-text: #fffbeb;      /* 13.6:1 sobre #451a03 (AAA) */
  --sp-urbana-num: #fde68a;       /* 13.4:1 sobre #171c26 (AAA) */

  /* Resolvidos (Modo Escuro) */
  --sp-resolvidos-top: #34d399;
  --sp-resolvidos-bg: #022c22;
  --sp-resolvidos-border: #6ee7b7;
  --sp-resolvidos-text: #ecfdf5;  /* 14.1:1 sobre #022c22 (AAA) */
  --sp-resolvidos-num: #6ee7b7;   /* 11.2:1 sobre #171c26 (AAA) */
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Navegação Superior */
.top-nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 2.25rem;
}

.btn-back-multei {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  background: var(--sp-btn-bg);
  color: var(--sp-btn-text);
  font-weight: 800;
  font-size: 0.95rem;
  padding: 0.65rem 1.25rem;
  border-radius: 9999px;
  text-decoration: none;
  border: 2px solid var(--sp-btn-border);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  transition: all 0.2s ease;
}

.btn-back-multei:hover {
  background: var(--sp-btn-hover-bg);
  color: var(--sp-btn-hover-text);
  transform: translateX(-3px);
}

.back-icon {
  width: 18px;
  height: 18px;
}

.btn-guide-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--sp-guide-bg);
  color: var(--sp-guide-text);
  border: 1.5px solid var(--sp-guide-border);
  font-weight: 700;
  font-size: 0.9rem;
  padding: 0.6rem 1.15rem;
  border-radius: 9999px;
  text-decoration: none;
  transition: all 0.2s ease;
}

.btn-guide-link:hover {
  background: var(--sp-btn-hover-bg);
  color: var(--sp-btn-hover-text);
  border-color: var(--sp-btn-border);
}

/* Hero */
.hero-header {
  text-align: center;
  margin-bottom: 2.5rem;
}

.live-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.45rem 1.05rem;
  border-radius: 9999px;
  background: var(--sp-live-bg);
  border: 1.5px solid var(--sp-live-border);
  color: var(--sp-live-text);
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-bottom: 1.1rem;
}

.live-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--sp-live-dot);
  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  animation: pulse-live 1.8s infinite;
}

@keyframes pulse-live {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  }
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 9px rgba(16, 185, 129, 0);
  }
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
  }
}

.page-title {
  font-size: clamp(2rem, 4.5vw, 3.1rem);
  font-weight: 900;
  line-height: 1.12;
  margin: 0 0 0.9rem;
  color: var(--sp-text-primary);
  letter-spacing: -0.02em;
}

.gradient-text {
  color: var(--sp-accent-text);
  text-decoration: underline;
  text-decoration-color: var(--sp-accent-underline);
  text-underline-offset: 6px;
}

.page-subtitle {
  max-width: 720px;
  margin: 0 auto;
  font-size: 1.1rem;
  line-height: 1.65;
  color: var(--sp-text-secondary);
}

/* Destaque de Métricas */
.metrics-showcase {
  margin-bottom: 3.5rem;
}

.metric-hero-card {
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #2e0231 0%, #4a044e 60%, #580052 100%);
  color: #ffffff;
  border-radius: 26px;
  padding: 2.5rem 2.25rem;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  border: 2px solid rgba(255, 255, 255, 0.22);
  box-shadow: 0 22px 45px -12px rgba(74, 4, 78, 0.45);
}

.metric-hero-glow {
  position: absolute;
  top: -80px;
  right: -80px;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(240, 171, 252, 0.2) 0%, transparent 70%);
  pointer-events: none;
}

.metric-hero-content {
  position: relative;
  z-index: 1;
  max-width: 620px;
}

.metric-hero-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.38rem 0.95rem;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.5);
  color: #ffffff;
  font-size: 0.82rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 0.85rem;
}

.metric-hero-value {
  font-size: clamp(3.5rem, 8vw, 5.5rem);
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.03em;
  margin-bottom: 0.65rem;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
}

.metric-hero-caption {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.55;
  color: #ffffff;
  font-weight: 500;
}

.metric-hero-cta {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}

.btn-explore-map {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  background: #ffffff;
  color: #3b0764;
  font-weight: 800;
  font-size: 1rem;
  padding: 1rem 1.65rem;
  border-radius: 9999px;
  text-decoration: none;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.28);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.btn-explore-map:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.38);
}

/* Grid das 3 métricas secundárias */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
}

.metric-card {
  position: relative;
  background: var(--sp-surface);
  border-radius: 22px;
  padding: 1.75rem 1.5rem;
  border: 1.5px solid var(--sp-border);
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.metric-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.1);
}

.card-transito {
  border-top: 6px solid var(--sp-transito-top);
}

.card-urbana {
  border-top: 6px solid var(--sp-urbana-top);
}

.card-resolvidos {
  border-top: 6px solid var(--sp-resolvidos-top);
}

.metric-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

/* Pills de Tipo de Infração — Contraste AAA */
.metric-badge {
  display: inline-block;
  padding: 0.35rem 0.85rem;
  border-radius: 9999px;
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.badge-transito {
  background: var(--sp-transito-bg);
  border: 1.5px solid var(--sp-transito-border);
  color: var(--sp-transito-text);
}

.badge-urbana {
  background: var(--sp-urbana-bg);
  border: 1.5px solid var(--sp-urbana-border);
  color: var(--sp-urbana-text);
}

.badge-resolvidos {
  background: var(--sp-resolvidos-bg);
  border: 1.5px solid var(--sp-resolvidos-border);
  color: var(--sp-resolvidos-text);
}

.metric-icon-circle {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  border: 1px solid var(--sp-border);
  background: var(--sp-surface-alt);
}

.metric-number {
  font-size: clamp(2.6rem, 5vw, 3.6rem);
  font-weight: 900;
  line-height: 1.05;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  margin-bottom: 0.5rem;
}

.card-transito .metric-number {
  color: var(--sp-transito-num);
}

.card-urbana .metric-number {
  color: var(--sp-urbana-num);
}

.card-resolvidos .metric-number {
  color: var(--sp-resolvidos-num);
}

.is-loading {
  opacity: 0.7;
}

.metric-label {
  font-size: 1.18rem;
  font-weight: 800;
  margin: 0 0 0.5rem;
  color: var(--sp-text-primary);
}

.metric-description {
  margin: 0;
  font-size: 0.94rem;
  line-height: 1.55;
  color: var(--sp-text-secondary);
}

/* Seção de Pilares */
.about-pillars-section {
  margin-bottom: 3.5rem;
}

.section-header-center {
  text-align: center;
  margin-bottom: 2rem;
}

.section-tag {
  display: inline-block;
  font-size: 0.82rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--sp-accent-text);
  margin-bottom: 0.4rem;
}

.section-title {
  font-size: clamp(1.45rem, 3vw, 2rem);
  font-weight: 800;
  margin: 0;
  color: var(--sp-text-primary);
}

.pillars-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
}

.pillar-card {
  background: var(--sp-surface);
  border: 1.5px solid var(--sp-border);
  border-radius: 18px;
  padding: 1.6rem 1.4rem;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.04);
}

.pillar-icon {
  font-size: 2rem;
  margin-bottom: 0.75rem;
}

.pillar-title {
  font-size: 1.1rem;
  font-weight: 800;
  margin: 0 0 0.5rem;
  color: var(--sp-text-primary);
}

.pillar-text {
  margin: 0;
  font-size: 0.94rem;
  line-height: 1.6;
  color: var(--sp-text-secondary);
}

/* Seção Termos de Uso e Política de Privacidade */
.legal-section {
  background: var(--sp-surface);
  border: 1.5px solid var(--sp-border);
  border-radius: 24px;
  padding: 2.25rem 2rem;
  margin-bottom: 3rem;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
}

.legal-header {
  margin-bottom: 1.75rem;
}

.legal-subtitle {
  margin: 0.5rem 0 0;
  font-size: 1rem;
  color: var(--sp-text-secondary);
  line-height: 1.55;
}

.legal-cards-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}

.legal-card {
  background: var(--sp-surface-alt);
  border: 1.5px solid var(--sp-border);
  border-radius: 18px;
  padding: 1.6rem;
  display: flex;
  flex-direction: column;
}

.legal-card-header {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-bottom: 0.9rem;
}

.legal-card-icon {
  font-size: 1.5rem;
}

.legal-card-title {
  font-size: 1.18rem;
  font-weight: 800;
  margin: 0;
  color: var(--sp-text-primary);
}

.legal-card-body {
  font-size: 0.95rem;
  line-height: 1.65;
  color: var(--sp-text-primary);
  display: flex;
  flex-direction: column;
  flex: 1;
}

.legal-paragraph {
  margin: 0 0 0.9rem;
  font-size: 0.95rem;
  line-height: 1.65;
  color: var(--sp-text-primary);
}

.legal-list {
  margin: 0 0 1.1rem;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  color: var(--sp-text-primary);
}

.legal-status-note {
  margin-top: auto;
  display: inline-block;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--sp-text-secondary);
  padding-top: 0.8rem;
  border-top: 1px dashed var(--sp-border-dashed);
}

/* CTA Final ("Faça parte da mudança na sua cidade") */
.bottom-cta-banner {
  background: linear-gradient(135deg, #1e1b4b 0%, #3b0764 100%);
  color: #ffffff;
  border-radius: 22px;
  padding: 2.25rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  flex-wrap: wrap;
  border: 2px solid rgba(255, 255, 255, 0.22);
}

.bottom-cta-title {
  margin: 0 0 0.45rem;
  font-size: 1.5rem;
  font-weight: 800;
  color: #ffffff;
}

.bottom-cta-desc {
  margin: 0;
  color: #f8fafc;
  font-size: 1rem;
  line-height: 1.5;
}

.bottom-cta-buttons {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  flex-wrap: wrap;
}

.btn-cta-primary {
  background: #ffffff;
  color: #3b0764;
  font-weight: 800;
  font-size: 0.96rem;
  padding: 0.9rem 1.55rem;
  border-radius: 9999px;
  text-decoration: none;
  transition: transform 0.2s ease;
}

.btn-cta-primary:hover {
  transform: translateY(-2px);
}

.btn-cta-secondary {
  background: rgba(0, 0, 0, 0.38);
  color: #ffffff;
  border: 2px solid #ffffff;
  font-weight: 700;
  font-size: 0.96rem;
  padding: 0.88rem 1.45rem;
  border-radius: 9999px;
  text-decoration: none;
  transition: background 0.2s ease;
}

.btn-cta-secondary:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Responsividade */
@media (max-width: 860px) {
  .metric-hero-card {
    flex-direction: column;
    align-items: flex-start;
    padding: 2rem 1.6rem;
  }

  .metrics-grid,
  .pillars-grid,
  .legal-cards-grid {
    grid-template-columns: 1fr;
  }

  .bottom-cta-banner {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
