<template>
  <!-- Seção de impacto / prova social da home (aprovada) -->
  <section class="impact-section" aria-labelledby="impact-title">
    <div class="container">
      <span class="badge flex-center-self">{{ $t('impact.badge') }}</span>
      <h2 id="impact-title" class="section-title text-center">{{ $t('impact.title') }}</h2>
      <p class="section-subtitle text-center">{{ $t('impact.subtitle') }}</p>

      <ul class="impact-grid" role="list">
        <li v-for="item in stats" :key="item.key" class="impact-card glass">
          <span class="impact-icon" aria-hidden="true">{{ item.icon }}</span>
          <span class="impact-value">{{ item.value }}</span>
          <span class="impact-label">{{ item.label }}</span>
        </li>
      </ul>

      <div class="impact-partners">
        <h3 class="impact-partners-title">{{ $t('impact.partnersTitle') }}</h3>
        <LogoCarousel id-prefix="impacto-parceiros" />
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const { t } = useI18n()
const yearsActive = new Date().getFullYear() - 2020

const stats = computed(() => [
  { key: 'years', icon: '🗓️', value: t('impact.yearsValue', { years: yearsActive }), label: t('impact.yearsLabel') },
  { key: 'sessions', icon: '💬', value: t('impact.sessionsValue'), label: t('impact.sessionsLabel') },
  { key: 'people', icon: '🤝', value: t('impact.peopleValue'), label: t('impact.peopleLabel') },
  { key: 'companies', icon: '🏢', value: t('impact.companiesValue'), label: t('impact.companiesLabel') }
])
</script>

<style scoped>
.impact-section {
  padding: 5rem 0;
  background: linear-gradient(180deg, transparent, rgba(134, 0, 125, 0.05), transparent);
}

.flex-center-self {
  margin: 0 auto 1rem auto;
  display: table;
}

.section-title {
  font-size: clamp(1.8rem, 3.5vw, 2.6rem);
  font-weight: 800;
  margin-bottom: 0.5rem;
}

.section-subtitle {
  margin: 0 auto 3rem;
  font-size: 1.15rem;
  color: var(--text-muted);
  max-width: 700px;
}

.text-center {
  text-align: center;
}

.impact-grid {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1.25rem;
}

@media (max-width: 960px) {
  .impact-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 480px) {
  .impact-grid {
    grid-template-columns: 1fr;
  }
}

.impact-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 1.75rem 1.25rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  text-align: center;
}

.impact-icon {
  font-size: 1.6rem;
}

.impact-value {
  font-size: clamp(1.8rem, 3vw, 2.4rem);
  font-weight: 900;
  color: var(--primary);
  font-variant-numeric: tabular-nums;
}

.impact-label {
  font-size: 0.95rem;
  color: var(--text-muted);
  line-height: 1.4;
}





.impact-partners {
  margin-top: 2.5rem;
  text-align: center;
}

.impact-partners-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 1rem;
}


</style>
