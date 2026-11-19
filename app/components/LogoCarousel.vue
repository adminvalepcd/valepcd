<template>
  <div class="logo-carousel">
    <!-- Atalho para pular o carrossel (visível ao receber foco pelo teclado) -->
    <a :href="'#' + endAnchorId" class="logo-carousel-skip" @click.prevent="skipToEnd">
      {{ $t('logoCarousel.skip') }}
    </a>

    <div class="logo-carousel-controls">
      <button
        type="button"
        class="logo-carousel-toggle"
        :aria-controls="viewportId"
        @click="isPaused = !isPaused"
      >
        <svg v-if="isPaused" class="toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
        <svg v-else class="toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor" /></svg>
        <span v-if="isPaused">{{ $t('logoCarousel.play') }}</span>
        <span v-else>{{ $t('logoCarousel.pause') }}</span>
      </button>
    </div>

    <div
      :id="viewportId"
      class="logo-carousel-viewport"
      :class="{ 'is-paused': isPaused }"
    >
      <div class="logo-carousel-track" :style="{ '--logo-carousel-duration': durationSeconds + 's' }">
        <ul class="logo-carousel-list" role="list" :aria-label="$t('logoCarousel.listLabel')">
          <li v-for="logo in logos" :key="logo.src" class="logo-carousel-item">
            <img
              :src="logo.src"
              :alt="logo.name"
              :width="logo.width"
              :height="logo.height"
              loading="lazy"
              decoding="async"
              class="logo-carousel-img"
            />
          </li>
        </ul>
        <!-- Cópia apenas visual para o loop contínuo (oculta de leitores de tela) -->
        <ul class="logo-carousel-list" role="presentation" aria-hidden="true">
          <li v-for="logo in logos" :key="'dup-' + logo.src" class="logo-carousel-item">
            <img
              :src="logo.src"
              alt=""
              :width="logo.width"
              :height="logo.height"
              loading="lazy"
              decoding="async"
              class="logo-carousel-img"
            />
          </li>
        </ul>
      </div>
    </div>

    <span :id="endAnchorId" ref="endAnchorRef" class="sr-only" tabindex="-1">
      {{ $t('logoCarousel.end') }}
    </span>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import companyLogos from '~/data/companyLogos.json'

const props = defineProps({
  // Prefixo para ids únicos caso o componente seja usado mais de uma vez na página
  idPrefix: { type: String, default: 'logos-parceiros' }
})

const logos = companyLogos
const viewportId = `${props.idPrefix}-carrossel`
const endAnchorId = `${props.idPrefix}-fim`
const endAnchorRef = ref(null)
const isPaused = ref(false)

// Velocidade constante independentemente da quantidade de logos (~2,8s por logo)
const durationSeconds = computed(() => Math.max(30, Math.round(logos.length * 2.8)))

const skipToEnd = () => {
  endAnchorRef.value?.focus()
  if (typeof history !== 'undefined') {
    history.replaceState(history.state, '', '#' + endAnchorId)
  }
}

onMounted(() => {
  // Quem pede menos movimento no sistema começa com a animação parada
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    isPaused.value = true
  }
})
</script>

<style scoped>
.logo-carousel {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.logo-carousel-skip {
  position: absolute;
  left: 0;
  top: -0.5rem;
  transform: translateY(-120%);
  padding: 0.55rem 1rem;
  border-radius: var(--radius-md, 10px);
  background: var(--primary);
  color: #ffffff;
  font-weight: 700;
  text-decoration: none;
  z-index: 5;
  opacity: 0;
  pointer-events: none;
}

.logo-carousel-skip:focus,
.logo-carousel-skip:focus-visible {
  transform: translateY(-100%);
  opacity: 1;
  pointer-events: auto;
  outline: 3px solid var(--text);
  outline-offset: 2px;
}

.logo-carousel-controls {
  display: flex;
  justify-content: flex-end;
}

.logo-carousel-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.95rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-strong, var(--border));
  background: var(--surface);
  color: var(--text);
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: border-color var(--transition-fast), background-color var(--transition-fast);
}

.logo-carousel-toggle:hover {
  border-color: var(--primary);
  background: var(--primary-muted);
}

.logo-carousel-toggle:focus-visible {
  outline: 3px solid var(--primary);
  outline-offset: 2px;
}

.toggle-icon {
  width: 1em;
  height: 1em;
}

.logo-carousel-viewport {
  overflow: hidden;
  /* Esmaece as bordas para o loop parecer contínuo */
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
}

.logo-carousel-track {
  display: flex;
  width: max-content;
  animation: logo-carousel-scroll var(--logo-carousel-duration, 80s) linear infinite;
}

/* Pausa no hover e quando o usuário clica em pausar */
.logo-carousel-viewport:hover .logo-carousel-track,
.logo-carousel-viewport.is-paused .logo-carousel-track {
  animation-play-state: paused;
}

/* Parado: permite rolar lateralmente para ver todos os logos */
.logo-carousel-viewport.is-paused {
  overflow-x: auto;
}

.logo-carousel-list {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 0.5rem 1.25rem 0.5rem 0;
  margin: 0;
  list-style: none;
}

.logo-carousel-item {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 104px;
  min-width: 150px;
  padding: 0.9rem 1.4rem;
  border-radius: var(--radius-lg, 14px);
  /* Fundo branco também no tema escuro para manter o contraste dos logos */
  background: #ffffff;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
}

.logo-carousel-img {
  display: block;
  max-width: none;
  object-fit: contain;
}

@keyframes logo-carousel-scroll {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}

@media (max-width: 600px) {
  .logo-carousel-item {
    height: 88px;
    min-width: 120px;
    padding: 0.7rem 1rem;
  }

  .logo-carousel-img {
    transform: scale(0.85);
  }
}

@media (prefers-reduced-motion: reduce) {
  .logo-carousel-track {
    animation-duration: calc(var(--logo-carousel-duration, 80s) * 2);
  }
}
</style>
