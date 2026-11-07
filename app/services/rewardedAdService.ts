/**
 * Serviço reutilizável para Anúncios Premiados na Web (Rewarded Web Ads)
 * via Google Publisher Tag (GPT / Google Ad Manager).
 *
 * - Carrega `gpt.js` sob demanda apenas quando necessário (sem impactar o carregamento inicial).
 * - Em ambiente de desenvolvimento (`localhost` / `dev`), utiliza automaticamente o bloco
 *   oficial de demonstração do Google (`/22639388115/rewarded_web_example`) para permitir
 *   testes reais com cronômetro de 5s sem gerar tráfego inválido.
 * - Impõe teto máximo de espera (padrão 5s) para nunca travar o fluxo caso haja AdBlock
 *   ou ausência de inventário disponível.
 */

const GPT_SCRIPT_SRC = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';
const GOOGLE_SAMPLE_REWARDED_UNIT = '/22639388115/rewarded_web_example';
const DEFAULT_AD_UNIT_CODE = 'multei_report_rewarded';

const AD_UNIT_PATH_PATTERN = /^\/\d{6,24}\/[A-Za-z0-9_.\-/]{1,120}$/;
const NUMERIC_CODE_PATTERN = /^\d{6,24}$/;

interface GptSlot {
  addService: (service: GptPubAdsService) => void;
}

interface GptRewardedSlotReadyEvent {
  slot: GptSlot;
  makeRewardedVisible: () => void;
}

interface GptRewardedSlotGrantedEvent {
  slot: GptSlot;
  payload?: {
    amount?: number;
    type?: string;
  } | null;
}

interface GptRewardedSlotClosedEvent {
  slot: GptSlot;
}

interface GptSlotRenderEndedEvent {
  slot: GptSlot;
  isEmpty?: boolean;
}

interface GptPubAdsService {
  addEventListener: {
    (type: 'rewardedSlotReady', listener: (event: GptRewardedSlotReadyEvent) => void): void;
    (type: 'rewardedSlotGranted', listener: (event: GptRewardedSlotGrantedEvent) => void): void;
    (type: 'rewardedSlotClosed', listener: (event: GptRewardedSlotClosedEvent) => void): void;
    (type: 'slotRenderEnded', listener: (event: GptSlotRenderEndedEvent) => void): void;
  };
}

interface GoogleTagGlobal {
  cmd: Array<() => void>;
  apiReady?: boolean;
  enums?: {
    OutOfPageFormat?: {
      REWARDED?: unknown;
    };
  };
  pubads: () => GptPubAdsService;
  defineOutOfPageSlot: (adUnitPath: string, format: unknown) => GptSlot | null;
  enableServices: () => void;
  display: (slot: GptSlot) => void;
  destroySlots: (slots?: GptSlot[]) => boolean;
}

declare global {
  interface Window {
    googletag?: GoogleTagGlobal;
  }
}

export interface PreparedRewardedAdResult {
  status: 'ready' | 'unavailable';
  show?: () => Promise<{ granted: boolean; failed?: boolean }>;
  dispose: () => void;
}

interface InternalRewardedSession {
  id: number;
  adUnitPath: string;
  slot: GptSlot | null;
  status: 'loading' | 'ready' | 'showing' | 'disposed' | 'unavailable';
  granted: boolean;
  readyEvent: GptRewardedSlotReadyEvent | null;
  readyWaiters: Array<(res: PreparedRewardedAdResult) => void>;
  closeResolver: ((res: { granted: boolean; failed?: boolean }) => void) | null;
}

let gptLoadPromise: Promise<GoogleTagGlobal | null> | null = null;
let listenersBound = false;
let sessionSequence = 0;
let activeSession: InternalRewardedSession | null = null;

const isLocalDevHost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = String(window.location.hostname || '').toLowerCase();
  return Boolean(import.meta.dev || host === 'localhost' || host === '127.0.0.1');
};

const getAdTestQueryMode = (): string => {
  if (typeof window === 'undefined') return '';
  try {
    return String(new URLSearchParams(window.location.search).get('adtest') || '').toLowerCase();
  } catch {
    return '';
  }
};

export const normalizeGamRewardedUnitPath = (rawUnit: string): string => {
  const trimmed = String(rawUnit || '').trim();
  if (!trimmed) return '';
  if (AD_UNIT_PATH_PATTERN.test(trimmed)) {
    return trimmed;
  }
  if (NUMERIC_CODE_PATTERN.test(trimmed)) {
    return `/${trimmed}/${DEFAULT_AD_UNIT_CODE}`;
  }
  return '';
};

