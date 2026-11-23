<template>
  <div class="servicos-page">
    <AppSeo :title="$t('seo.services.title')" :description="$t('seo.services.description')" />

    <!-- Topo -->
    <section class="container services-hero" aria-labelledby="services-page-title">
      <span class="badge">{{ $t('services.badgeWhat') }}</span>
      <h1 id="services-page-title" class="title">
        {{ $t('services.title') }}<span class="gradient-text">{{ $t('services.titleHighlight') }}</span>
      </h1>
      <p class="lead text-muted">{{ $t('services.lead') }}</p>

      <div class="hero-actions">
        <NuxtLink :to="proposalLink('consulting')" class="btn btn-primary">
          {{ $t('services.ctaProposal') }}
        </NuxtLink>
        <a href="#eventos" class="btn btn-secondary">{{ $t('services.ctaEvents') }}</a>
      </div>

      <dl class="hero-stats">
        <div class="hero-stat">
          <dt class="sr-only">{{ $t('services.statCompaniesLabel') }}</dt>
          <dd>
            <span class="hero-stat-number">{{ $t('services.statCompanies') }}</span>
            <span class="hero-stat-label">{{ $t('services.statCompaniesLabel') }}</span>
          </dd>
        </div>
        <div class="hero-stat">
          <dt class="sr-only">{{ $t('services.statEventsLabel') }}</dt>
          <dd>
            <span class="hero-stat-number">{{ events.length }}</span>
            <span class="hero-stat-label">{{ $t('services.statEventsLabel') }}</span>
          </dd>
        </div>
      </dl>

      <nav class="quick-nav" :aria-label="$t('services.quickNavLabel')">
        <ul>
          <li><a href="#servicos">{{ $t('services.navServices') }}</a></li>
          <li><a href="#eventos">{{ $t('services.navEvents') }}</a></li>
          <li><a href="#quem-confia">{{ $t('services.navTrust') }}</a></li>
          <li><a href="#como-funciona">{{ $t('services.navHow') }}</a></li>
        </ul>
      </nav>
    </section>

    <!-- Serviços -->
    <section id="servicos" class="container page-section" aria-labelledby="servicos-title">
      <div class="section-intro">
        <span class="badge">{{ $t('services.servicesBadge') }}</span>
        <h2 id="servicos-title">{{ $t('services.servicesTitle') }}</h2>
        <p class="text-muted">{{ $t('services.servicesLead') }}</p>
      </div>

      <ul class="services-grid" role="list">
        <li v-for="service in services" :key="service.key" class="service-card glass">
          <div class="service-card-header">
            <span class="service-icon" aria-hidden="true">{{ service.icon }}</span>
            <h3>{{ $t(`services.${service.key}Title`) }}</h3>
          </div>
          <p class="service-desc">{{ $t(`services.${service.key}Desc`) }}</p>
          <dl class="service-facts">
            <div class="service-fact">
              <dt>{{ $t('services.forWhoLabel') }}</dt>
              <dd>{{ $t(`services.${service.key}ForWho`) }}</dd>
            </div>
            <div class="service-fact">
              <dt>{{ $t('services.durationLabel') }}</dt>
              <dd>{{ service.duration ? $t(`services.${service.duration}`) : $t('services.tailored') }}</dd>
            </div>
          </dl>
          <NuxtLink :to="proposalLink(service.subject)" class="link-more service-cta">
            {{ $t('services.serviceCta') }}<span class="sr-only">: {{ $t(`services.${service.key}Title`) }}</span> &rarr;
          </NuxtLink>
        </li>
      </ul>
    </section>

    <!-- Eventos -->
    <section id="eventos" class="container page-section" aria-labelledby="eventos-title">
      <div class="section-intro">
        <span class="badge">{{ $t('services.eventsBadge') }}</span>
        <h2 id="eventos-title">{{ $t('services.eventsTitle') }}</h2>
        <p class="text-muted">{{ $t('services.eventsLead') }}</p>

        <div class="filter-bar" role="group" :aria-label="$t('services.filterLabel')">
          <button
            v-for="year in yearOptions"
            :key="year"
            type="button"
            :class="['filter-btn', { active: selectedYear === year }]"
            :aria-pressed="selectedYear === year ? 'true' : 'false'"
            @click="selectedYear = year"
          >
            {{ year === ALL ? $t('services.filterAll') : year }}
          </button>
        </div>
        <p class="results-count" role="status" aria-live="polite">{{ resultsLabel }}</p>
      </div>

      <ul class="portfolio-grid" role="list">
        <li v-for="event in filteredEvents" :key="event.name" class="portfolio-card glass">
          <div class="portfolio-image-wrapper">
            <img :src="event.image" alt="" class="portfolio-image" loading="lazy" decoding="async" />
          </div>
          <div class="portfolio-body">
            <h3>{{ event.name }}</h3>
            <p class="event-date">
              <span aria-hidden="true">📅 </span><time :datetime="event.dateISO">{{ getEventDateFormatted(event.dateISO) }}</time>
            </p>
          </div>
        </li>
      </ul>

      <div class="section-cta">
        <NuxtLink :to="proposalLink('events')" class="btn btn-primary">
          {{ $t('services.serviceCta') }}<span class="sr-only">: {{ $t('services.festivalsTitle') }}</span>
        </NuxtLink>
      </div>
    </section>

    <!-- Quem confia -->
    <section id="quem-confia" class="container page-section" aria-labelledby="quem-confia-title">
      <div class="section-intro">
        <span class="badge">{{ $t('services.trustBadge') }}</span>
        <h2 id="quem-confia-title">{{ $t('services.trustTitle') }}</h2>
      </div>
      <LogoCarousel id-prefix="servicos-parceiros" />
    </section>

    <!-- Como funciona -->
    <section id="como-funciona" class="container page-section" aria-labelledby="como-funciona-title">
      <div class="section-intro">
        <span class="badge">{{ $t('services.howBadge') }}</span>
        <h2 id="como-funciona-title">{{ $t('services.howTitle') }}</h2>
      </div>
      <ol class="steps" role="list">
        <li v-for="n in 4" :key="n" class="step glass">
          <span class="step-number" aria-hidden="true">{{ n }}</span>
          <h3>{{ $t(`services.step${n}Title`) }}</h3>
          <p>{{ $t(`services.step${n}Desc`) }}</p>
        </li>
      </ol>
    </section>

    <!-- Pedido de proposta -->
    <section class="container" aria-labelledby="cta-title">
      <div class="final-cta glass">
        <h2 id="cta-title">{{ $t('services.ctaTitle') }}</h2>
        <p class="text-muted">{{ $t('services.ctaDesc') }}</p>
        <NuxtLink :to="proposalLink('consulting')" class="btn btn-primary">
          {{ $t('services.ctaBtn') }}
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const { t, locale } = useI18n()
const localePath = useLocalePath()

