<template>
  <div
    v-show="!isCollapsed"
    class="manual-adsense-wrapper"
    data-manual-ad-banner="true"
  >
    <span v-if="safeLabel && (isAdVisible || showDevFallback)" class="manual-adsense-label">
      {{ safeLabel }}
    </span>

    <div
      class="manual-adsense-slot-box"
      :style="{
        width: `${safeWidth}px`,
        minHeight: `${safeHeight}px`
      }"
    >
      <ins
        v-if="isClientMounted && isValidConfig && !showDevFallback"
        ref="insElementRef"
        class="adsbygoogle manual-adsense-ins"
        :style="{
          display: 'inline-block',
          width: `${safeWidth}px`,
          height: `${safeHeight}px`
        }"
        :data-ad-client="safeAdClient"
        :data-ad-slot="safeAdSlot"
        :data-adtest="isLocalDevEnvironment ? 'on' : undefined"
      ></ins>

      <!-- Simulação visual exclusiva para localhost/dev (nunca exibida em produção) -->
      <div
        v-if="showDevFallback"
        class="manual-adsense-dev-preview"
        :style="{
          width: `${safeWidth}px`,
          height: `${safeHeight}px`
        }"
        role="note"
        aria-label="Pré-visualização de anúncio em ambiente de desenvolvimento"
      >
        <span class="dev-preview-badge">DEV</span>
        <div class="dev-preview-text">
          <strong>Banner AdSense ({{ safeWidth }}×{{ safeHeight }})</strong>
          <span>Slot {{ safeAdSlot }} • Visível real em produção</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRuntimeConfig } from '#imports';

export type AdSenseReadyStatus = 'filled' | 'dev-preview' | 'unfilled' | 'blocked' | 'timeout' | 'invalid';

interface Props {
  adSlot: string;
  adClient?: string;
  width?: number;
  height?: number;
  timeoutMs?: number;
  label?: string;
  devPreview?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  adClient: '',
  width: 320,
  height: 50,
  timeoutMs: 2500,
  label: 'Publicidade',
  devPreview: true
});

const emit = defineEmits<{
  (e: 'ready', payload: { status: AdSenseReadyStatus }): void;
}>();

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>> & { loaded?: boolean };
  }
}

const runtimeConfig = useRuntimeConfig();

const AD_CLIENT_PATTERN = /^ca-pub-\d{10,24}$/;
const AD_SLOT_PATTERN = /^\d{6,24}$/;

const clampInteger = (value: unknown, min: number, max: number, fallback: number): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
};

const safeAdClient = computed(() => {
  const candidate = String(props.adClient || runtimeConfig.public.adsenseClient || '').trim();
  return AD_CLIENT_PATTERN.test(candidate) ? candidate : '';
});

const safeAdSlot = computed(() => {
  const candidate = String(props.adSlot || '').trim();
  return AD_SLOT_PATTERN.test(candidate) ? candidate : '';
});

const isValidConfig = computed(() => Boolean(safeAdClient.value && safeAdSlot.value));
const safeWidth = computed(() => clampInteger(props.width, 120, 1200, 320));
const safeHeight = computed(() => clampInteger(props.height, 30, 600, 50));
const safeTimeoutMs = computed(() => clampInteger(props.timeoutMs, 400, 8000, 2500));
const safeLabel = computed(() => String(props.label || '').trim().slice(0, 40));

const insElementRef = ref<HTMLElement | null>(null);
const isClientMounted = ref(false);
const isLocalDevEnvironment = ref(false);
const isCollapsed = ref(false);
const isAdVisible = ref(false);
const showDevFallback = ref(false);

let hasSettled = false;
let adObserver: MutationObserver | null = null;
let mainTimeoutId: ReturnType<typeof setTimeout> | null = null;
let adblockCheckTimerId: ReturnType<typeof setTimeout> | null = null;
let iframeGraceTimerId: ReturnType<typeof setTimeout> | null = null;
let devPreviewTimerId: ReturnType<typeof setTimeout> | null = null;

const clearAllTimersAndObservers = () => {
  if (adObserver) {
    adObserver.disconnect();
    adObserver = null;
  }
  if (mainTimeoutId) {
    clearTimeout(mainTimeoutId);
    mainTimeoutId = null;
  }
  if (adblockCheckTimerId) {
    clearTimeout(adblockCheckTimerId);
    adblockCheckTimerId = null;
  }
  if (iframeGraceTimerId) {
    clearTimeout(iframeGraceTimerId);
    iframeGraceTimerId = null;
  }
  if (devPreviewTimerId) {
    clearTimeout(devPreviewTimerId);
    devPreviewTimerId = null;
  }
};

const settle = (status: AdSenseReadyStatus, shouldShowDevFallback = false) => {
  if (hasSettled) return;
  hasSettled = true;
  clearAllTimersAndObservers();

  if (status === 'filled') {
    isCollapsed.value = false;
    isAdVisible.value = true;
    showDevFallback.value = false;
  } else if (shouldShowDevFallback) {
    isCollapsed.value = false;
    isAdVisible.value = false;
    showDevFallback.value = true;
    emit('ready', { status: 'dev-preview' });
    return;
  } else {
    isCollapsed.value = true;
    isAdVisible.value = false;
    showDevFallback.value = false;
  }

  emit('ready', { status });
};

