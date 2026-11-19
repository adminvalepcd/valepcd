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
        <nav class="hero-actions" :aria-label="$t('home.heroPathsLabel')">
          <NuxtLink :to="localePath('/psicoterapia')" class="btn btn-primary hero-path">
            {{ $t('home.heroCtaCare') }}
          </NuxtLink>
          <NuxtLink :to="localePath('/servicos')" class="btn btn-secondary hero-path">
            {{ $t('home.heroCtaBusiness') }}
          </NuxtLink>
          <NuxtLink :to="localePath('/doar')" class="btn btn-secondary hero-path">
            {{ $t('home.heroCtaSupport') }}
          </NuxtLink>
        </nav>
        <NuxtLink :to="localePath('/institucional/sobre')" class="hero-story-link">
          {{ $t('home.heroStoryLink') }} &rarr;
        </NuxtLink>
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
              <img src="/images/saude.webp" alt="" class="pillar-img" loading="lazy" />
            </div>
            <h3>{{ $t('home.cardSaudeTitle') }}</h3>
            <p>{{ $t('home.cardSaudeDesc') }}</p>
            <div class="card-links">
              <a href="https://docs.google.com/forms/d/e/1FAIpQLSfxBMKBY0qycEHDWJSEQ1-mhtQVPb3g7GWwpd5mgrXkWUDpLA/viewform" target="_blank" rel="noopener noreferrer" class="btn btn-primary card-cta">{{ $t('home.cardSaudeLink') }}<NewWindowIcon /></a>
              <NuxtLink :to="localePath('/psicoterapia')" class="link-more">
                {{ $t('home.cardSaudeMore') }} &rarr;
              </NuxtLink>
            </div>
          </div>

          <!-- Project 2: Bandeira do Orgulho -->
          <div class="pillar-card glass pulse-hover">
            <div class="pillar-img-container">
              <img src="/images/bandeira.webp" alt="" class="pillar-img" loading="lazy" />
            </div>
            <h3>{{ $t('home.cardBandeiraTitle') }}</h3>
            <p>{{ $t('home.cardBandeiraDesc') }}</p>
            <a href="/downloads/bandeira.jpg" download="bandeira.jpg" class="link-more" id="downloadBandeira" @click="trackDownloadBandeira">
              {{ $t('home.cardBandeiraLink') }} &rarr;
            </a>
          </div>

          <!-- Project 3: Leke Virtual -->
          <div class="pillar-card glass pulse-hover">
            <div class="pillar-img-container">
              <img src="/images/logo-leke.webp" alt="" class="pillar-img" loading="lazy" />
            </div>
            <h3>{{ $t('home.cardLekeTitle') }}</h3>
            <p>{{ $t('home.cardLekeDesc') }}</p>
            <NuxtLink :to="localePath('/leke')" class="link-more">
              {{ $t('home.cardLekeLink') }} &rarr;
            </NuxtLink>
          </div>

          <!-- Project 4: Mapa colaborativo (fase de testes, sem revelar nome/endereço) -->
          <div
            class="pillar-card multei-live-card glass pulse-hover"
            :class="{ 'is-live-pulsing': isMulteiPulsing }"
            @focusin="isMulteiCardFocused = true"
            @focusout="onMulteiCardFocusOut"
          >
            <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
              {{ multeiLiveSrAnnouncement }}
            </div>

            <div class="pillar-img-container multei-counter-showcase">
              <div class="multei-live-pill">
                <span class="multei-live-dot" aria-hidden="true"></span>
                <span>{{ $t('home.cardMulteiLiveLabel') }}</span>
              </div>

              <div class="multei-counters-split" :aria-busy="isLoadingMulteiStats ? 'true' : 'false'">
                <!-- Bloco 1: Total de ocorrências -->
                <div class="multei-counter-block">
                  <span class="multei-counter-icon" aria-hidden="true">📍</span>
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
                  <span class="multei-counter-block-label">
                    {{ $t('home.cardMulteiTotalReports') }}
                  </span>
                </div>

                <!-- Bloco 2: Total de resolvidos -->
                <div class="multei-counter-block is-resolved-block">
                  <span class="multei-counter-icon" aria-hidden="true">✅</span>
                  <div class="multei-counter-value-row">
                    <span
                      class="multei-counter-number is-resolved-number"
                      :class="{ 'is-loading': isLoadingMulteiStats }"
                    >
                      {{ formatMulteiNumber(animatedResolvidos) }}
                    </span>
                    <transition name="plus-one-pop">
                      <span
                        v-if="showPlusOneResolvedBadge"
                        :key="plusOneResolvedRenderKey"
                        class="multei-plus-one-badge"
                        aria-hidden="true"
                      >
                        +1
                      </span>
                    </transition>
                  </div>
                  <span class="multei-counter-block-label">
                    {{ $t('home.cardMulteiTotalResolutions') }}
                  </span>
                </div>
              </div>

              <p class="multei-updated-at">
                <span v-if="isLoadingMulteiStats">{{ $t('home.cardMulteiLoading') }}</span>
                <span v-else-if="multeiUpdatedAtLabel">{{ $t('home.cardMulteiUpdatedAt', { time: multeiUpdatedAtLabel }) }}</span>
              </p>
            </div>

            <h3>{{ $t('home.cardMulteiTitle') }}</h3>
            <p>{{ $t('home.cardMulteiDesc') }}</p>
            <a
              href="https://forms.gle/eYk83VudkMAKuYir6"
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-primary card-cta"
            >
              {{ $t('home.cardMulteiComingSoon') }}<NewWindowIcon />
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- Prévia da seção de impacto (somente dev ou ?preview=impacto, aguardando validação) -->
    <ClientOnly>
      <HomeImpactSection v-if="showImpactPreview" />
    </ClientOnly>

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
          <h3>{{ $t('home.cardDonateTitle') }}</h3>
          <p>
            {{ $t('home.cardDonateDesc') }}
          </p>
          <NuxtLink :to="localePath('/doar')" class="btn btn-primary">
            {{ $t('home.cardDonateBtn') }}
          </NuxtLink>
        </div>

        <!-- Card 2: Empresas -->
        <div class="action-card corporate-card glass">
          <span class="badge">{{ $t('home.cardCorporateBadge') }}</span>
          <h3>{{ $t('home.cardCorporateTitle') }}</h3>
          <p>
            {{ $t('home.cardCorporateDesc') }}
          </p>
          <NuxtLink :to="localePath('/servicos')" class="btn btn-primary">
            {{ $t('home.cardCorporateBtn') }}
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Posts recentes do blog -->
    <section v-if="recentPosts && recentPosts.length" class="blog-section" aria-labelledby="home-blog-title">
      <div class="container">
        <span class="badge flex-center-self">{{ $t('home.blogBadge') }}</span>
        <h2 id="home-blog-title" class="section-title text-center">{{ $t('home.blogTitle') }}</h2>
        <p class="section-subtitle text-center">{{ $t('home.blogSubtitle') }}</p>
        <ul class="blog-grid" role="list">
          <li v-for="post in recentPosts" :key="post.slug" class="blog-card glass">
            <div v-if="post.image" class="blog-card-img-wrap">
              <img :src="post.image" alt="" class="blog-card-img" loading="lazy" />
            </div>
            <div class="blog-card-body">
              <span v-if="post.category" class="blog-card-category">{{ post.category }}</span>
              <h3 class="blog-card-title">
                <NuxtLink :to="localePath('/blog/' + post.slug)" class="blog-card-link">
                  {{ post.title }}
                </NuxtLink>
              </h3>
              <time v-if="post.date" class="blog-card-date" :datetime="post.date">{{ formatPostDate(post.date) }}</time>
              <p class="blog-card-desc">{{ post.description }}</p>
              <span class="link-more" aria-hidden="true">{{ $t('home.blogReadPost') }} &rarr;</span>
            </div>
          </li>
        </ul>
        <div class="blog-see-all">
          <NuxtLink :to="localePath('/blog')" class="btn btn-secondary">
            {{ $t('home.blogSeeAll') }}
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { fetchMulteiStatsOnce } from '~/services/firebaseService'

