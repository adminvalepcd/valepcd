<template>
  <div class="home-page">
    <!-- Hero Section -->
    <section class="hero-section flex-center" aria-labelledby="hero-title">
      <div class="container hero-container">
        <h1 id="hero-title" class="hero-heading">
          Somos a <span class="gradient-text">primeira ONG</span> do Brasil
          dedicada ao recorte de Pessoas com Deficiência <span class="gradient-text">PCD LGBTQIA+</span>
        </h1>
        <p class="hero-lead">
          Nossa jornada começou em 2020 com o objetivo de mapear espaços acessíveis (Vale Maps) e crescemos ao criar conteúdos anticapacitistas no Instagram. Hoje, o Vale PcD é uma ONG inovadora e acessível, focada em impactar positivamente a comunidade nas áreas de Saúde, Mercado de Trabalho e Acessibilidade de Espaços e Eventos.
        </p>
        <div class="hero-actions">
          <NuxtLink to="/servicos" class="btn btn-primary">
            Nossos Serviços
          </NuxtLink>
          <NuxtLink to="/sobre" class="btn btn-secondary">
            Conheça Nossa História
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Key Projects Section -->
    <section class="highlights-section" aria-labelledby="highlights-title">
      <div class="container">
        <span class="badge flex-center-self">Nossos Projetos Vitais</span>
        <h2 id="highlights-title" class="section-title text-center">Como impactamos a sociedade</h2>
        <p class="section-subtitle text-center">Atuamos na intersecção entre saúde mental, inclusão territorial e disseminação de conhecimento.</p>
        
        <div class="grid-responsive highlight-grid">
          <!-- Project 1: Psicoterapia -->
          <div class="pillar-card glass pulse-hover">
            <div class="pillar-img-container">
              <img src="/images/saude.webp" alt="Ilustração em 3D de psicoterapia acessível" class="pillar-img" />
            </div>
            <h3>Psicoterapia Acessível</h3>
            <p>Atendimento remoto de psicoterapia com valor social e acessível direcionado para o público PCD e/ou LGBTQIA+. Atendemos a todo o Brasil de forma remota (inclusive com atendimento em LIBRAS).</p>
            <NuxtLink to="/contato" class="link-more">Saber mais &rarr;</NuxtLink>
          </div>
          
          <!-- Project 2: Vale Maps -->
          <div class="pillar-card glass pulse-hover">
            <div class="pillar-img-container">
              <img src="/images/valemaps.webp" alt="Ilustração em 3D de mapa e marcador rosa do Vale Maps" class="pillar-img" />
            </div>
            <h3>Vale Maps</h3>
            <p>O primeiro mapa nacional com informações colaborativas detalhadas sobre recursos de acessibilidade física e atitudinal em estabelecimentos de todo o País.</p>
            <NuxtLink to="/contato" class="link-more">Saber mais &rarr;</NuxtLink>
          </div>
          
          <!-- Project 3: Biblioteca -->
          <div class="pillar-card glass pulse-hover">
            <div class="pillar-img-container">
              <img src="/images/conscientizacao.webp" alt="Ilustração em 3D de estabelecimento com acessibilidade" class="pillar-img" />
            </div>
            <h3>Cartilhas e Informativos</h3>
            <p>Acesse a nossa biblioteca gratuita de cartilhas e informativos práticos e esteja à frente nas melhores práticas de inclusão e acessibilidade para pessoas com deficiência.</p>
            <NuxtLink to="/blog" class="link-more">Acessar Biblioteca &rarr;</NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <!-- Support & Business Solutions Section -->
    <section class="actions-section container" aria-labelledby="actions-title">
      <div class="actions-header">
        <span class="badge flex-center-self">Como Atuamos</span>
        <h2 id="actions-title" class="section-title text-center">Nossas Frentes de Engajamento e Apoio</h2>
        <p class="section-subtitle text-center">Participe ativamente das nossas ações apoiando como pessoa física ou como parceiro corporativo.</p>
      </div>
      <div class="actions-grid">
        <!-- Card 1: Doações/Comunidade -->
        <div class="action-card donate-card glass">
          <span class="badge">Faça a Diferença</span>
          <h2>Ajude a manter nossos projetos</h2>
          <p>
            Sua contribuição financeira ajuda a subsidiar sessões de psicoterapia para pessoas com deficiência LGBTQIA+ de baixa renda, além de manter nossas ferramentas de mapeamento e produção de cartilhas.
          </p>
          <NuxtLink to="/contato" class="btn btn-primary">
            Quero Doar e Apoiar!
          </NuxtLink>
        </div>

        <!-- Card 2: Empresas -->
        <div class="action-card corporate-card glass">
          <span class="badge">Soluções para Empresas</span>
          <h2>Acessibilidade é mais do que um dever</h2>
          <p>
            É uma oportunidade de inovação e responsabilidade social para a sua empresa. Oferecemos mentorias 360º, palestras, painéis estratégicos e contratação inclusiva.
          </p>
          <NuxtLink to="/servicos" class="btn btn-primary">
            Conheça Nossos Serviços
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
useSeoMeta({
  title: 'Vale PCD | Primeira ONG PCD LGBTQIA+ do Brasil',
  description: 'Mapeamento de espaços acessíveis (Vale Maps), atendimento de psicoterapia remota acessível, cartilhas de inclusão e consultoria para empresas.'
})
</script>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding-bottom: 0;
}

