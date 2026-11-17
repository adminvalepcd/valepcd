<template>
  <div class="gps-denied-help" role="region" :aria-labelledby="titleId">
    <p :id="titleId" class="gps-denied-title">
      <span aria-hidden="true">📍</span>
      {{ title }}
    </p>
    <p class="gps-denied-desc">
      O navegador bloqueou o acesso à localização deste site. Para liberar:
    </p>
    <ol class="gps-denied-steps">
      <li v-for="(stepText, idx) in help.steps" :key="idx">{{ stepText }}</li>
    </ol>
    <p v-if="help.note" class="gps-denied-note">{{ help.note }}</p>
    <div class="gps-denied-actions">
      <button type="button" class="gps-denied-btn-primary" :disabled="isRetrying" @click="emit('retry')">
        {{ isRetrying ? 'Verificando...' : 'Já liberei, tentar novamente' }}
      </button>
      <button v-if="dismissible" type="button" class="gps-denied-btn-secondary" @click="emit('dismiss')">
        {{ dismissLabel }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, useId } from 'vue';

defineProps({
  title: {
    type: String,
    default: 'Localização bloqueada'
  },
  isRetrying: {
    type: Boolean,
    default: false
  },
  dismissible: {
    type: Boolean,
    default: false
  },
  dismissLabel: {
    type: String,
    default: 'Buscar endereço manualmente'
  }
});

const emit = defineEmits(['retry', 'dismiss']);

const titleId = `gps-denied-title-${useId()}`;

// A detecção de plataforma só roda no cliente (o componente é exibido após interação/permissão negada)
const platform = ref('generic');

const detectPlatform = () => {
  if (typeof navigator === 'undefined') return 'generic';
  const ua = navigator.userAgent || '';
  const isIPadOs = /Macintosh/.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;
  const isIos = /iPhone|iPad|iPod/.test(ua) || isIPadOs;
  if (isIos) {
    return /CriOS|FxiOS|EdgiOS/.test(ua) ? 'ios-other' : 'ios-safari';
  }
  if (/Android/.test(ua)) {
    return /SamsungBrowser/.test(ua) ? 'android-samsung' : 'android-chrome';
  }
  if (/Firefox\//.test(ua)) return 'desktop-firefox';
  if (/Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\//.test(ua)) return 'desktop-safari';
  return 'desktop-chrome';
};

onMounted(() => {
  platform.value = detectPlatform();
});

const HELP_BY_PLATFORM = {
  'ios-safari': {
    steps: [
      'Toque em "aA" (ou no ícone à esquerda do endereço) na barra do Safari.',
      'Toque em "Ajustes do Site" e, em "Localização", escolha "Permitir" ou "Perguntar".',
      'Se não funcionar: abra Ajustes do iPhone › Privacidade e Segurança › Serviços de Localização › Safari e escolha "Ao Usar o App".'
    ],
    note: 'Depois de liberar, volte aqui e toque em "Já liberei, tentar novamente".'
  },
  'ios-other': {
    steps: [
      'Abra os Ajustes do iPhone.',
      'Vá em Privacidade e Segurança › Serviços de Localização e confirme que está ativado.',
      'Na mesma lista, toque no navegador que você está usando e escolha "Ao Usar o App".'
    ],
    note: 'Depois de liberar, volte aqui e toque em "Já liberei, tentar novamente".'
  },
  'android-chrome': {
    steps: [
      'Toque no ícone à esquerda do endereço do site (cadeado ou ajustes).',
      'Toque em "Permissões" e ative "Localização".',
      'Confirme também que a Localização do aparelho está ligada (puxe a barra de notificações e toque em "Local").'
    ],
    note: null
  },
  'android-samsung': {
    steps: [
      'Toque no menu (☰) do Samsung Internet › Configurações.',
      'Vá em "Sites e downloads" › "Permissões do site" › "Localização".',
      'Remova o bloqueio deste site e confirme que a Localização do aparelho está ligada.'
    ],
    note: null
  },
  'desktop-firefox': {
    steps: [
      'Clique no ícone de permissões (cadeado) à esquerda do endereço.',
      'Remova o bloqueio de "Acessar sua localização".',
      'Recarregue a página, se necessário.'
    ],
    note: null
  },
  'desktop-safari': {
    steps: [
      'No menu do Safari, abra Ajustes › Sites › Localização.',
      'Encontre este site na lista e escolha "Permitir" ou "Perguntar".',
      'Recarregue a página, se necessário.'
    ],
    note: null
  },
  'desktop-chrome': {
    steps: [
      'Clique no ícone à esquerda do endereço do site (cadeado ou ajustes).',
      'Abra "Configurações do site" e, em "Localização", escolha "Permitir".',
      'Recarregue a página, se necessário.'
    ],
    note: null
  },
  generic: {
    steps: [
      'Abra as permissões do site pelo ícone à esquerda do endereço.',
      'Libere o acesso à "Localização".',
      'Confirme que a localização do aparelho está ligada.'
    ],
    note: null
  }
};

const help = computed(() => HELP_BY_PLATFORM[platform.value] || HELP_BY_PLATFORM.generic);
</script>

<style scoped>
.gps-denied-help {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 14px;
  background: #fff7ed;
  border: 1px solid #fdba74;
  color: #431407;
  text-align: left;
}

.gps-denied-title {
  margin: 0;
  font-weight: 800;
  font-size: 1rem;
}

.gps-denied-desc,
.gps-denied-note {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.45;
}

.gps-denied-note {
  color: #7c2d12;
}

.gps-denied-steps {
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.9rem;
  line-height: 1.45;
}

.gps-denied-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.gps-denied-btn-primary,
.gps-denied-btn-secondary {
  min-height: 44px;
  padding: 10px 14px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
}

.gps-denied-btn-primary {
  background: #c2410c;
  color: #ffffff;
  border: none;
}

.gps-denied-btn-primary:disabled {
  opacity: 0.7;
  cursor: wait;
}

.gps-denied-btn-secondary {
  background: transparent;
  color: #7c2d12;
  border: 1px solid #fdba74;
}

.gps-denied-btn-primary:focus-visible,
.gps-denied-btn-secondary:focus-visible {
  outline: 3px solid #1d4ed8;
  outline-offset: 2px;
}
</style>