const { t, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

const LOCALE_MAP = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' }
const currentLocaleTag = () => LOCALE_MAP[locale.value] || 'pt-BR'

// Seção de impacto: rascunho para validação. Só aparece em dev ou com ?preview=impacto.
const showImpactPreview = computed(() => import.meta.dev || route.query.preview === 'impacto')

// ---------- Posts recentes do blog ----------
const { data: recentPosts } = await useFetch('/api/posts', {
  key: 'home-recent-posts',
  default: () => [],
  transform: (posts) => (Array.isArray(posts) ? posts : [])
    .slice(0, 3)
    .map(({ slug, title, date, description, image, category }) => ({
      slug,
      title,
      date,
      description: description && description.length > 160 ? description.slice(0, 157).trimEnd() + '…' : description,
      image,
      category
    }))
})

const formatPostDate = (value) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(currentLocaleTag(), { day: '2-digit', month: 'long', year: 'numeric' })
}

// ---------- Contador do mapa colaborativo (fase de testes) ----------
// Leitura única do Firestore com cache local; atualiza a cada poucos minutos e só com a aba visível.
const MULTEI_REFRESH_MS = 3 * 60 * 1000
const MULTEI_LAST_FETCH_KEY = 'vale_home_multei_stats_fetched_at'

const isLoadingMulteiStats = ref(true)
const multeiStats = ref({ totalGeral: 0, infracoesTransito: 0, mobilidadeUrbana: 0, resolvidos: 0 })
const animatedTotalGeral = ref(0)
const animatedResolvidos = ref(0)
const showPlusOneBadge = ref(false)
const plusOneRenderKey = ref(0)
const showPlusOneResolvedBadge = ref(false)
const plusOneResolvedRenderKey = ref(0)
const isMulteiPulsing = ref(false)
const isMulteiCardFocused = ref(false)
const multeiLiveSrAnnouncement = ref('')
const multeiUpdatedAt = ref(0)

