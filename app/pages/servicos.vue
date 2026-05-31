<template>
  <div class="servicos-page container">
    <section class="section header-section" aria-labelledby="services-page-title">
      <span class="badge">O que fazemos</span>
      <h1 id="services-page-title" class="title">
        Nossas Soluções para <span class="gradient-text">Empresas & Eventos</span>
      </h1>
      <p class="lead text-muted">
        Trabalhamos na intersecção de diversidade, inclusão e acessibilidade digital. Conectamos marcas, pessoas e cultura anticapacitista de verdade.
      </p>
    </section>

    <!-- Accessible Tabs system -->
    <div class="tabs-container">
      <div class="tab-list" role="tablist" aria-label="Nossos Serviços e Histórico">
        <button 
          id="tab-empresas"
          role="tab" 
          :aria-selected="(activeTab === 'empresas').toString()"
          aria-controls="panel-empresas"
          :class="['tab-btn', { active: activeTab === 'empresas' }]"
          @click="activeTab = 'empresas'"
        >
          🏢 Para Empresas (Consultoria)
        </button>
        <button 
          id="tab-portfolio"
          role="tab" 
          :aria-selected="(activeTab === 'portfolio').toString()"
          aria-controls="panel-portfolio"
          :class="['tab-btn', { active: activeTab === 'portfolio' }]"
          @click="activeTab = 'portfolio'"
        >
          🎉 Portfólio de Eventos
        </button>
      </div>

      <!-- Panel 1: Para Empresas -->
      <div 
        id="panel-empresas" 
        role="tabpanel" 
        aria-labelledby="tab-empresas"
        v-show="activeTab === 'empresas'"
        class="tab-panel"
      >
        <div class="section-intro">
          <span class="badge">Transforme sua Cultura</span>
          <h2>Como impulsionamos o seu negócio:</h2>
          <p class="text-muted">Acessibilidade é mais do que um dever - É uma oportunidade real para sua empresa.</p>
        </div>

        <div class="services-grid">
          <!-- Mentoria 360 -->
          <div class="service-card glass">
            <div class="service-icon">🎯</div>
            <h3>Mentoria 360º</h3>
            <p>
              Nosso conhecimento abrange pesquisa em Diversidade & Inclusão, Engajamento e Branding, bem como estratégias para tornar produtos e soluções mais acessíveis a clientes e usuários. Nossa mentoria perpassa produto, liderança, colaboradores, gestão de pessoas, comunidade, parceiros, comitês e grupos de pertencimento.
            </p>
          </div>

          <!-- Palestras -->
          <div class="service-card glass">
            <div class="service-icon">🎤</div>
            <h3>Palestras</h3>
            <p>
              Nossos consultores trazem provocações e soluções práticas acerca dos temas de Diversidade, Inclusão e Employee Experience com foco interseccional, servindo como impulsionadores essenciais para a mudança de cultura e mindset no seu negócio.
            </p>
          </div>

          <!-- Roda de Conversa -->
          <div class="service-card glass">
            <div class="service-icon">🗣️</div>
            <h3>Rodas de Conversa</h3>
            <p>
              Criamos discussões horizontais e colaborativas alinhadas às necessidades da sua empresa. Priorizamos bate-papos que estimulam a troca de conhecimento sincera e respondem às principais dúvidas dos colaboradores.
            </p>
          </div>

          <!-- Painel Estratégico -->
          <div class="service-card glass">
            <div class="service-icon">👥</div>
            <h3>Painéis Estratégicos & Formação</h3>
            <p>
              Formação dinâmica e compartilhada conduzida por múltiplos consultores especializados. Cruzamos conceitos e experiências vividas em primeira pessoa na intersecção entre LGBTQIA+ e PCD, indo muito além dos métodos tradicionais.
            </p>
          </div>

          <!-- Vagas e Atração -->
          <div class="service-card glass">
            <div class="service-icon">🚀</div>
            <h3>Atração & Vagas Inclusivas</h3>
            <p>
              Nossas redes ultrapassam bolhas de mercado. Com uma comunidade engajada de milhares de seguidores no país, apoiamos a estratégia de sua marca empregadora com time criativo de design e social media para conectar profissionais diversos ao seu time.
            </p>
          </div>
        </div>

        <!-- CTA e Métricas -->
        <div class="impact-box glass text-center">
          <div class="impact-metric">
            <span class="metric-number">+30</span>
            <span class="metric-label">Grandes festivais e eventos nacionais tornados acessíveis com o Vale PCD</span>
          </div>
          <div class="impact-cta">
            <h3>Faça parte dessa transformação com o Vale</h3>
            <NuxtLink to="/contato" class="btn btn-primary">Chame a gente no Fale Conosco</NuxtLink>
          </div>
        </div>
      </div>

      <!-- Panel 2: Portfólio de Eventos -->
      <div 
        id="panel-portfolio" 
        role="tabpanel" 
        aria-labelledby="tab-portfolio"
        v-show="activeTab === 'portfolio'"
        class="tab-panel"
      >
        <div class="section-intro">
          <span class="badge">Case de Sucesso</span>
          <h2>Eventos e Festivais Acessíveis</h2>
          <p class="text-muted">Abaixo, destacamos alguns dos principais projetos, festivais e tours nacionais que contaram com a curadoria de acessibilidade do Vale PCD.</p>
          
          <!-- Simple Filter Toolbar -->
          <div class="filter-bar" aria-label="Filtrar eventos por ano">
            <button 
              v-for="year in ['Todos', '2023', '2022', '2021']" 
              :key="year"
              :class="['filter-btn', { active: selectedYear === year }]"
              @click="selectedYear = year"
            >
              {{ year }}
            </button>
          </div>
        </div>

        <div class="portfolio-grid">
          <article 
            v-for="event in filteredEvents" 
            :key="event.name" 
            class="portfolio-card glass"
          >
            <div class="portfolio-image-wrapper">
              <img 
                :src="event.image" 
                :alt="'Flyer do evento ' + event.name"
                class="portfolio-image"
                loading="lazy"
              />
              <div class="portfolio-badge">{{ event.year }}</div>
            </div>
            <div class="portfolio-body">
              <h3>{{ event.name }}</h3>
              <time :datetime="event.dateISO" class="event-date">📅 {{ event.dateFormatted }}</time>
            </div>
          </article>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

