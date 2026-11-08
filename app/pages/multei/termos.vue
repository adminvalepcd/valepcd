<template>
  <div class="multei-termos-page container" :class="{ 'theme-dark': currentTheme === 'dark' }">
    <div class="top-nav-bar">
      <NuxtLink to="/multei" class="btn-back-multei" title="Voltar para o mapa interativo do Multei">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="back-icon"
          aria-hidden="true"
        >
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        <span>Ir para o Mapa do Multei</span>
      </NuxtLink>

      <div class="top-secondary-links">
        <NuxtLink to="/multei/sobre" class="btn-secondary-nav">
          Sobre o Multei
        </NuxtLink>
        <NuxtLink to="/multei/orientacoes" class="btn-secondary-nav">
          Orientações de Uso
        </NuxtLink>
      </div>
    </div>

    <nav class="quick-jump-bar" aria-label="Atalhos do documento">
      <a href="#termos-de-uso" class="quick-jump-pill">Parte 1: Termos de Uso</a>
      <a href="#politica-de-privacidade" class="quick-jump-pill">Parte 2: Política de Privacidade</a>
    </nav>

    <main class="terms-main-wrapper">
      <MulteiTermsContent heading-tag="h1" title-id="multei-termos-page-title" />
    </main>

    <div class="bottom-nav-footer">
      <NuxtLink to="/multei" class="btn-return-map">
        Voltar ao Mapa do Multei
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
const themeCookie = useCookie('theme', { default: () => 'light' });
const currentTheme = useState('theme', () => themeCookie.value || 'light');

useHead({
  title: 'Termos de Uso e Política de Privacidade - Multei | Vale PcD',
  meta: [
    {
      name: 'description',
      content:
        'Termos de Uso e Política de Privacidade completos do Multei, plataforma anônima e colaborativa de mobilidade urbana mantida pela ONG Vale PcD.'
    }
  ],
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon-multei.svg' },
    { rel: 'shortcut icon', href: '/favicon-multei.svg' }
  ]
});
</script>

<style scoped>
.multei-termos-page {
  --tp-bg-card: #ffffff;
  --tp-border: #cbd5e1;
  --tp-btn-bg: #ffffff;
  --tp-btn-text: #4a044e;
  --tp-btn-border: #4a044e;
  --tp-btn-hover-bg: #4a044e;
  --tp-btn-hover-text: #ffffff;
  --tp-sec-bg: #f1f5f9;
  --tp-sec-text: #0f172a;
  --tp-sec-border: #94a3b8;

  max-width: 920px;
  margin: 0 auto;
  padding: 2rem 1.25rem 5rem;
}

.multei-termos-page.theme-dark,
:global([data-theme="dark"] .multei-termos-page) {
  --tp-bg-card: #171c26;
  --tp-border: #334155;
  --tp-btn-bg: #171c26;
  --tp-btn-text: #f5d0fe;
  --tp-btn-border: #f0abfc;
  --tp-btn-hover-bg: #f0abfc;
  --tp-btn-hover-text: #0f172a;
  --tp-sec-bg: #171c26;
  --tp-sec-text: #f8fafc;
  --tp-sec-border: #64748b;
}

.top-nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.top-secondary-links {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.btn-back-multei {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  background: var(--tp-btn-bg);
  color: var(--tp-btn-text);
  font-weight: 800;
  font-size: 0.95rem;
  padding: 0.65rem 1.25rem;
  border-radius: 9999px;
  text-decoration: none;
  border: 2px solid var(--tp-btn-border);
  transition: all 0.2s ease;
}

.btn-back-multei:hover {
  background: var(--tp-btn-hover-bg);
  color: var(--tp-btn-hover-text);
  transform: translateX(-2px);
}

.back-icon {
  width: 18px;
  height: 18px;
}

.btn-secondary-nav {
  display: inline-flex;
  align-items: center;
  background: var(--tp-sec-bg);
  color: var(--tp-sec-text);
  border: 1.5px solid var(--tp-sec-border);
  font-weight: 700;
  font-size: 0.88rem;
  padding: 0.58rem 1.1rem;
  border-radius: 9999px;
  text-decoration: none;
  transition: all 0.2s ease;
}

.btn-secondary-nav:hover {
  background: var(--tp-btn-hover-bg);
  color: var(--tp-btn-hover-text);
  border-color: var(--tp-btn-border);
}

.quick-jump-bar {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
  margin-bottom: 1.75rem;
}

.quick-jump-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.45rem 1rem;
  border-radius: 9999px;
  background: var(--tp-sec-bg);
  color: var(--tp-sec-text);
  border: 1.5px solid var(--tp-sec-border);
  font-size: 0.85rem;
  font-weight: 700;
  text-decoration: none;
  transition: all 0.2s ease;
}

.quick-jump-pill:hover {
  border-color: var(--tp-btn-border);
  color: var(--tp-btn-text);
}

.terms-main-wrapper {
  background: var(--tp-bg-card);
  border: 1.5px solid var(--tp-border);
  border-radius: 24px;
  padding: 2.25rem 2rem;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
}

.bottom-nav-footer {
  margin-top: 2rem;
  display: flex;
  justify-content: center;
}

.btn-return-map {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #4a044e;
  color: #ffffff;
  font-weight: 800;
  font-size: 0.98rem;
  padding: 0.95rem 2rem;
  border-radius: 9999px;
  text-decoration: none;
  transition: transform 0.2s ease, filter 0.2s ease;
}

.btn-return-map:hover {
  transform: translateY(-2px);
  filter: brightness(1.08);
}

@media (max-width: 640px) {
  .multei-termos-page {
    padding: 1.25rem 1rem 3.5rem;
  }

  .terms-main-wrapper {
    padding: 1.35rem 1.1rem;
    border-radius: 18px;
  }

  .btn-return-map {
    width: 100%;
  }
}
</style>