const shouldActivateDevFallback = (): boolean => {
  if (!isLocalDevEnvironment.value || !props.devPreview) return false;
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('adtest') === 'empty') {
      return false;
    }
  } catch {
    // Ignore URL parsing issues
  }
  return true;
};

const waitForInjectedIframeThenSettleFilled = (insEl: HTMLElement) => {
  if (hasSettled) return;
  const iframe = insEl.querySelector('iframe');
  if (!iframe) {
    if (!iframeGraceTimerId) {
      iframeGraceTimerId = setTimeout(() => {
        settle('filled');
      }, 250);
    }
    return;
  }

  const onIframeLoaded = () => {
    iframe.removeEventListener('load', onIframeLoaded);
    settle('filled');
  };

  iframe.addEventListener('load', onIframeLoaded, { once: true });

  // Caso o iframe cross-origin já tenha disparado `load` antes do listener
  if (!iframeGraceTimerId) {
    iframeGraceTimerId = setTimeout(() => {
      iframe.removeEventListener('load', onIframeLoaded);
      settle('filled');
    }, 350);
  }
};

const inspectAdElementState = () => {
  if (hasSettled) return;
  const insEl = insElementRef.value;
  if (!insEl) return;

  const adStatus = insEl.getAttribute('data-ad-status');
  if (adStatus === 'filled') {
    waitForInjectedIframeThenSettleFilled(insEl);
    return;
  }

  if (adStatus === 'unfilled') {
    settle('unfilled', shouldActivateDevFallback());
  }
};

onMounted(async () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const host = String(window.location.hostname || '').toLowerCase();
  isLocalDevEnvironment.value = Boolean(
    import.meta.dev || host === 'localhost' || host === '127.0.0.1'
  );

  if (!isValidConfig.value) {
    settle('invalid', false);
    return;
  }

  // Se a rota atual estiver com anúncios suprimidos (ex: /multei/painel), não requisita anúncio
  if (
    document.documentElement.classList.contains('ads-suppressed') ||
    document.body?.classList.contains('ads-suppressed')
  ) {
    settle('blocked', false);
    return;
  }

  isClientMounted.value = true;
  await nextTick();

  const insEl = insElementRef.value;
  if (!insEl) {
    settle('invalid', false);
    return;
  }

  // Observa mudanças em `data-ad-status` e inserção do iframe pelo AdSense
  adObserver = new MutationObserver(() => {
    inspectAdElementState();
  });
  adObserver.observe(insEl, {
    attributes: true,
    attributeFilter: ['data-ad-status', 'data-adsbygoogle-status'],
    childList: true,
    subtree: true
  });

  // Em localhost o Google AdSense não serve anúncios reais (403/unfilled).
  // Simulamos uma latência curta (~600ms) caso o AdSense não preencha para permitir
  // validar visualmente tanto o bloqueio de abertura do modal quanto o layout 320x50.
  if (shouldActivateDevFallback()) {
    devPreviewTimerId = setTimeout(() => {
      const currentStatus = insEl.getAttribute('data-ad-status');
      if (currentStatus !== 'filled') {
        settle('unfilled', true);
      }
    }, 650);
  }

  // Detecção rápida de bloqueador de anúncios (AdBlock / Brave Shields)
  adblockCheckTimerId = setTimeout(() => {
    if (hasSettled) return;
    const isScriptLoaded = Boolean(window.adsbygoogle && window.adsbygoogle.loaded);
    const hasIframe = Boolean(insEl.querySelector('iframe'));
    if (!isScriptLoaded && !hasIframe && document.readyState === 'complete') {
      settle('blocked', shouldActivateDevFallback());
    }
  }, 750);

  // Timeout máximo de segurança para nunca travar a exibição do modal ao usuário
  mainTimeoutId = setTimeout(() => {
    if (hasSettled) return;
    const adStatus = insEl.getAttribute('data-ad-status');
    const iframe = insEl.querySelector('iframe');
    if (adStatus === 'filled' || (iframe && adStatus !== 'unfilled' && iframe.offsetHeight > 0)) {
      settle('filled');
    } else {
      settle('timeout', shouldActivateDevFallback());
    }
  }, safeTimeoutMs.value);

  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
    inspectAdElementState();
  } catch {
    settle('blocked', shouldActivateDevFallback());
  }
});

onBeforeUnmount(() => {
  clearAllTimersAndObservers();
});
</script>

<style scoped>
.manual-adsense-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin: 1.15rem auto 0.35rem;
}

.manual-adsense-label {
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
  margin-bottom: 0.3rem;
  line-height: 1;
  user-select: none;
}

.manual-adsense-slot-box {
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  overflow: hidden;
  border-radius: 8px;
  background: #f8fafc;
}

.manual-adsense-ins {
  margin: 0 auto;
}

.manual-adsense-dev-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 0 0.75rem;
  box-sizing: border-box;
  border-radius: 8px;
  border: 1.5px dashed #94a3b8;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  color: #334155;
  text-align: left;
}

.dev-preview-badge {
  flex-shrink: 0;
  padding: 0.16rem 0.42rem;
  border-radius: 4px;
  background: #0f172a;
  color: #f8fafc;
  font-size: 0.64rem;
  font-weight: 800;
  letter-spacing: 0.05em;
}

.dev-preview-text {
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
  min-width: 0;
}

.dev-preview-text strong {
  font-size: 0.76rem;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dev-preview-text span {
  font-size: 0.66rem;
  color: #475569;
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
