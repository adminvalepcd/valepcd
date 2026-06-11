<template>
  <div class="psicoterapia-page container animate-fade-in">
    <!-- App SEO component for title/description -->
    <AppSeo :title="$t('seo.psychotherapy.title')" :description="$t('seo.psychotherapy.description')" />

    <!-- Hero Section -->
    <section class="section hero-section" aria-labelledby="psycho-title">
      <div class="text-center-hero">
        <span class="badge">{{ $t('psychotherapy.badge') }}</span>
        <h1 id="psycho-title" class="title mt-3">
          {{ $t('psychotherapy.title') }}
          <span class="gradient-text">{{ $t('psychotherapy.titleHighlight') }}</span>
        </h1>
      </div>

      <div class="grid-layout mt-5">
        <div class="content-rich text-muted">
          <p>
            {{ $t('psychotherapy.p1_start') }}<strong>{{ $t('psychotherapy.p1_bold') }}</strong>{{ $t('psychotherapy.p1_end') }}
          </p>
        </div>

        <div class="mission-box glass">
          <div class="mission-icon">✨</div>
          <p class="mission-text">{{ $t('psychotherapy.p2') }}</p>
        </div>
      </div>
    </section>

    <!-- Action Section / CTA -->
    <section class="section action-section mt-6 mb-6" aria-labelledby="action-title">
      <div class="action-card cta-card glass p-5 text-center">
        <h2 id="action-title" class="section-title mb-3">{{ $t('psychotherapy.ctaTitle') }}</h2>
        <p class="text-muted mb-4 max-w-xl mx-auto">
          {{ $t('psychotherapy.ctaDesc') }}
        </p>
        <div class="cta-actions flex-center gap-3 flex-wrap">
          <a id="btn-register-psycho"
            href="https://docs.google.com/forms/d/e/1FAIpQLSfxBMKBY0qycEHDWJSEQ1-mhtQVPb3g7GWwpd5mgrXkWUDpLA/viewform"
            target="_blank" rel="noopener noreferrer" class="btn btn-primary">
            {{ $t('psychotherapy.btnRegister') }} &rarr;
          </a>
          <NuxtLink id="btn-donate-psycho" :to="localePath('/contato')" class="btn btn-secondary">
            {{ $t('psychotherapy.btnDonate') }}
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Stats Section -->
    <section class="section stats-section mt-6" aria-labelledby="stats-title">
      <div class="text-center">
        <h2 id="stats-title" class="section-title">{{ $t('psychotherapy.historyTitle') }}</h2>
        <p class="section-subtitle">{{ $t('psychotherapy.historyLead') }}</p>
      </div>

      <div class="stats-grid mt-4">
        <div class="stat-card glass pulse-hover">
          <div class="stat-number gradient-text">{{ $t('psychotherapy.stat1Number') }}</div>
          <div class="stat-label">{{ $t('psychotherapy.stat1Label') }}</div>
        </div>

        <div class="stat-card glass pulse-hover">
          <div class="stat-number gradient-text">{{ $t('psychotherapy.stat2Number') }}</div>
          <div class="stat-label">{{ $t('psychotherapy.stat2Label') }}</div>
        </div>

        <div class="stat-card glass pulse-hover text-highlight-purple">
          <div class="stat-number gradient-text">{{ $t('psychotherapy.stat3Number') }}</div>
          <div class="stat-label">{{ $t('psychotherapy.stat3Label') }}</div>
        </div>
      </div>
    </section>

    <!-- How It Works Section -->
    <section class="section how-section mt-6" aria-labelledby="how-title">
      <div class="card-large glass p-5">
        <div class="grid-layout">
          <div>
            <h2 id="how-title" class="section-title mb-4">{{ $t('psychotherapy.howTitle') }}</h2>
            <p class="text-muted leading-relaxed mb-4">
              {{ $t('psychotherapy.howDesc') }}
            </p>
          </div>
          <div class="callout-box flex-center">
            <p class="callout-text">
              "{{ $t('psychotherapy.howHighlight') }}"
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Team Section -->
    <section class="section team-section mt-6" aria-labelledby="team-title">
      <div class="text-center">
        <span class="badge">{{ $t('psychotherapy.teamBadge') }}</span>
        <h2 id="team-title" class="section-title mt-2">{{ $t('psychotherapy.teamTitle') }}</h2>
        <p class="section-subtitle max-w-2xl mx-auto mt-2">
          {{ $t('psychotherapy.teamLead') }}
        </p>
      </div>

      <div class="team-grid mt-5">
        <div class="team-card glass" v-for="member in team" :key="member.name">
          <div class="avatar-container">
            <img :src="member.image" :alt="'Foto de ' + member.name" class="avatar" loading="lazy" />
            <div class="avatar-gradient"></div>
          </div>
          <h3 class="member-name">{{ member.name }}</h3>
          <p class="member-role" v-if="member.roleKey">{{ $t(member.roleKey) }}</p>
          <p class="member-bio" v-if="member.bioKey">{{ $t(member.bioKey) }}</p>
        </div>
      </div>

      <p class="text-center text-muted mt-4 fs-small">
        {{ $t('psychotherapy.teamDesc') }}
      </p>
    </section>

  </div>