// Abre o Contato com o assunto já selecionado no formulário
const proposalLink = (subject) => localePath({ path: '/contato', query: { assunto: subject } })

// Serviços oferecidos. `subject` = valor do assunto no formulário de contato.
const services = [
  { key: 'talks', icon: '🎤', subject: 'consulting', duration: 'talksDuration' },
  { key: 'conversations', icon: '🗣️', subject: 'consulting' },
  { key: 'mentorship', icon: '🎯', subject: 'consulting' },
  { key: 'corporate', icon: '🤝', subject: 'consulting' },
  { key: 'festivals', icon: '🎪', subject: 'events', duration: 'festivalsDuration' },
  { key: 'panels', icon: '👥', subject: 'consulting' }
]

const LOCALE_MAP = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' }

const getEventDateFormatted = (dateISO) => {
  const [year, month, day] = dateISO.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return new Intl.DateTimeFormat(LOCALE_MAP[locale.value] || 'pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date)
}

const rawEvents = [
  { name: 'La Folie Festival 2023', dateISO: '2023-11-25', image: '/images/portfolio/la-folie-festival-2023.webp' },
  { name: 'Marina Sena - Vício Inerente Tour', dateISO: '2023-07-29', image: '/images/portfolio/marina-sena-vicio-inerente-tour.webp' },
  { name: 'Dia Mundial de Conscientização do Autismo 2023', dateISO: '2023-04-02', image: '/images/portfolio/dia-mundial-de-conscientizacao-do-autismo-2023.webp' },
  { name: 'Sofar Floripa', dateISO: '2023-03-01', image: '/images/portfolio/sofar-floripa.webp' },
  { name: 'Festival Saravá', dateISO: '2023-01-21', image: '/images/portfolio/festival-sarava.webp' },
  { name: 'Bloco do Silva', dateISO: '2023-01-14', image: '/images/portfolio/bloco-do-silva.webp' },
  { name: 'Tarantina', dateISO: '2023-01-13', image: '/images/portfolio/tarantina.webp' },
  { name: 'Carnaval Parador 2023', dateISO: '2023-02-19', image: '/images/portfolio/carnaval-parador-2023.webp' },
  { name: 'Olinda Beer 2023', dateISO: '2023-02-12', image: '/images/portfolio/olinda-beer-2023.webp' },
  { name: 'Reveião Golarrolê 2023', dateISO: '2023-01-14', image: '/images/portfolio/reveiao-golarrole-2023.webp' },
  { name: 'Festival do Futuro', dateISO: '2023-01-01', image: '/images/portfolio/festival-do-futuro.webp' },
  { name: 'Batidão de Natal', dateISO: '2022-12-24', image: '/images/portfolio/batidao-de-natal.webp' },
  { name: 'La Folie Festival 2022', dateISO: '2022-11-26', image: '/images/portfolio/la-folie-festival-2022.webp' },
  { name: 'No Ar Coquetel Molotov', dateISO: '2022-11-19', image: '/images/portfolio/no-ar-coquetel-molotov.webp' },
  { name: 'Transborda - As Linguagens da Cena', dateISO: '2022-11-18', image: '/images/portfolio/transborda-as-linguagens-da-cena.webp' },
  { name: 'Terça do Vinil', dateISO: '2022-10-11', image: '/images/portfolio/terca-do-vinil.webp' },
  { name: 'ODARA ÔDESCE 10 anos | com SILVA', dateISO: '2022-10-08', image: '/images/portfolio/odara-odesce-10-anos-com-silva.webp' },
  { name: 'Limonada Pop Renaissance', dateISO: '2022-07-30', image: '/images/portfolio/limonada-pop-renaissance.webp' },
  { name: 'Romero Ferro - Turnê Encerramento Álbum Ferro', dateISO: '2022-05-01', image: '/images/portfolio/romero-ferro-turne-de-encerramento-do-album-ferro.webp' },
  { name: 'ODARA ÔDESCE + REC BEAT apresentam Marina Sena', dateISO: '2022-05-13', image: '/images/portfolio/odara-odesce-rec-beat-apresentam-marina-sena.webp' },
  { name: 'Carvalheira na Ladeira', dateISO: '2022-04-15', image: '/images/portfolio/carvalheira-na-ladeira.webp' },
  { name: 'ARVO Festival', dateISO: '2022-04-15', image: '/images/portfolio/arvo-festival.webp' },
  { name: 'Baile da Anaconda', dateISO: '2022-03-19', image: '/images/portfolio/baile-da-anaconda.webp' },
  { name: 'Prêmio Biscoito 2022', dateISO: '2022-06-28', image: '/images/portfolio/premio-biscoito-2022.webp' },
  { name: 'Reveião Golarrolê 2022', dateISO: '2021-12-31', image: '/images/portfolio/reveiao-golarrole-2022.webp' },
  { name: 'No Ar Coquetel Molotov - 18ª Edição', dateISO: '2021-11-13', image: '/images/portfolio/no-ar-coquetel-molotov-18-edicao.webp' }
]

// Mais recentes primeiro; o ano vem da própria data
const events = rawEvents
  .map((event) => ({ ...event, year: event.dateISO.slice(0, 4) }))
  .sort((a, b) => b.dateISO.localeCompare(a.dateISO))

const ALL = 'all'
const selectedYear = ref(ALL)
const yearOptions = [ALL, ...new Set(events.map((event) => event.year))]

const filteredEvents = computed(() =>
  selectedYear.value === ALL ? events : events.filter((event) => event.year === selectedYear.value)
)

const resultsLabel = computed(() => {
  const count = filteredEvents.value.length
  return selectedYear.value === ALL
    ? t('services.resultsAll', { count }, count)
    : t('services.resultsYear', { count, year: selectedYear.value }, count)
})
</script>

<style scoped>
.servicos-page {
  padding: 3rem 0 5rem;
  display: flex;
  flex-direction: column;
  gap: 5rem;
}

/* Topo */
.services-hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1.2rem;
}

