<template>
  <div class="privacy-page container">
    <AppSeo :title="$t('seo.privacy.title')" :description="$t('seo.privacy.description')" />
    <section class="section privacy-section" :aria-labelledby="'privacy-title-' + locale">
      <span class="badge">{{ $t('privacy.badge') }}</span>
      <h1 :id="'privacy-title-' + locale" class="title">
        {{ $t('privacy.title1') }}<span class="gradient-text">{{ $t('privacy.titleHighlight') }}</span>{{ $t('privacy.title2') }}
      </h1>
      
      <div class="privacy-meta text-muted">
        <p><strong>{{ locale === 'pt' ? 'Última atualização:' : (locale === 'es' ? 'Última actualización:' : 'Last updated:') }}</strong> {{ $t('privacy.lastUpdated') }}</p>
      </div>

      <div class="grid-layout">
        <div class="content-rich text-muted">
          <p class="intro-lead">
            {{ $t('privacy.introLead') }}
          </p>

          <nav class="index-box glass" aria-label="Sumário da política de privacidade">
            <h2 class="index-title">{{ $t('privacy.indexTitle') }}</h2>
            <ol class="index-list">
              <li><a href="#item-1" class="index-link">{{ $t('privacy.topics.t1') }}</a></li>
              <li><a href="#item-2" class="index-link">{{ $t('privacy.topics.t2') }}</a></li>
              <li><a href="#item-3" class="index-link">{{ $t('privacy.topics.t3') }}</a></li>
              <li><a href="#item-4" class="index-link">{{ $t('privacy.topics.t4') }}</a></li>
              <li><a href="#item-5" class="index-link">{{ $t('privacy.topics.t5') }}</a></li>
              <li><a href="#item-6" class="index-link">{{ $t('privacy.topics.t6') }}</a></li>
              <li><a href="#item-7" class="index-link">{{ $t('privacy.topics.t7') }}</a></li>
              <li><a href="#item-8" class="index-link">{{ $t('privacy.topics.t8') }}</a></li>
              <li><a href="#item-9" class="index-link">{{ $t('privacy.topics.t9') }}</a></li>
              <li><a href="#item-10" class="index-link">{{ $t('privacy.topics.t10') }}</a></li>
            </ol>
          </nav>

          <div class="policy-clauses">
            <article id="item-1" class="policy-article">
              <h2>{{ $t('privacy.item1.title') }}</h2>
              <p>{{ $t('privacy.item1.intro') }}</p>
              <ul>
                <li><strong>{{ $t('privacy.item1.legalBasesTerm') }}:</strong> {{ $t('privacy.item1.legalBasesDesc') }}</li>
                <li><strong>{{ $t('privacy.item1.cookiesTerm') }}:</strong> {{ $t('privacy.item1.cookiesDesc') }}</li>
                <li><strong>{{ $t('privacy.item1.analyticsTerm') }}:</strong> {{ $t('privacy.item1.analyticsDesc') }}</li>
                <li><strong>{{ $t('privacy.item1.deviceTerm') }}:</strong> {{ $t('privacy.item1.deviceDesc') }}</li>
                <li><strong>{{ $t('privacy.item1.personalTerm') }}:</strong> {{ $t('privacy.item1.personalDesc') }}</li>
                <li><strong>{{ $t('privacy.item1.platformsTerm') }}:</strong> {{ $t('privacy.item1.platformsDesc') }}</li>
              </ul>
            </article>

            <article id="item-2" class="policy-article">
              <h2>{{ $t('privacy.item2.title') }}</h2>
              <p>{{ $t('privacy.item2.desc') }}</p>
            </article>

            <article id="item-3" class="policy-article">
              <h2>{{ $t('privacy.item3.title') }}</h2>
              <p>{{ $t('privacy.item3.desc') }}</p>
            </article>

            <article id="item-4" class="policy-article">
              <h2>{{ $t('privacy.item4.title') }}</h2>
              <p>{{ $t('privacy.item4.desc') }}</p>
            </article>

            <article id="item-5" class="policy-article">
              <h2>{{ $t('privacy.item5.title') }}</h2>
              <p>{{ $t('privacy.item5.desc') }}</p>
            </article>

            <article id="item-6" class="policy-article">
              <h2>{{ $t('privacy.item6.title') }}</h2>
              <p>
                {{ $t('privacy.item6.desc') }}
                <NuxtLink :to="localePath('/contato')" class="link-underlined">
                  {{ locale === 'pt' ? 'Fale Conosco' : (locale === 'es' ? 'Contacto' : 'Contact Us') }}
                </NuxtLink>.
              </p>
            </article>

            <article id="item-7" class="policy-article">
              <h2>{{ $t('privacy.item7.title') }}</h2>
              <p>{{ $t('privacy.item7.desc') }}</p>
            </article>

            <article id="item-8" class="policy-article">
              <h2>{{ $t('privacy.item8.title') }}</h2>
              <p>{{ $t('privacy.item8.desc') }}</p>
            </article>

            <article id="item-9" class="policy-article">
              <h2>{{ $t('privacy.item9.title') }}</h2>
              <p>
                {{ $t('privacy.item9.desc') }}
                <NuxtLink :to="localePath('/contato')" class="link-underlined">
                  {{ locale === 'pt' ? 'Fale Conosco' : (locale === 'es' ? 'Contacto' : 'Contact Us') }}
                </NuxtLink>.
              </p>
            </article>

            <article id="item-10" class="policy-article">
              <h2>{{ $t('privacy.item10.title') }}</h2>
              <p>{{ $t('privacy.item10.desc') }}</p>
            </article>

            <div class="policy-signature">
              <p><strong>{{ $t('privacy.signature') }}</strong></p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
const { locale } = useI18n()
const localePath = useLocalePath()
</script>

<style scoped>
.privacy-page {
  padding: 3rem 1rem 6rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 4rem;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.title {
  font-size: clamp(2rem, 4vw, 3.2rem);
  line-height: 1.2;
  font-weight: 800;
  letter-spacing: -0.02em;
  max-width: 900px;
}

.privacy-meta {
  font-size: 1rem;
  border-left: 3px solid var(--primary);
  padding-left: 1rem;
  margin-top: -1rem;
}

.intro-lead {
  font-size: 1.25rem;
  line-height: 1.7;
  color: var(--text);
  margin-bottom: 2.5rem;
}

.content-rich {
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.index-box {
  padding: 2rem;
  border-radius: var(--radius-lg);
  border: 1px solid rgba(255, 255, 255, 0.05);
  background: #edeef1;
}

.index-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 1.2rem;
}

.index-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.index-link {
  color: var(--primary);
  font-size: 1rem;
  text-decoration: none;
  transition: color var(--transition-fast);
  font-weight: 500;
}

.index-link:hover {
  color: var(--secondary);
}

.policy-clauses {
  display: flex;
  flex-direction: column;
  gap: 3.5rem;
  margin-top: 2rem;
}

.policy-article {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  scroll-margin-top: 100px;
}

.policy-article h2 {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.5rem;
}

.policy-article p {
  font-size: 1.1rem;
  line-height: 1.7;
}

.policy-article ul {
  list-style-type: disc;
  padding-left: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.policy-article li {
  font-size: 1.05rem;
  line-height: 1.6;
}

.link-underlined {
  color: var(--secondary);
  text-decoration: none;
  font-weight: 600;
  border-bottom: 2px solid rgba(219, 39, 119, 0.2);
  transition: border-color var(--transition-fast);
}

.link-underlined:hover {
  border-color: var(--secondary);
}

.policy-signature {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px dashed var(--border);
  font-size: 1.1rem;
}
</style>