const multeiUpdatedAtLabel = computed(() => {
  if (!multeiUpdatedAt.value) return ''
  return new Date(multeiUpdatedAt.value).toLocaleTimeString(currentLocaleTag(), { hour: '2-digit', minute: '2-digit' })
})

let hasHydratedMulteiStats = false
let refreshTimer = null
let isFetchingMultei = false
let prefersReducedMotion = false
const frameIds = { total: null, resolved: null }
const timers = { badge: null, resolvedBadge: null, pulse: null, sr: null }

const formatMulteiNumber = (val) => (Number(val) || 0).toLocaleString(currentLocaleTag())

const animateValue = (targetRef, frameKey, targetValue) => {
  if (typeof window === 'undefined' || prefersReducedMotion) {
    targetRef.value = targetValue
    return
  }
  if (frameIds[frameKey]) cancelAnimationFrame(frameIds[frameKey])
  const startValue = targetRef.value || 0
  const diff = targetValue - startValue
  if (diff === 0) return
  const duration = 650
  const startTime = performance.now()
  const step = (now) => {
    const progress = Math.min((now - startTime) / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    targetRef.value = Math.round(startValue + diff * eased)
    if (progress < 1) {
      frameIds[frameKey] = requestAnimationFrame(step)
    } else {
      targetRef.value = targetValue
      frameIds[frameKey] = null
    }
  }
  frameIds[frameKey] = requestAnimationFrame(step)
}

const onMulteiCardFocusOut = (event) => {
  const card = event.currentTarget
  if (!card || !card.contains(event.relatedTarget)) {
    isMulteiCardFocused.value = false
  }
}

const announce = (message) => {
  // Anuncia o "+1" apenas quando o foco está no card, para não interromper quem navega em outro ponto.
  if (!isMulteiCardFocused.value) return
  if (timers.sr) clearTimeout(timers.sr)
  multeiLiveSrAnnouncement.value = ''
  timers.sr = setTimeout(() => {
    multeiLiveSrAnnouncement.value = message
  }, 50)
}

const triggerPlusOneEffect = (type) => {
  if (!prefersReducedMotion) {
    isMulteiPulsing.value = true
    if (timers.pulse) clearTimeout(timers.pulse)
    timers.pulse = setTimeout(() => { isMulteiPulsing.value = false }, 1400)
  }

  if (type === 'resolvidos') {
    plusOneResolvedRenderKey.value += 1
    showPlusOneResolvedBadge.value = true
    if (timers.resolvedBadge) clearTimeout(timers.resolvedBadge)
    timers.resolvedBadge = setTimeout(() => { showPlusOneResolvedBadge.value = false }, 1800)
    announce(t('home.cardMulteiSrResolved', { total: formatMulteiNumber(multeiStats.value.resolvidos) }))
  } else {
    plusOneRenderKey.value += 1
    showPlusOneBadge.value = true
    if (timers.badge) clearTimeout(timers.badge)
    timers.badge = setTimeout(() => { showPlusOneBadge.value = false }, 1800)
    announce(t('home.cardMulteiSrNew', { total: formatMulteiNumber(multeiStats.value.totalGeral) }))
  }
}

const applyMulteiSnapshot = (incoming, { notifyDiff = false } = {}) => {
  if (!incoming) return
  const prevTotal = multeiStats.value.totalGeral
  const prevResolvidos = multeiStats.value.resolvidos
  const shouldNotify = notifyDiff && hasHydratedMulteiStats

  const infracoesTransito = Math.max(0, Number(incoming.infracoesTransito || 0))
  const mobilidadeUrbana = Math.max(0, Number(incoming.mobilidadeUrbana || 0))
  const totalGeral = Math.max(infracoesTransito + mobilidadeUrbana, Number(incoming.totalGeral || 0))
  const resolvidos = Math.max(0, Number(incoming.resolvidos || 0))

  multeiStats.value = { totalGeral, infracoesTransito, mobilidadeUrbana, resolvidos }
  isLoadingMulteiStats.value = false
  hasHydratedMulteiStats = true
  animateValue(animatedTotalGeral, 'total', totalGeral)
  animateValue(animatedResolvidos, 'resolved', resolvidos)

  if (shouldNotify) {
    if (totalGeral > prevTotal) triggerPlusOneEffect('total')
    if (resolvidos > prevResolvidos) triggerPlusOneEffect('resolvidos')
  }
}

const readLastFetchAt = () => {
  try {
    return Number(localStorage.getItem(MULTEI_LAST_FETCH_KEY)) || 0
  } catch {
    return 0
  }
}

const writeLastFetchAt = (value) => {
  try {
    localStorage.setItem(MULTEI_LAST_FETCH_KEY, String(value))
  } catch {}
}

const isMulteiStale = () => Date.now() - readLastFetchAt() >= MULTEI_REFRESH_MS

const refreshMulteiStats = async ({ notifyDiff }) => {
  if (isFetchingMultei) return
  isFetchingMultei = true
  try {
    const fresh = await fetchMulteiStatsOnce(undefined, { forceRefresh: true })
    const now = Date.now()
    writeLastFetchAt(now)
    multeiUpdatedAt.value = now
    applyMulteiSnapshot(fresh, { notifyDiff })
  } catch {
    isLoadingMulteiStats.value = false
  } finally {
    isFetchingMultei = false
  }
}

const scheduleNextRefresh = () => {
  if (refreshTimer) clearTimeout(refreshTimer)
  const wait = Math.max(5000, MULTEI_REFRESH_MS - (Date.now() - readLastFetchAt()))
  refreshTimer = setTimeout(async () => {
    if (document.visibilityState === 'visible') {
      await refreshMulteiStats({ notifyDiff: true })
    }
    scheduleNextRefresh()
  }, wait)
}

const onVisibilityChange = async () => {
  if (document.visibilityState !== 'visible') return
  if (isMulteiStale()) {
    await refreshMulteiStats({ notifyDiff: true })
  }
  scheduleNextRefresh()
}

onMounted(async () => {
  prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

  if (!isMulteiStale()) {
    // Cache recente: nenhuma leitura no Firestore agora.
    const lastAt = readLastFetchAt()
    let usedCache = false
    try {
      const raw = localStorage.getItem('multei_stats_cache_v1')
      const parsed = raw ? JSON.parse(raw) : null
      if (parsed?.stats) {
        multeiUpdatedAt.value = lastAt
        applyMulteiSnapshot(parsed.stats)
        usedCache = true
      }
    } catch {}
    if (!usedCache) {
      await refreshMulteiStats({ notifyDiff: false })
    }
  } else {
    await refreshMulteiStats({ notifyDiff: false })
  }

  scheduleNextRefresh()
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
  if (refreshTimer) clearTimeout(refreshTimer)
  if (typeof window !== 'undefined') {
    Object.values(frameIds).forEach((id) => { if (id) cancelAnimationFrame(id) })
  }
  Object.values(timers).forEach((id) => { if (id) clearTimeout(id) })
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
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 4px;
  transition: color var(--transition-fast);
  margin-top: auto;
  font-size: 1rem;
}

.link-more:hover {
  color: var(--primary);
  text-decoration-thickness: 3px;
}

/* Card Multei com Contador em Tempo Real */
.multei-live-card.is-live-pulsing {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-muted), var(--shadow-md);
}

.multei-counter-showcase {
  flex-direction: column;
  gap: 0.65rem;
  height: auto;
  min-height: 160px;
  width: 100%;
}

.multei-counters-split {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  width: 100%;
}

.multei-counter-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.85rem 0.65rem;
  border-radius: var(--radius-lg, 14px);
  background: var(--surface-elevated, rgba(109, 40, 217, 0.05));
  border: 1px solid var(--border);
  text-align: center;
  transition: border-color var(--transition-fast), transform var(--transition-smooth);
}