.flex-center-self {
  align-self: center;
  margin: 0 auto 1rem auto;
  display: table;
}

/* Hero Section */
.hero-section {
  min-height: calc(100vh - 80px);
  position: relative;
  background: radial-gradient(circle at 90% 10%, rgba(109, 40, 217, 0.15) 0%, transparent 50%),
              radial-gradient(circle at 10% 90%, rgba(219, 39, 119, 0.10) 0%, transparent 50%);
  padding: 5rem 0;
  text-align: center;
}

.hero-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.8rem;
  max-width: 950px;
}

.hero-heading {
  font-size: clamp(2.2rem, 5.5vw, 3.8rem);
  line-height: 1.15;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.hero-lead {
  font-size: clamp(1.1rem, 1.8vw, 1.3rem);
  line-height: 1.7;
  max-width: 820px;
  color: var(--text-muted);
}

.hero-actions {
  display: flex;
  gap: 1.2rem;
  margin-top: 1rem;
  flex-wrap: wrap;
  justify-content: center;
}

/* Highlights */
.section-title {
  font-size: clamp(1.8rem, 3.5vw, 2.6rem);
  font-weight: 800;
  margin-bottom: 0.5rem;
}

.section-subtitle {
  margin-bottom: 3.5rem;
  font-size: 1.15rem;
  color: var(--text-muted);
  max-width: 700px;
  margin-left: auto;
  margin-right: auto;
}

.text-center {
  text-align: center;
}

.highlight-grid {
  margin-top: 2rem;
}

.pillar-card {
  padding: 2.5rem;
  border-radius: var(--radius-xl);
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  border: 1px solid var(--border);
  transition: all var(--transition-smooth);
  text-align: left;
  position: relative;
}

.pillar-card:hover {
  transform: translateY(-10px);
  border-color: var(--primary);
  box-shadow: var(--shadow-md);
}

.pillar-img-container {
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.5rem;
  position: relative;
  z-index: 2;
}

.pillar-img {
  max-height: 150px;
  width: auto;
  object-fit: contain;
  transition: transform var(--transition-smooth), filter var(--transition-smooth);
  filter: drop-shadow(0 10px 15px rgba(0, 0, 0, 0.15));
}

/* Pop-out floating effect on hover */
.pillar-card:hover .pillar-img {
  transform: translateY(-26px) scale(1.22) rotate(-2deg);
  filter: drop-shadow(0 20px 30px rgba(134, 0, 125, 0.35));
}

.pillar-card h3 {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--text);
}

.pillar-card p {
  font-size: 1.05rem;
  line-height: 1.6;
  color: var(--text-muted);
  margin-bottom: 1rem;
}

.link-more {
  color: var(--secondary);
  font-weight: 700;
  text-decoration: none;
  transition: color var(--transition-fast);
  margin-top: auto;
  font-size: 1rem;
}

.link-more:hover {
  color: var(--primary);
}

/* Highlights Section */
.highlights-section {
  min-height: calc(100vh - 80px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5rem 0;
}

/* Actions Section wrapper */
.actions-section {
  min-height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5rem 0;
  gap: 3rem;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2.5rem;
  width: 100%;
}

@media (max-width: 960px) {
  .actions-grid {
    gap: 1.5rem;
  }
}

@media (max-width: 768px) {
  .actions-grid {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
}

.action-card {
  border-radius: var(--radius-2xl);
  padding: 4rem 3rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 1.5rem;
  border: 1px solid var(--border);
  transition: transform var(--transition-smooth), border-color var(--transition-smooth), box-shadow var(--transition-smooth);
  height: 100%;
  justify-content: space-between;
}

.action-card:hover {
  transform: translateY(-6px);
  border-color: var(--primary);
  box-shadow: var(--shadow-md);
}

.donate-card {
  background: linear-gradient(135deg, rgba(219, 39, 119, 0.05), rgba(109, 40, 217, 0.02));
}

.corporate-card {
  background: linear-gradient(135deg, rgba(109, 40, 217, 0.06), rgba(219, 39, 119, 0.04));
}

.action-card h2 {
  font-size: clamp(1.6rem, 2.8vw, 2.2rem);
  font-weight: 800;
  color: var(--text);
}

.action-card p {
  font-size: 1.1rem;
  line-height: 1.7;
  color: var(--text-muted);
  margin-bottom: 1rem;
}

.action-card .btn {
  width: 100%;
  max-width: 300px;
}
</style>