</template>

<script setup>
const localePath = useLocalePath()

const team = [
  {
    name: 'Camila Moreira',
    image: '/images/psicoterapia/Camila Moreira.webp',
    roleKey: 'psychotherapy.teamMembers.camila.role',
    bioKey: 'psychotherapy.teamMembers.camila.bio'
  },
  {
    name: 'Wendy Lustosa Amorim',
    image: '/images/psicoterapia/Wendy Lustosa Amorim.webp',
    roleKey: 'psychotherapy.teamMembers.wendy.role',
    bioKey: 'psychotherapy.teamMembers.wendy.bio'
  },
  {
    name: 'Deyvison Ferreira',
    image: '/images/psicoterapia/Deyvison Ferreira.webp',
    roleKey: 'psychotherapy.teamMembers.deyvison.role',
    bioKey: 'psychotherapy.teamMembers.deyvison.bio'
  },
  {
    name: 'Lucas Nogueira',
    image: '/images/psicoterapia/Lucas Nogueira.webp',
    roleKey: 'psychotherapy.teamMembers.lucas.role',
    bioKey: 'psychotherapy.teamMembers.lucas.bio'
  },
  {
    name: 'Jackson Nascimento',
    image: '/images/psicoterapia/Jackson Nascimento.webp',
    roleKey: 'psychotherapy.teamMembers.jackson.role',
    bioKey: 'psychotherapy.teamMembers.jackson.bio'
  },
  {
    name: 'Benoit Almeida',
    image: '/images/psicoterapia/Benoit Almeida.webp',
    roleKey: 'psychotherapy.teamMembers.benoit.role',
    bioKey: 'psychotherapy.teamMembers.benoit.bio'
  }
]
</script>

<style scoped>
.psicoterapia-page {
  padding: 8rem 1.5rem 6rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 4rem;
}

.text-center-hero {
  text-align: center;
  max-width: 900px;
  margin: 0 auto;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.title {
  font-size: clamp(2.2rem, 5vw, 3.5rem);
  line-height: 1.2;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.grid-layout {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 4rem;
  align-items: center;
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

.mission-box {
  padding: 2.5rem;
  border-radius: var(--radius-xl);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  background: linear-gradient(135deg, rgba(109, 40, 217, 0.04), rgba(219, 39, 119, 0.04));
  border: 1px solid rgba(255, 255, 255, 0.08);
  align-items: center;
  text-align: center;
}

.mission-icon {
  font-size: 2.5rem;
}

.mission-text {
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.6;
  color: var(--primary);
}

/* Stats Section */
.stats-section {
  text-align: center;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2.5rem;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
}

.stat-card {
  padding: 3rem 2rem;
  border-radius: var(--radius-2xl);
  text-align: center;
  transition: transform var(--transition-normal), box-shadow var(--transition-normal);
  border: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1rem;
}

.stat-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.12);
}

.stat-number {
  font-size: clamp(3rem, 6.5vw, 4.5rem);
  font-weight: 900;
  line-height: 1;
}

.stat-label {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-muted);
  line-height: 1.5;
}

/* How Section */
.card-large {
  border-radius: var(--radius-2xl);
  background: linear-gradient(135deg, rgba(109, 40, 217, 0.02), rgba(219, 39, 119, 0.02));
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.callout-box {
  background: linear-gradient(135deg, var(--primary-muted), rgba(219, 39, 119, 0.05));
  border-left: 5px solid var(--primary);
  border-radius: var(--radius-md);
  padding: 2rem;
}

.callout-text {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text);
  line-height: 1.6;
}

/* Team Section */
.text-center {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.max-w-2xl {
  max-width: 42rem;
}

.section-title {
  font-size: clamp(1.8rem, 3vw, 2.6rem);
  font-weight: 800;
  letter-spacing: -0.01em;
}

.section-subtitle {
  font-size: 1.15rem;
  color: var(--text-muted);
}

.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 3rem;
}

.team-card {
  padding: 2rem;
  border-radius: var(--radius-xl);
  text-align: center;
  transition: transform var(--transition-smooth), box-shadow var(--transition-smooth);
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
  width: 160px;
  height: 160px;
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
  font-weight: 600;
}

.member-bio {
  font-size: 0.88rem;
  color: var(--text-muted);
  line-height: 1.5;
  margin-top: 0.6rem;
}

.fs-small {
  font-size: 0.95rem;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.6;
}

/* Action Section / CTA */
.cta-card {
  background: linear-gradient(135deg, rgba(109, 40, 217, 0.05), rgba(219, 39, 119, 0.03));
  border-radius: var(--radius-2xl);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.cta-actions {
  margin-top: 1.5rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.9rem 2.2rem;
  font-weight: 600;
  border-radius: var(--radius-full);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  color: white;
  box-shadow: 0 8px 20px rgba(109, 40, 217, 0.25);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(109, 40, 217, 0.35);
}

.btn-secondary {
  background-color: transparent;
  color: var(--text);
  border: 1px solid var(--border-strong);
}

.btn-secondary:hover {
  background-color: var(--primary-muted);
  border-color: var(--primary);
  transform: translateY(-2px);
}
</style>