.multei-counter-block.is-resolved-block {
  background: rgba(22, 163, 74, 0.06);
  border-color: rgba(22, 163, 74, 0.28);
}

.multei-counter-block-label {
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1.25;
  color: var(--text-muted);
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
  font-size: clamp(2.35rem, 4.2vw, 3.35rem);
  font-weight: 900;
  line-height: 0.98;
  letter-spacing: -0.04em;
  color: var(--primary);
  font-variant-numeric: tabular-nums;
  text-shadow: 0 10px 24px rgba(109, 40, 217, 0.22);
  transition: transform var(--transition-smooth), text-shadow var(--transition-smooth);
}

.multei-counter-number.is-resolved-number {
  color: #16a34a;
  text-shadow: 0 10px 24px rgba(22, 163, 74, 0.22);
}

.pillar-card:hover .multei-counter-number {
  transform: translateY(-4px) scale(1.08);
  text-shadow: 0 16px 32px rgba(109, 40, 217, 0.32);
}

.pillar-card:hover .multei-counter-number.is-resolved-number {
  text-shadow: 0 16px 32px rgba(22, 163, 74, 0.32);
}

.multei-counter-number.is-loading {
  opacity: 0.55;
}

.multei-plus-one-badge {
  position: absolute;
  left: calc(100% + 0.35rem);
  top: 0;
  padding: 0.16rem 0.48rem;
  border-radius: var(--radius-full);
  background-color: #16a34a;
  color: #ffffff;
  font-size: 0.82rem;
  font-weight: 800;
  box-shadow: var(--shadow-sm);
  pointer-events: none;
}