const resolveEffectiveAdUnitPath = (configuredUnit: string): string => {
  const queryMode = getAdTestQueryMode();
  if (isLocalDevHost()) {
    if (queryMode === 'empty') return '';
    if (queryMode !== 'prod') return GOOGLE_SAMPLE_REWARDED_UNIT;
  }
  return normalizeGamRewardedUnitPath(configuredUnit);
};

const destroySlotSafely = (slot: GptSlot | null) => {
  if (!slot || typeof window === 'undefined' || !window.googletag?.apiReady) return;
  try {
    window.googletag.cmd.push(() => {
      try {
        window.googletag?.destroySlots([slot]);
      } catch {
        // Ignore slot cleanup errors
      }
    });
  } catch {
    // Ignore
  }
};

const loadGptLibrary = (timeoutMs = 3500): Promise<GoogleTagGlobal | null> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }

  if (
    document.documentElement.classList.contains('ads-suppressed') ||
    document.body?.classList.contains('ads-suppressed')
  ) {
    return Promise.resolve(null);
  }

  window.googletag = window.googletag || ({ cmd: [] } as unknown as GoogleTagGlobal);
  if (window.googletag.apiReady) {
    return Promise.resolve(window.googletag);
  }

  if (gptLoadPromise) {
    return gptLoadPromise;
  }

  gptLoadPromise = new Promise((resolve) => {
    let settled = false;
    const finish = (val: GoogleTagGlobal | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (!val) {
        gptLoadPromise = null;
      }
      resolve(val);
    };

    const timer = setTimeout(() => {
      finish(window.googletag?.apiReady ? window.googletag : null);
    }, timeoutMs);

    const markReadyThroughQueue = () => {
      try {
        window.googletag?.cmd.push(() => {
          finish(window.googletag || null);
        });
      } catch {
        finish(null);
      }
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${GPT_SCRIPT_SRC}"]`
    );
    if (existingScript) {
      existingScript.addEventListener('error', () => finish(null), { once: true });
      markReadyThroughQueue();
      return;
    }

    const script = document.createElement('script');
    script.src = GPT_SCRIPT_SRC;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.addEventListener(
      'load',
      () => {
        markReadyThroughQueue();
      },
      { once: true }
    );
    script.addEventListener(
      'error',
      () => {
        finish(null);
      },
      { once: true }
    );
    document.head.appendChild(script);
    markReadyThroughQueue();
  });

  return gptLoadPromise;
};

const buildReadyResult = (session: InternalRewardedSession): PreparedRewardedAdResult => ({
  status: 'ready',
  show: () => {
    if (
      activeSession?.id !== session.id ||
      session.status !== 'ready' ||
      !session.readyEvent
    ) {
      return Promise.resolve({ granted: false, failed: true });
    }

    session.status = 'showing';
    session.granted = false;

    return new Promise<{ granted: boolean; failed?: boolean }>((resolve) => {
      session.closeResolver = resolve;
      try {
        session.readyEvent?.makeRewardedVisible();
      } catch {
        session.closeResolver = null;
        disposeRewardedAdSession();
        resolve({ granted: false, failed: true });
      }
    });
  },
  dispose: () => {
    if (activeSession?.id === session.id) {
      disposeRewardedAdSession();
    }
  }
});

const buildUnavailableResult = (): PreparedRewardedAdResult => ({
  status: 'unavailable',
  dispose: () => {}
});

const settleSessionPreparation = (
  session: InternalRewardedSession,
  result: PreparedRewardedAdResult
) => {
  const waiters = session.readyWaiters.splice(0, session.readyWaiters.length);
  waiters.forEach((fn) => fn(result));
};

const ensurePubAdsListenersBound = (gt: GoogleTagGlobal) => {
  if (listenersBound) return;
  listenersBound = true;

  const pubads = gt.pubads();

  pubads.addEventListener('rewardedSlotReady', (event) => {
    const session = activeSession;
    if (!session || session.slot !== event.slot || session.status !== 'loading') {
      return;
    }
    session.readyEvent = event;
    session.status = 'ready';
    settleSessionPreparation(session, buildReadyResult(session));
  });

  pubads.addEventListener('rewardedSlotGranted', (event) => {
    const session = activeSession;
    if (!session || session.slot !== event.slot) return;
    session.granted = true;
  });

  pubads.addEventListener('rewardedSlotClosed', (event) => {
    const session = activeSession;
    if (!session || session.slot !== event.slot) return;
    const wasGranted = Boolean(session.granted);
    const resolver = session.closeResolver;
    session.closeResolver = null;
    disposeRewardedAdSession();
    if (resolver) {
      resolver({ granted: wasGranted });
    }
  });

  pubads.addEventListener('slotRenderEnded', (event) => {
    const session = activeSession;
    if (!session || session.slot !== event.slot) return;
    if (event.isEmpty && session.status === 'loading') {
      session.status = 'unavailable';
      const slotToDestroy = session.slot;
      session.slot = null;
      if (activeSession?.id === session.id) {
        activeSession = null;
      }
      destroySlotSafely(slotToDestroy);
      settleSessionPreparation(session, buildUnavailableResult());
    }
  });
};

