<template>
  <div class="home-page">
    <AppSeo :title="$t('seo.home.title')" :description="$t('seo.home.description')" />
    <!-- Hero Section -->
    <section class="hero-section flex-center" aria-labelledby="hero-title">
      <div class="container hero-container">
        <h1 id="hero-title" class="hero-heading">
          {{ $t('home.heroTitle1') }}<span class="gradient-text">{{ $t('home.heroTitleHighlight1') }}</span>{{ $t('home.heroTitle2') }}<span class="gradient-text">{{ $t('home.heroTitleHighlight2') }}</span>
        </h1>
        <p class="hero-lead">
          {{ $t('home.heroLead') }}
        </p>
        <div class="hero-actions">
          <NuxtLink :to="localePath('/servicos')" class="btn btn-primary">
            {{ $t('home.btnServices') }}
          </NuxtLink>
          <NuxtLink :to="localePath('/institucional/sobre')" class="btn btn-secondary">
            {{ $t('home.btnHistory') }}
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Key Projects Section -->
    <section class="highlights-section" aria-labelledby="highlights-title">
      <div class="container">
        <span class="badge flex-center-self">{{ $t('home.badgeProjects') }}</span>
        <h2 id="highlights-title" class="section-title text-center">{{ $t('home.sectionTitle') }}</h2>
        <p class="section-subtitle text-center">{{ $t('home.sectionSubtitle') }}</p>
        
        <div class="grid-responsive highlight-grid">
          <!-- Project 1: Psicoterapia -->
          <div class="pillar-card glass pulse-hover">
            <div class="pillar-img-container">
              <img src="/images/saude.webp" :alt="$t('home.cardSaudeTitle')" class="pillar-img" />
            </div>
            <h3>{{ $t('home.cardSaudeTitle') }}</h3>
            <p>{{ $t('home.cardSaudeDesc') }}</p>
            <a href="https://docs.google.com/forms/d/e/1FAIpQLSfxBMKBY0qycEHDWJSEQ1-mhtQVPb3g7GWwpd5mgrXkWUDpLA/viewform" target="_blank" rel="noopener noreferrer" class="link-more">{{ $t('home.cardSaudeLink') }}<span class="sr-only">{{ $t('home.opensInAnotherWindow') }}</span> &rarr;</a>
          </div>

          <!-- Project 2: Bandeira do Orgulho -->
          <div class="pillar-card glass pulse-hover">
            <div class="pillar-img-container">
              <img src="/images/bandeira.webp" :alt="$t('home.cardBandeiraTitle')" class="pillar-img" />
            </div>
            <h3>{{ $t('home.cardBandeiraTitle') }}</h3>
            <p>{{ $t('home.cardBandeiraDesc') }}</p>
            <a href="/downloads/bandeira.jpg" download="bandeira.jpg" class="link-more" id="downloadBandeira" @click="trackDownloadBandeira">
              {{ $t('home.cardBandeiraLink') }}<span class="sr-only">: {{ $t('home.cardBandeiraSrText') }}</span> &rarr;
            </a>
          </div>
          
          <!-- Project 3: Leke Virtual -->
          <div class="pillar-card glass pulse-hover">
            <div class="pillar-img-container">
              <img src="/images/logo-leke.webp" :alt="$t('home.cardLekeTitle')" class="pillar-img" />
            </div>
            <h3>{{ $t('home.cardLekeTitle') }}</h3>
            <p>{{ $t('home.cardLekeDesc') }}</p>
            <NuxtLink :to="localePath('/leke')" class="link-more">
              {{ $t('home.cardLekeLink') }} &rarr;
            </NuxtLink>
          </div>

          <!-- Project 4: Multei (Contador em Tempo Real) -->
          <div
            class="pillar-card multei-live-card glass pulse-hover"
            :class="{ 'is-live-pulsing': isMulteiPulsing }"
          >
            <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
              {{ multeiLiveSrAnnouncement }}
            </div>

            <div class="pillar-img-container multei-counter-showcase">
              <div class="multei-live-pill">
                <span class="multei-live-dot" aria-hidden="true"></span>
                <span>{{ $t('home.cardMulteiLiveLabel') }}</span>
              </div>

              <div class="multei-counter-value-row">
                <span
                  class="multei-counter-number"
                  :class="{ 'is-loading': isLoadingMulteiStats }"
                >
                  {{ formatMulteiNumber(animatedTotalGeral) }}
                </span>
                <transition name="plus-one-pop">
                  <span
                    v-if="showPlusOneBadge"
                    :key="plusOneRenderKey"
                    class="multei-plus-one-badge"
                    aria-hidden="true"
                  >
                    +1
                  </span>
                </transition>
              </div>
            </div>

            <h3>{{ $t('home.cardMulteiTitle') }}</h3>
            <p>{{ $t('home.cardMulteiDesc') }}</p>
            <span class="link-more multei-coming-soon-label">
              {{ $t('home.cardMulteiComingSoon') }}
            </span>
          </div>

        </div>
      </div>
    </section>

    <!-- Support & Business Solutions Section -->
    <section class="actions-section container" aria-labelledby="actions-title">
      <div class="actions-header">
        <span class="badge flex-center-self">{{ $t('home.badgeSupport') }}</span>
        <h2 id="actions-title" class="section-title text-center">{{ $t('home.actionsTitle') }}</h2>
        <p class="section-subtitle text-center">{{ $t('home.actionsSubtitle') }}</p>
      </div>
      <div class="actions-grid">
        <!-- Card 1: Doações/Comunidade -->
        <div class="action-card donate-card glass">
          <span class="badge">{{ $t('home.cardDonateBadge') }}</span>
          <h2>{{ $t('home.cardDonateTitle') }}</h2>
          <p>
            {{ $t('home.cardDonateDesc') }}
          </p>
          <NuxtLink :to="localePath('/contato')" class="btn btn-primary">
            {{ $t('home.cardDonateBtn') }}
          </NuxtLink>
        </div>

        <!-- Card 2: Empresas -->
        <div class="action-card corporate-card glass">
          <span class="badge">{{ $t('home.cardCorporateBadge') }}</span>
          <h2>{{ $t('home.cardCorporateTitle') }}</h2>
          <p>
            {{ $t('home.cardCorporateDesc') }}
          </p>
          <NuxtLink :to="localePath('/servicos')" class="btn btn-primary">
            {{ $t('home.cardCorporateBtn') }}
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import {
  fetchMulteiStatsOnce,
  subscribeToMulteiLiveEvents
} from '~/services/firebaseService'