.title {
  font-size: clamp(2rem, 4vw, 3.2rem);
  line-height: 1.2;
  font-weight: 800;
  letter-spacing: -0.02em;
  max-width: 900px;
}

.lead {
  font-size: clamp(1.05rem, 1.6vw, 1.2rem);
  line-height: 1.7;
  max-width: 820px;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.9rem;
  margin-top: 0.4rem;
}

.hero-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem 2.5rem;
  margin: 0.8rem 0 0;
}

.hero-stat dd {
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
}

.hero-stat-number {
  font-family: 'Poppins', sans-serif;
  font-size: clamp(2rem, 4vw, 2.6rem);
  font-weight: 900;
  line-height: 1;
  color: var(--primary);
}

[data-theme="dark"] .hero-stat-number {
  color: var(--text);
}

.hero-stat-label {
  font-weight: 600;
  color: var(--text-muted);
}

.quick-nav ul {
  list-style: none;
  padding: 0;
  margin: 0.6rem 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.quick-nav a {
  display: inline-block;
  padding: 0.4rem 1rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
  color: var(--text);
  font-weight: 600;
  font-size: 0.95rem;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.quick-nav a:hover {
  border-color: var(--primary);
  color: var(--primary);
}

/* Seções */
.page-section {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
  scroll-margin-top: 96px;
}

.section-intro {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.8rem;
  max-width: 760px;
}

.section-intro h2 {
  font-size: clamp(1.8rem, 3vw, 2.5rem);
  font-weight: 800;
  letter-spacing: -0.01em;
}

/* Serviços */
.services-grid {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
  gap: 1.75rem;
}

.service-card {
  padding: 2rem;
  border-radius: var(--radius-xl);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  border: 1px solid var(--border);
  transition: transform var(--transition-smooth), border-color var(--transition-fast);
}

.service-card:hover,
.service-card:focus-within {
  transform: translateY(-4px);
  border-color: var(--primary);
}

.service-card-header {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.service-icon {
  font-size: 2rem;
  flex-shrink: 0;
}

.service-card h3 {
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.3;
}

.service-desc {
  font-size: 1.02rem;
  line-height: 1.6;
  color: var(--text-muted);
}

.service-facts {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.9rem 1rem;
  border-radius: var(--radius-md, 10px);
  background: var(--primary-muted);
}

.service-fact {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 0.5rem;
  font-size: 0.95rem;
}

.service-fact dt {
  font-weight: 700;
  color: var(--text);
}

.service-fact dt::after {
  content: ':';
}

.service-fact dd {
  margin: 0;
  color: var(--text);
}

.link-more {
  color: var(--secondary);
  font-weight: 700;
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 4px;
}

.link-more:hover {
  color: var(--primary);
}

.service-cta {
  margin-top: auto;
}

/* Eventos */
.filter-bar {
  display: flex;
  gap: 0.6rem;
  margin-top: 0.6rem;
  flex-wrap: wrap;
}

.filter-btn {
  background-color: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  font-family: 'Poppins', sans-serif;
  font-size: 0.95rem;
  font-weight: 600;
  padding: 0.45rem 1.2rem;
  min-height: 40px;
  cursor: pointer;
  border-radius: var(--radius-full);
  transition: background-color var(--transition-fast), border-color var(--transition-fast);
}

.filter-btn:hover {
  background-color: var(--primary-muted);
  border-color: var(--primary);
}

.filter-btn:focus-visible,
.quick-nav a:focus-visible {
  outline: 3px solid var(--primary);
  outline-offset: 2px;
}

.filter-btn.active {
  background-color: var(--primary);
  color: #ffffff;
  border-color: var(--primary);
}

.results-count {
  font-weight: 600;
  color: var(--text-muted);
}

.portfolio-grid {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  gap: 1.5rem;
}

.portfolio-card {
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  overflow: hidden;
}

.portfolio-image-wrapper {
  aspect-ratio: 4 / 5;
  width: 100%;
  overflow: hidden;
  background-color: var(--surface);
}

.portfolio-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.portfolio-body {
  padding: 1.2rem 1.3rem 1.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex-grow: 1;
}

.portfolio-card h3 {
  font-size: 1.08rem;
  font-weight: 700;
  color: var(--text);
  line-height: 1.4;
}

.event-date {
  font-size: 0.9rem;
  color: var(--text-muted);
}

.section-cta {
  display: flex;
  justify-content: center;
}

/* Como funciona */
.steps {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1.25rem;
}

@media (max-width: 960px) {
  .steps {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .steps {
    grid-template-columns: 1fr;
  }
}

.step {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1.6rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
}

.step-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 50%;
  background: var(--primary);
  color: #ffffff;
  font-weight: 800;
}

.step h3 {
  font-size: 1.15rem;
  font-weight: 700;
}

.step p {
  color: var(--text-muted);
  line-height: 1.6;
}

/* Pedido de proposta */
.final-cta {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 1rem;
  padding: 3rem 2rem;
  border-radius: var(--radius-2xl);
  border: 1px solid var(--border);
  background: linear-gradient(135deg, rgba(109, 40, 217, 0.06), rgba(219, 39, 119, 0.04));
}

.final-cta h2 {
  font-size: clamp(1.5rem, 3vw, 2.1rem);
  font-weight: 800;
  max-width: 720px;
}

@media (prefers-reduced-motion: reduce) {
  .service-card,
  .service-card:hover,
  .service-card:focus-within {
    transform: none;
    transition: none;
  }
}
</style>