export const disposeRewardedAdSession = (): void => {
  const prev = activeSession;
  if (!prev) return;
  activeSession = null;
  prev.status = 'disposed';
  prev.readyEvent = null;
  const slotToDestroy = prev.slot;
  prev.slot = null;
  destroySlotSafely(slotToDestroy);
  settleSessionPreparation(prev, buildUnavailableResult());
  if (prev.closeResolver) {
    const resolver = prev.closeResolver;
    prev.closeResolver = null;
    resolver({ granted: Boolean(prev.granted) });
  }
};

/**
 * Inicia o pré-carregamento silencioso de um Anúncio Premiado (sem exibi-lo na tela).
 */
export const preloadRewardedAd = (configuredUnit: string): void => {
  if (typeof window === 'undefined') return;
  const effectiveUnit = resolveEffectiveAdUnitPath(configuredUnit);
  if (!effectiveUnit) return;

  if (
    activeSession &&
    activeSession.adUnitPath === effectiveUnit &&
    (activeSession.status === 'loading' || activeSession.status === 'ready')
  ) {
    return;
  }

  disposeRewardedAdSession();

  const session: InternalRewardedSession = {
    id: ++sessionSequence,
    adUnitPath: effectiveUnit,
    slot: null,
    status: 'loading',
    granted: false,
    readyEvent: null,
    readyWaiters: [],
    closeResolver: null
  };
  activeSession = session;

  void loadGptLibrary(3500).then((gt) => {
    if (!gt || activeSession?.id !== session.id) {
      if (activeSession?.id === session.id) {
        session.status = 'unavailable';
        activeSession = null;
        settleSessionPreparation(session, buildUnavailableResult());
      }
      return;
    }

    gt.cmd.push(() => {
      if (activeSession?.id !== session.id) return;
      try {
        const rewardedFormat = gt.enums?.OutOfPageFormat?.REWARDED;
        if (!rewardedFormat) {
          session.status = 'unavailable';
          activeSession = null;
          settleSessionPreparation(session, buildUnavailableResult());
          return;
        }

        ensurePubAdsListenersBound(gt);
        const slot = gt.defineOutOfPageSlot(effectiveUnit, rewardedFormat);
        if (!slot) {
          session.status = 'unavailable';
          activeSession = null;
          settleSessionPreparation(session, buildUnavailableResult());
          return;
        }

        session.slot = slot;
        slot.addService(gt.pubads());
        gt.enableServices();
        gt.display(slot);
      } catch {
        session.status = 'unavailable';
        activeSession = null;
        settleSessionPreparation(session, buildUnavailableResult());
      }
    });
  });
};

/**
 * Aguarda até `maxWaitMs` (padrão 5000ms = 5s) para que o Anúncio Premiado fique pronto.
 * Se já estiver pré-carregado, retorna imediatamente (0ms).
 * Se não houver anúncio ou atingir os 5s, retorna `{ status: 'unavailable' }`.
 */
export const prepareRewardedAdWithTimeout = (
  configuredUnit: string,
  maxWaitMs = 5000
): Promise<PreparedRewardedAdResult> => {
  if (typeof window === 'undefined') {
    return Promise.resolve(buildUnavailableResult());
  }

  const effectiveUnit = resolveEffectiveAdUnitPath(configuredUnit);
  if (!effectiveUnit) {
    return Promise.resolve(buildUnavailableResult());
  }

  const safeWaitMs = Math.min(5000, Math.max(500, Math.round(Number(maxWaitMs) || 5000)));

  if (
    activeSession &&
    activeSession.adUnitPath === effectiveUnit &&
    activeSession.status === 'ready' &&
    activeSession.readyEvent
  ) {
    return Promise.resolve(buildReadyResult(activeSession));
  }

  if (!activeSession || activeSession.adUnitPath !== effectiveUnit || activeSession.status !== 'loading') {
    preloadRewardedAd(configuredUnit);
  }

  const current = activeSession;
  if (!current) {
    return Promise.resolve(buildUnavailableResult());
  }

  if (current.status === 'ready' && current.readyEvent) {
    return Promise.resolve(buildReadyResult(current));
  }

  return new Promise<PreparedRewardedAdResult>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      if (activeSession?.id === current.id && current.status === 'loading') {
        disposeRewardedAdSession();
      }
      resolve(buildUnavailableResult());
    }, safeWaitMs);

    current.readyWaiters.push((result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    });
  });
};