const { t, locale } = useI18n()
const localePath = useLocalePath()

const isLoadingMulteiStats = ref(true)
const multeiStats = ref({
  totalGeral: 0,
  infracoesTransito: 0,
  mobilidadeUrbana: 0
})
const animatedTotalGeral = ref(0)
const showPlusOneBadge = ref(false)
const plusOneRenderKey = ref(0)
const isMulteiPulsing = ref(false)
const multeiLiveSrAnnouncement = ref('')

let unsubscribeMulteiLive = null
let animFrameId = null
let badgeTimer = null
let pulseTimer = null
let srTimer = null

const formatMulteiNumber = (val) => {
  const num = Number(val) || 0
  const localeMap = {
    pt: 'pt-BR',
    en: 'en-US',
    es: 'es-ES'
  }
  return num.toLocaleString(localeMap[locale.value] || 'pt-BR')
}

const animateTotalValue = (targetValue) => {
  if (typeof window === 'undefined') {
    animatedTotalGeral.value = targetValue
    return
  }

  if (animFrameId) {
    cancelAnimationFrame(animFrameId)
  }

  const startValue = animatedTotalGeral.value || 0
  const diff = targetValue - startValue
  if (diff === 0) {
    animatedTotalGeral.value = targetValue
    return
  }

  const duration = 650
  const startTime = performance.now()

  const step = (now) => {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    animatedTotalGeral.value = Math.round(startValue + diff * eased)

    if (progress < 1) {
      animFrameId = requestAnimationFrame(step)
    } else {
      animatedTotalGeral.value = targetValue
    }
  }

  animFrameId = requestAnimationFrame(step)
}

const triggerPlusOneEffect = () => {
  plusOneRenderKey.value += 1
  showPlusOneBadge.value = true
  isMulteiPulsing.value = true

  if (badgeTimer) clearTimeout(badgeTimer)
  badgeTimer = setTimeout(() => {
    showPlusOneBadge.value = false
  }, 1800)

  if (pulseTimer) clearTimeout(pulseTimer)
  pulseTimer = setTimeout(() => {
    isMulteiPulsing.value = false
  }, 1400)

  if (srTimer) clearTimeout(srTimer)
  multeiLiveSrAnnouncement.value = ''
  srTimer = setTimeout(() => {
    multeiLiveSrAnnouncement.value = `+1 ocorrência registrada no Multei. Total: ${multeiStats.value.totalGeral}`
  }, 50)
}