useSeoMeta({
  title: 'Consultoria e Portfólio de Eventos | Vale PCD',
  description: 'Soluções em acessibilidade digital, palestras, consultoria corporativa interseccional e nosso amplo histórico de grandes eventos nacionais acessíveis.'
})

const activeTab = ref('empresas')
const selectedYear = ref('Todos')

const events = [
  { name: 'La Folie Festival 2023', year: '2023', dateFormatted: '25 de novembro de 2023', dateISO: '2023-11-25', image: '/images/portfolio/la-folie-festival-2023.png' },
  { name: 'Marina Sena - Vício Inerente Tour', year: '2023', dateFormatted: '29 de julho de 2023', dateISO: '2023-07-29', image: '/images/portfolio/marina-sena-vicio-inerente-tour.jpg' },
  { name: 'Dia Mundial de Conscientização do Autismo 2023', year: '2023', dateFormatted: '2 de abril de 2023', dateISO: '2023-04-02', image: '/images/portfolio/dia-mundial-de-conscientizacao-do-autismo-2023.jpg' },
  { name: 'Sofar Floripa', year: '2023', dateFormatted: '1 de março de 2023', dateISO: '2023-03-01', image: '/images/portfolio/sofar-floripa.jpg' },
  { name: 'Festival Saravá', year: '2023', dateFormatted: '21 de janeiro de 2023', dateISO: '2023-01-21', image: '/images/portfolio/festival-sarava.jpg' },
  { name: 'Bloco do Silva', year: '2023', dateFormatted: '14 de janeiro de 2023', dateISO: '2023-01-14', image: '/images/portfolio/bloco-do-silva.jpeg' },
  { name: 'Tarantina', year: '2023', dateFormatted: '13 de janeiro de 2023', dateISO: '2023-01-13', image: '/images/portfolio/tarantina.jpeg' },
  { name: 'Carnaval Parador 2023', year: '2023', dateFormatted: '19 de fevereiro de 2023', dateISO: '2023-02-19', image: '/images/portfolio/carnaval-parador-2023.jpeg' },
  { name: 'Olinda Beer 2023', year: '2023', dateFormatted: '12 de fevereiro de 2023', dateISO: '2023-02-12', image: '/images/portfolio/olinda-beer-2023.jpeg' },
  { name: 'Reveião Golarrolê 2023', year: '2023', dateFormatted: '14 de janeiro de 2023', dateISO: '2023-01-14', image: '/images/portfolio/reveiao-golarrole-2023.jpg' },
  { name: 'Festival do Futuro', year: '2023', dateFormatted: '1 de janeiro de 2023', dateISO: '2023-01-01', image: '/images/portfolio/festival-do-futuro.jpg' },
  
  { name: 'Batidão de Natal', year: '2022', dateFormatted: '24 de dezembro de 2022', dateISO: '2022-12-24', image: '/images/portfolio/batidao-de-natal.jpg' },
  { name: 'La Folie Festival 2022', year: '2022', dateFormatted: '26 de novembro de 2022', dateISO: '2022-11-26', image: '/images/portfolio/la-folie-festival-2022.jpg' },
  { name: 'No Ar Coquetel Molotov', year: '2022', dateFormatted: '19 de novembro de 2022', dateISO: '2022-11-19', image: '/images/portfolio/no-ar-coquetel-molotov.jpg' },
  { name: 'Transborda - As Linguagens da Cena', year: '2022', dateFormatted: '18 de novembro de 2022', dateISO: '2022-11-18', image: '/images/portfolio/transborda-as-linguagens-da-cena.jpg' },
  { name: 'Terça do Vinil', year: '2022', dateFormatted: '11 de outubro de 2022', dateISO: '2022-10-11', image: '/images/portfolio/terca-do-vinil.jpg' },
  { name: 'ODARA ÔDESCE 10 anos | com SILVA', year: '2022', dateFormatted: '8 de outubro de 2022', dateISO: '2022-10-08', image: '/images/portfolio/odara-odesce-10-anos-com-silva.jpg' },
  { name: 'Limonada Pop Renaissance', year: '2022', dateFormatted: '30 de julho de 2022', dateISO: '2022-07-30', image: '/images/portfolio/limonada-pop-renaissance.jpg' },
  { name: 'Romero Ferro - Turnê Encerramento Álbum Ferro', year: '2022', dateFormatted: '1 de maio de 2022', dateISO: '2022-05-01', image: '/images/portfolio/romero-ferro-turne-de-encerramento-do-album-ferro.webp' },
  { name: 'ODARA ÔDESCE + REC BEAT apresentam Marina Sena', year: '2022', dateFormatted: '13 de maio de 2022', dateISO: '2022-05-13', image: '/images/portfolio/odara-odesce-rec-beat-apresentam-marina-sena.png' },
  { name: 'Carvalheira na Ladeira', year: '2022', dateFormatted: '15 de abril de 2022', dateISO: '2022-04-15', image: '/images/portfolio/carvalheira-na-ladeira.jpg' },
  { name: 'ARVO Festival', year: '2022', dateFormatted: '15 de abril de 2022', dateISO: '2022-04-15', image: '/images/portfolio/arvo-festival.webp' },
  { name: 'Baile da Anaconda', year: '2022', dateFormatted: '19 de março de 2022', dateISO: '2022-03-19', image: '/images/portfolio/baile-da-anaconda.jpg' },
  { name: 'Prêmio Biscoito 2022', year: '2022', dateFormatted: '28 de junho de 2022', dateISO: '2022-06-28', image: '/images/portfolio/premio-biscoito-2022.jpeg' },
  
  { name: 'Reveião Golarrolê 2022', year: '2021', dateFormatted: '31 de dezembro de 2021', dateISO: '2021-12-31', image: '/images/portfolio/reveiao-golarrole-2022.jpeg' },
  { name: 'No Ar Coquetel Molotov - 18ª Edição', year: '2021', dateFormatted: '13 de novembro de 2021', dateISO: '2021-11-13', image: '/images/portfolio/no-ar-coquetel-molotov-18-edicao.jpg' }
]

