<template>
  <NuxtLayout name="default">
    <div class="error-page container flex-center">
      <div class="error-card glass text-center">
        <!-- SVG Graphic -->
        <div class="graphic-container">
          <svg class="error-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" fill="none">
            <!-- Background glow -->
            <circle cx="200" cy="150" r="100" fill="url(#glow-gradient)" opacity="0.15" />
            
            <!-- Graphic components -->
            <path d="M150,180 C150,150 180,120 200,120 C220,120 250,150 250,180" stroke="var(--primary)" stroke-width="8" stroke-linecap="round" stroke-dasharray="10 15" class="floating-path" />
            
            <!-- Big magnifying glass with a broken/wavy route -->
            <circle cx="200" cy="130" r="45" stroke="var(--primary)" stroke-width="8" fill="var(--surface)" class="pulse-scale" />
            <line x1="232" y1="162" x2="280" y2="210" stroke="var(--primary)" stroke-width="8" stroke-linecap="round" />
            
            <!-- Text or symbol inside the magnifier -->
            <text x="200" y="142" font-size="36" font-family="Poppins, sans-serif" font-weight="800" fill="var(--secondary)" text-anchor="middle">?</text>
            
            <!-- Cute details -->
            <circle cx="100" cy="80" r="8" fill="var(--brand-purple-pastel)" opacity="0.6" class="floating-circle-1" />
            <circle cx="310" cy="100" r="12" fill="var(--primary)" opacity="0.4" class="floating-circle-2" />
            <circle cx="120" cy="220" r="6" fill="var(--secondary)" opacity="0.5" class="floating-circle-3" />
            
            <defs>
              <radialGradient id="glow-gradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="var(--primary)" />
                <stop offset="100%" stop-color="transparent" />
              </radialGradient>
            </defs>
          </svg>
        </div>

        <h1 class="error-code gradient-text">
          {{ error.statusCode || '404' }}
        </h1>
        
        <h2 class="error-title">
          {{ title }}
        </h2>
        
        <p class="error-desc">
          {{ message }}
        </p>

        <div class="error-actions">
          <button @click="handleClearError" class="btn btn-primary">
            {{ $t('error.backHome') }}
          </button>
        </div>
      </div>
    </div>
  </NuxtLayout>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  error: {
    type: Object,
    default: () => ({})
  }
})

const { locale } = useI18n()
const localePath = useLocalePath()

const title = computed(() => {
  if (props.error?.statusCode === 404) {
    return useNuxtApp().$i18n?.t ? useNuxtApp().$i18n.t('error.title404') : 'Página não encontrada'
  }
  if (props.error?.statusCode === 500) {
    return useNuxtApp().$i18n?.t ? useNuxtApp().$i18n.t('error.title500') : 'Erro interno do servidor'
  }
  return useNuxtApp().$i18n?.t ? useNuxtApp().$i18n.t('error.titleGeneric') : 'Ops! Ocorreu um erro'
})

const message = computed(() => {
  if (props.error?.statusCode === 404) {
    return useNuxtApp().$i18n?.t ? useNuxtApp().$i18n.t('error.message404') : 'O endereço digitado pode estar incorreto ou a página foi movida.'
  }
  if (props.error?.statusCode === 500) {
    return useNuxtApp().$i18n?.t ? useNuxtApp().$i18n.t('error.message500') : 'Ocorreu um problema inesperado em nossos servidores. Por favor, tente novamente mais tarde.'
  }
  return props.error?.message || (useNuxtApp().$i18n?.t ? useNuxtApp().$i18n.t('error.messageGeneric') : 'Não foi possível carregar a página solicitada.')
})

const handleClearError = () => {
  clearError({ redirect: localePath('/') })
}
</script>

<style scoped>
.error-page {
  min-height: calc(100vh - 280px); /* Ajusta para preencher a tela considerando o header e footer */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4rem 1.5rem;
}

.error-card {
  max-width: 580px;
  width: 100%;
  padding: 3.5rem 2.5rem;
  border-radius: var(--radius-2xl);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.graphic-container {
  width: 100%;
  max-width: 320px;
  margin-bottom: -1rem;
}

.error-svg {
  width: 100%;
  height: auto;
  overflow: visible;
}

.error-code {
  font-size: clamp(4.5rem, 12vw, 6.5rem);
  font-weight: 900;
  line-height: 1;
  margin: 0;
  letter-spacing: -0.04em;
  font-family: 'Poppins', sans-serif;
  filter: drop-shadow(0 10px 20px rgba(109, 40, 217, 0.15));
}

.error-title {
  font-size: clamp(1.4rem, 4vw, 1.85rem);
  font-weight: 800;
  color: var(--text);
  margin: 0;
  line-height: 1.3;
}

.error-desc {
  font-size: clamp(0.95rem, 2.5vw, 1.1rem);
  line-height: 1.6;
  color: var(--text-muted);
  margin: 0 0 1rem 0;
  max-width: 440px;
}

.error-actions {
  width: 100%;
  display: flex;
  justify-content: center;
}

.error-actions .btn {
  width: 100%;
  max-width: 260px;
  padding: 0.85rem 2rem;
  font-size: 1rem;
  font-weight: 700;
  box-shadow: 0 4px 12px rgba(109, 40, 217, 0.2);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.error-actions .btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(109, 40, 217, 0.35);
}

/* Animations */
.pulse-scale {
  animation: pulse 4s ease-in-out infinite;
  transform-origin: 200px 130px;
}

.floating-path {
  animation: dash 20s linear infinite, float 6s ease-in-out infinite;
}

.floating-circle-1 {
  animation: floatCircle 5s ease-in-out infinite;
}

.floating-circle-2 {
  animation: floatCircle 7s ease-in-out infinite 1s;
}

.floating-circle-3 {
  animation: floatCircle 6s ease-in-out infinite 0.5s;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

@keyframes floatCircle {
  0%, 100% {
    transform: translateY(0) translateX(0);
  }
  50% {
    transform: translateY(-12px) translateX(4px);
  }
}

@keyframes dash {
  to {
    stroke-dashoffset: -250;
  }
}
</style>