const applyMulteiSnapshot = (incoming) => {
  if (!incoming) return
  isLoadingMulteiStats.value = false
  const infracoesTransito = Math.max(0, Number(incoming.infracoesTransito || 0))
  const mobilidadeUrbana = Math.max(0, Number(incoming.mobilidadeUrbana || 0))
  const totalGeral = Math.max(infracoesTransito + mobilidadeUrbana, Number(incoming.totalGeral || 0))

  multeiStats.value = {
    totalGeral,
    infracoesTransito,
    mobilidadeUrbana
  }
  animateTotalValue(totalGeral)
}

onMounted(() => {
  fetchMulteiStatsOnce((cached) => {
    applyMulteiSnapshot(cached)
  })
    .then((fresh) => {
      applyMulteiSnapshot(fresh)
    })
    .catch(() => {
      isLoadingMulteiStats.value = false
    })

  unsubscribeMulteiLive = subscribeToMulteiLiveEvents((evt) => {
    const { category, delta } = evt
    if (category !== 'infracoesTransito' && category !== 'mobilidadeUrbana') {
      return
    }
    isLoadingMulteiStats.value = false
    if (category === 'infracoesTransito') {
      multeiStats.value.infracoesTransito = Math.max(0, multeiStats.value.infracoesTransito + delta)
    } else {
      multeiStats.value.mobilidadeUrbana = Math.max(0, multeiStats.value.mobilidadeUrbana + delta)
    }
    multeiStats.value.totalGeral = Math.max(
      multeiStats.value.infracoesTransito + multeiStats.value.mobilidadeUrbana,
      multeiStats.value.totalGeral + delta
    )
    animateTotalValue(multeiStats.value.totalGeral)

    if (delta > 0) {
      triggerPlusOneEffect()
    }
  })
})

onBeforeUnmount(() => {
  if (typeof unsubscribeMulteiLive === 'function') {
    unsubscribeMulteiLive()
  }
  if (animFrameId && typeof window !== 'undefined') {
    cancelAnimationFrame(animFrameId)
  }
  if (badgeTimer) clearTimeout(badgeTimer)
  if (pulseTimer) clearTimeout(pulseTimer)
  if (srTimer) clearTimeout(srTimer)
})

function trackDownloadBandeira() {
  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      event: 'downloadBandeira'
    })
    if (window.gtag) {
      window.gtag('event', 'downloadBandeira')
    }
  }
}
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 768px) {
  .highlight-grid {
    grid-template-columns: 1fr;
  }
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

/* Card Multei com Contador em Tempo Real */
.multei-live-card.is-live-pulsing {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-muted), var(--shadow-md);
}

.multei-counter-showcase {
  flex-direction: column;
  gap: 0.5rem;
}

.multei-live-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.28rem 0.75rem;
  border-radius: var(--radius-full);
  background: var(--primary-muted);
  border: 1px solid var(--border-strong);
  color: var(--text);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.multei-live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #16a34a;
  box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.7);
  animation: multei-live-pulse 2s infinite;
}

@keyframes multei-live-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.65);
  }
  70% {
    box-shadow: 0 0 0 7px rgba(22, 163, 74, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(22, 163, 74, 0);
  }
}

.multei-counter-value-row {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.multei-counter-number {
  font-size: clamp(3.9rem, 6.2vw, 5.2rem);
  font-weight: 900;
  line-height: 0.95;
  letter-spacing: -0.04em;
  color: var(--primary);
  font-variant-numeric: tabular-nums;
  text-shadow: 0 10px 24px rgba(109, 40, 217, 0.22);
  transition: transform var(--transition-smooth), text-shadow var(--transition-smooth);
}

.pillar-card:hover .multei-counter-number {
  transform: translateY(-6px) scale(1.12);
  text-shadow: 0 16px 32px rgba(109, 40, 217, 0.32);
}

.multei-counter-number.is-loading {
  opacity: 0.55;
}

.multei-plus-one-badge {
  position: absolute;
  left: calc(100% + 0.5rem);
  top: 0.1rem;
  padding: 0.2rem 0.55rem;
  border-radius: var(--radius-full);
  background-color: #16a34a;
  color: #ffffff;
  font-size: 0.9rem;
  font-weight: 800;
  box-shadow: var(--shadow-sm);
  pointer-events: none;
}

.plus-one-pop-enter-active {
  animation: plus-one-float 1.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.plus-one-pop-leave-active {
  opacity: 0;
}

@keyframes plus-one-float {
  0% {
    opacity: 0;
    transform: translateY(10px) scale(0.75);
  }
  20% {
    opacity: 1;
    transform: translateY(0) scale(1.08);
  }
  80% {
    opacity: 1;
    transform: translateY(-8px) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-14px) scale(0.95);
  }
}

.multei-coming-soon-label {
  cursor: default;
  color: var(--primary);
}
.multei-coming-soon-label:hover {
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
