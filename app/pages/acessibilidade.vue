<template>
  <div class="a11y-page container">
    <AppSeo :title="$t('seo.accessibility.title')" :description="$t('seo.accessibility.description')" />

    <header class="a11y-hero">
      <span class="badge">{{ $t('accessibilityStatement.badge') }}</span>
      <h1 class="a11y-title">{{ $t('accessibilityStatement.title') }}</h1>
      <p class="a11y-lead">{{ $t('accessibilityStatement.lead') }}</p>
    </header>

    <section class="a11y-block glass" aria-labelledby="a11y-standard">
      <h2 id="a11y-standard">{{ $t('accessibilityStatement.standardTitle') }}</h2>
      <p>{{ $t('accessibilityStatement.standardText') }}</p>
    </section>

    <section class="a11y-block glass" aria-labelledby="a11y-features">
      <h2 id="a11y-features">{{ $t('accessibilityStatement.featuresTitle') }}</h2>
      <ul class="a11y-list">
        <li v-for="n in 6" :key="'f' + n">{{ $t('accessibilityStatement.feature' + n) }}</li>
      </ul>
    </section>

    <section class="a11y-block glass" aria-labelledby="a11y-limits">
      <h2 id="a11y-limits">{{ $t('accessibilityStatement.limitsTitle') }}</h2>
      <ul class="a11y-list">
        <li>{{ $t('accessibilityStatement.limit1') }}</li>
        <li>{{ $t('accessibilityStatement.limit2') }}</li>
      </ul>
      <p>{{ $t('accessibilityStatement.limitsNote') }}</p>
    </section>

    <section class="a11y-block a11y-feedback glass" aria-labelledby="a11y-feedback">
      <h2 id="a11y-feedback">{{ $t('accessibilityStatement.feedbackTitle') }}</h2>
      <p>{{ $t('accessibilityStatement.feedbackText') }}</p>
      <NuxtLink :to="localePath('/contato')" class="btn btn-primary">
        {{ $t('accessibilityStatement.feedbackCta') }}
      </NuxtLink>
    </section>

    <p class="a11y-reviewed">{{ $t('accessibilityStatement.reviewed') }}</p>
  </div>
</template>

<script setup>
const localePath = useLocalePath()
</script>

<style scoped>
.a11y-page {
  max-width: 860px;
  padding: 4rem 1.5rem 5rem;
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

.a11y-hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.a11y-title {
  font-size: clamp(2rem, 4.5vw, 3rem);
  font-weight: 800;
  line-height: 1.15;
}

.a11y-lead {
  font-size: 1.15rem;
  line-height: 1.7;
  color: var(--text-muted);
}

.a11y-block {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 2rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
}

.a11y-block h2 {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--text);
}

.a11y-block p,
.a11y-list {
  line-height: 1.7;
  color: var(--text-muted);
}

.a11y-list {
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.a11y-feedback {
  border-left: 6px solid var(--primary);
}

.a11y-feedback .btn {
  align-self: flex-start;
}

.a11y-reviewed {
  font-size: 0.9rem;
  color: var(--text-muted);
}
</style>
