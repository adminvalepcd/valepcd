<template>
  <!--
    RASCUNHO PARA VALIDAÇÃO — seção de impacto / prova social.
    Só é exibida em desenvolvimento ou com ?preview=impacto (ver app/pages/index.vue).
    Confira os números antes de publicar (e depois traduza os textos em i18n/locales).
  -->
  <section class="impact-section" aria-labelledby="impact-title">
    <div class="container">
      <span class="badge flex-center-self">Nosso impacto</span>
      <h2 id="impact-title" class="section-title text-center">O que já construímos juntos</h2>
      <p class="section-subtitle text-center">
        Desde 2020, o Vale PCD acolhe, informa e abre portas para pessoas com deficiência LGBTI+.
      </p>

      <ul class="impact-grid" role="list">
        <li v-for="item in stats" :key="item.label" class="impact-card glass">
          <span class="impact-icon" aria-hidden="true">{{ item.icon }}</span>
          <span class="impact-value">{{ item.value }}</span>
          <span class="impact-label">{{ item.label }}</span>
        </li>
      </ul>


      <div class="impact-partners">
        <h3 class="impact-partners-title">Quem já caminhou com a gente</h3>
        <LogoCarousel id-prefix="impacto-parceiros" />
      </div>
    </div>
  </section>
</template>

<script setup>
const yearsActive = new Date().getFullYear() - 2020

const stats = [
  { icon: '🗓️', value: `${yearsActive} anos`, label: 'de atuação (desde 2020)' },
  { icon: '💬', value: '+8.000', label: 'atendimentos psicológicos realizados (dado da página Psicoterapia)' },
  { icon: '🤝', value: '+1.000', label: 'pessoas inscritas e acolhidas (dado da página Psicoterapia)' },
  { icon: '🏢', value: '+80', label: 'empresas atendidas com mentorias e palestras' }
]

</script>

<style scoped>
.impact-section {
  padding: 5rem 0;
  background: linear-gradient(180deg, transparent, rgba(134, 0, 125, 0.05), transparent);
}

.impact-preview-flag {
  margin: 0 auto 1.5rem;
  width: fit-content;
  padding: 0.4rem 0.9rem;
  border-radius: var(--radius-full);
  border: 2px dashed #b45309;
  background: #fef3c7;
  color: #78350f;
  font-size: 0.85rem;
  font-weight: 700;
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
