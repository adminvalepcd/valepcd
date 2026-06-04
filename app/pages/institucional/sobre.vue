<template>
  <div class="sobre-page container">
    <AppSeo :title="$t('seo.about.title')" :description="$t('seo.about.description')" />
    <section class="section history-section" aria-labelledby="sobre-title">
      <span class="badge">{{ $t('about.badgeHistory') }}</span>
      <h1 id="sobre-title" class="title">
        {{ $t('about.historyTitle') }}<span class="gradient-text">{{ $t('about.historyTitleHighlight') }}</span>{{
        $t('about.historyTitleEnd') }}
      </h1>
      
      <div class="grid-layout">
        <div class="content-rich text-muted">
          <p v-html="$t('about.p1')"></p>
          <p v-html="$t('about.p2')"></p>
          <p>{{ $t('about.p3') }}</p>
        </div>
        
        <div class="info-box glass">
          <div class="info-item">
            <h3>{{ $t('about.mission') }}</h3>
            <p>{{ $t('about.missionDesc') }}</p>
          </div>
          
          <div class="info-item">
            <h3>{{ $t('about.vision') }}</h3>
            <p>{{ $t('about.visionDesc') }}</p>
          </div>

          <div class="info-item">
            <h3>{{ $t('about.values') }}</h3>
            <p>{{ $t('about.valuesDesc') }}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="section team-section" aria-labelledby="team-title">
      <div class="text-center">
        <span class="badge">{{ $t('about.badgeTeam') }}</span>
        <h2 id="team-title" class="section-title">{{ $t('about.teamTitle') }}</h2>
      </div>
      
      <div class="team-grid">
        <div class="team-card glass" v-for="member in team" :key="member.name">
          <div class="avatar-container">
            <img :src="member.image" :alt="'Foto de ' + member.name" class="avatar" loading="lazy" />
            <div class="avatar-gradient"></div>
          </div>
          <h3 class="member-name">{{ member.name }}</h3>
          <p class="member-role" v-if="member.role">{{ member.role }}</p>
        </div>
      </div>
    </section>

    <section class="section media-section" aria-labelledby="media-title">
      <div class="media-card glass">
        <div class="media-content">
          <span class="badge">{{ $t('about.badgeMedia') }}</span>
          <h2 id="media-title" class="media-heading">{{ $t('about.mediaTitle') }}</h2>
          <p class="text-muted" v-html="$t('about.mediaDesc')"></p>
          <div class="media-action">
            <a href="https://www.youtube.com/watch?v=MLSyOLxqqfA" target="_blank" rel="noreferrer noopener" class="btn btn-primary">
              <span>{{ $t('about.mediaBtn') }}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
      import { computed } from 'vue'

      const { t, locale } = useI18n()

      const team = computed(() => [
        {
          name: 'Priscila Siqueira',
          role: locale.value === 'en' ? 'Co-founder & Director' : (locale.value === 'es' ? 'Co-fundadora & Directora' : 'Co-idealizadora & Diretora'),
          image: '/images/sobre/priscila.webp'
        },
        {
          name: 'Alexsandro Sousa',
          role: locale.value === 'en' ? 'Co-founder & Director' : (locale.value === 'es' ? 'Co-fundador & Director' : 'Co-idealizador & Diretor'),
          image: '/images/sobre/alexsandro.webp'
        },
        {
          name: 'Beto Maia',
          role: locale.value === 'en' ? 'Co-founder & Director' : (locale.value === 'es' ? 'Co-fundador & Director' : 'Co-idealizador & Diretor'),
          image: '/images/sobre/beto.webp'
        },
        {
          name: 'Jonas Marssaro',
          role: locale.value === 'en' ? 'Co-founder & Director' : (locale.value === 'es' ? 'Co-fundador & Director' : 'Co-idealizador & Diretor'),
          image: '/images/sobre/jonas.webp'
        },
        {
          name: 'Thomas Nader',
          role: locale.value === 'en' ? 'Executive Director' : (locale.value === 'es' ? 'Director Ejecutivo' : 'Diretor Executivo'),
          image: '/images/sobre/thomas.webp'
        }
      ])
</script>

<style scoped>
.sobre-page {
  padding: 3rem 1rem 6rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 6rem;
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

.grid-layout {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 4rem;
  align-items: start;
}

@media (max-width: 960px) {
  .grid-layout {
    grid-template-columns: 1fr;
    gap: 3rem;
  }
}

.content-rich {
  display: flex;
  flex-direction: column;
  gap: 1.8rem;
}

.content-rich p {
  font-size: 1.2rem;
  line-height: 1.8;
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

.info-box {
  padding: 2.5rem;
  border-radius: var(--radius-xl);
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
  background: linear-gradient(135deg, rgba(109, 40, 217, 0.03), rgba(219, 39, 119, 0.03));
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.info-item h3 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--primary);
  margin-bottom: 0.6rem;
  letter-spacing: -0.01em;
}

.info-item p {
  font-size: 1.05rem;
  line-height: 1.6;
  color: var(--text-muted);
}

/* Team Section */
.text-center {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.section-title {
  font-size: clamp(1.8rem, 3vw, 2.6rem);
  font-weight: 800;
  letter-spacing: -0.01em;
}

.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 2.5rem;
}

.team-card {
  padding: 2rem;
  border-radius: var(--radius-xl);
  text-align: center;
  transition: transform var(--transition-normal), box-shadow var(--transition-normal);
  border: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.team-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
}

.avatar-container {
  position: relative;
  width: 150px;
  height: 150px;
  margin-bottom: 1.5rem;
  border-radius: 50%;
  overflow: hidden;
  padding: 4px;
  background: linear-gradient(135deg, var(--primary), var(--secondary));
}

.avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  border: 4px solid var(--bg);
}

.avatar-gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.4));
  pointer-events: none;
  border-radius: 50%;
}

.member-name {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 0.4rem;
}

.member-role {
  font-size: 0.95rem;
  color: var(--text-muted);
}

/* Media Section */
.media-card {
  border-radius: var(--radius-2xl);
  padding: 4rem 3rem;
  background: linear-gradient(135deg, rgba(109, 40, 217, 0.05), rgba(219, 39, 119, 0.02));
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.media-content {
  max-width: 750px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  align-items: center;
  text-align: center;
}

.media-heading {
  font-size: clamp(1.6rem, 2.5vw, 2.2rem);
  font-weight: 800;
  margin-top: 0.5rem;
}

.media-content p {
  font-size: 1.15rem;
  line-height: 1.7;
}

.media-action {
  margin-top: 1.5rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.8rem 2rem;
  border-radius: var(--radius-lg);
  font-weight: 600;
  text-decoration: none;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  color: #ffffff;
  box-shadow: 0 8px 20px rgba(109, 40, 217, 0.25);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(109, 40, 217, 0.35);
}
</style>