@media (max-width: 480px) {
  .multei-counters-split {
    gap: 0.5rem;
  }

  .multei-counter-block {
    padding: 0.7rem 0.45rem;
  }
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
  .actions-header {
    padding: 0 1.5rem;
  }

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

.action-card h3 {
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

/* Hero: três caminhos */
.hero-path {
  min-width: 200px;
}

.hero-story-link {
  color: var(--secondary);
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 4px;
}

.hero-story-link:hover {
  color: var(--primary);
}

/* Links dos cards de projeto */
.card-links {
  margin-top: auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1.25rem;
}

.card-cta {
  align-self: flex-start;
  margin-top: auto;
}

.card-links .card-cta,
.card-links .link-more {
  margin-top: 0;
}

/* Contador do mapa colaborativo */
.multei-live-card:focus-within {
  border-color: var(--primary);
}

.multei-counter-icon {
  font-size: 1.15rem;
  line-height: 1;
}

.multei-updated-at {
  margin: 0;
  min-height: 1.2em;
  font-size: 0.8rem !important;
  color: var(--text-muted);
  text-align: center;
}

/* Blog recente */
.blog-section {
  padding: 5rem 0;
}

.blog-grid {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.75rem;
}

@media (max-width: 960px) {
  .blog-grid {
    grid-template-columns: 1fr;
  }
}

.blog-card {
  position: relative;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  overflow: hidden;
  transition: transform var(--transition-smooth), border-color var(--transition-smooth), box-shadow var(--transition-smooth);
}

.blog-card:hover,
.blog-card:focus-within {
  transform: translateY(-4px);
  border-color: var(--primary);
  box-shadow: var(--shadow-md);
}

.blog-card-img-wrap {
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: var(--surface);
}

.blog-card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.blog-card-body {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1.5rem;
  flex: 1;
}

.blog-card-category {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--primary);
}

.blog-card-title {
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.35;
}

.blog-card-link {
  color: var(--text);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 4px;
}

.blog-card:hover .blog-card-link {
  text-decoration-thickness: 2px;
}

/* Card inteiro clicável, mantendo um único link acessível */
.blog-card-link::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
}