const filteredEvents = computed(() => {
  if (selectedYear.value === 'Todos') {
    return events
  }
  return events.filter(event => event.year === selectedYear.value)
})
</script>

<style scoped>
.servicos-page {
  padding: 3rem 1rem 6rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 3.5rem;
}

.header-section {
  max-width: 900px;
}

.title {
  font-size: clamp(2rem, 4vw, 3.2rem);
  line-height: 1.2;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin-top: 0.5rem;
}

.lead {
  font-size: 1.25rem;
  line-height: 1.7;
  margin-top: 1.2rem;
}

/* Tabs System */
.tabs-container {
  display: flex;
  flex-direction: column;
  gap: 3rem;
}

.tab-list {
  display: flex;
  gap: 1rem;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.5rem;
  flex-wrap: wrap;
}

.tab-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-family: 'Poppins', sans-serif;
  font-size: 1.2rem;
  font-weight: 700;
  padding: 0.8rem 1.5rem;
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.tab-btn:hover {
  color: var(--text);
  background-color: var(--primary-muted);
}

.tab-btn.active {
  color: var(--text);
  background-color: var(--primary-muted);
  box-shadow: inset 0 -3px 0 var(--secondary);
}

.tab-panel {
  display: flex;
  flex-direction: column;
  gap: 4rem;
}