.blog-card-link:focus-visible {
  outline: none;
}

.blog-card:has(.blog-card-link:focus-visible) {
  outline: 3px solid var(--primary);
  outline-offset: 3px;
}

.blog-card-date {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.blog-card-desc {
  font-size: 0.98rem;
  line-height: 1.6;
  color: var(--text-muted);
}

.blog-card .link-more {
  margin-top: auto;
}

.blog-see-all {
  display: flex;
  justify-content: center;
  margin-top: 2.5rem;
}

/* Menos animações quando o sistema pede */
@media (prefers-reduced-motion: reduce) {
  .pillar-card,
  .pillar-card:hover,
  .action-card:hover,
  .blog-card:hover,
  .blog-card:focus-within {
    transform: none;
  }

  .pillar-card:hover .pillar-img,
  .pillar-card:hover .multei-counter-number {
    transform: none;
  }

  .multei-live-dot {
    animation: none;
  }

  .plus-one-pop-enter-active {
    animation: none;
  }
}
/* Mobile: hero mais compacto para caber inteiro na primeira tela */
@media (max-width: 768px) {
  .hero-section {
    min-height: auto;
    padding: 1.75rem 0 2.5rem;
  }

  .hero-container {
    gap: 1.1rem;
  }

  .hero-heading {
    font-size: clamp(1.75rem, 7.4vw, 2.4rem);
  }

  .hero-lead {
    font-size: 1.02rem;
    line-height: 1.6;
  }

  .hero-actions {
    flex-direction: column;
    align-items: stretch;
    gap: 0.7rem;
    width: 100%;
    max-width: 320px;
    margin-top: 0.25rem;
  }

  .hero-path {
    min-width: 0;
    width: 100%;
    padding-top: 0.8rem;
    padding-bottom: 0.8rem;
  }
}
</style>