.section-intro {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  max-width: 750px;
}

.section-intro h2 {
  font-size: clamp(1.8rem, 3vw, 2.5rem);
  font-weight: 800;
  letter-spacing: -0.01em;
}

/* Services Grid */
.services-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 2rem;
}

.service-card {
  padding: 2.5rem;
  border-radius: var(--radius-xl);
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: transform var(--transition-smooth), border-color var(--transition-fast);
}

.service-card:hover {
  transform: translateY(-6px);
  border-color: var(--primary);
}

.service-icon {
  font-size: 2.5rem;
}

.service-card h3 {
  font-size: 1.35rem;
  font-weight: 700;
}

.service-card p {
  font-size: 1.05rem;
  line-height: 1.6;
  color: var(--text-muted);
}

/* Impact and CTA box */
.impact-box {
  padding: 3.5rem 2.5rem;
  border-radius: var(--radius-2xl);
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 4rem;
  align-items: center;
  background: linear-gradient(135deg, rgba(109, 40, 217, 0.06), rgba(219, 39, 119, 0.03));
  border: 1px solid rgba(255, 255, 255, 0.08);
}

@media (max-width: 850px) {
  .impact-box {
    grid-template-columns: 1fr;
    gap: 3rem;
    padding: 2.5rem;
  }
}

.impact-metric {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.metric-number {
  font-family: 'Poppins', sans-serif;
  font-size: clamp(3.5rem, 8vw, 5.5rem);
  font-weight: 900;
  line-height: 1;
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.metric-label {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text);
  line-height: 1.5;
}

.impact-cta {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  align-items: flex-start;
}

.impact-cta h3 {
  font-size: clamp(1.4rem, 2.5vw, 1.8rem);
  font-weight: 800;
  text-align: left;
}

/* Portfolio Grid */
.portfolio-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 2rem;
}

.portfolio-card {
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(255, 255, 255, 0.05);
  position: relative;
  transition: transform var(--transition-fast), border-color var(--transition-fast);
  overflow: hidden; /* Clips image corners inside card */
}

.portfolio-card:hover {
  transform: translateY(-4px);
  border-color: var(--secondary);
}

.portfolio-image-wrapper {
  position: relative;
  height: 240px;
  width: 100%;
  overflow: hidden;
  background-color: rgba(0, 0, 0, 0.2);
}

.portfolio-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-smooth);
}

.portfolio-card:hover .portfolio-image {
  transform: scale(1.05);
}

.portfolio-badge {
  position: absolute;
  top: 1rem;
  right: 1rem;
  font-size: 0.8rem;
  font-weight: 800;
  background-color: var(--primary);
  color: white;
  padding: 0.25rem 0.6rem;
  border-radius: var(--radius-sm);
  z-index: 2;
  box-shadow: var(--shadow-sm);
}

.portfolio-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  flex-grow: 1;
}

.portfolio-card h3 {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text);
  line-height: 1.4;
}

.event-date {
  font-size: 0.9rem;
  color: var(--text-muted);
}

/* Filter bar */
.filter-bar {
  display: flex;
  gap: 0.6rem;
  margin-top: 1.2rem;
  flex-wrap: wrap;
}

.filter-btn {
  background-color: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-family: 'Poppins', sans-serif;
  font-size: 0.95rem;
  font-weight: 600;
  padding: 0.4rem 1.2rem;
  cursor: pointer;
  border-radius: var(--radius-full);
  transition: all var(--transition-fast);
}

.filter-btn:hover {
  background-color: var(--primary-muted);
  color: var(--text);
  border-color: var(--primary);
}

.filter-btn.active {
  background-color: var(--primary);
  color: white;
  border-color: var(--primary);
  box-shadow: var(--shadow-sm);
}
</style>
