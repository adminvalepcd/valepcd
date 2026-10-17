export type MulteiLiveCategory =
  | 'infracoesTransito'
  | 'mobilidadeUrbana'
  | 'resolvidos'
  | 'reportadas'
  | 'denunciasPainel';

export interface MulteiLiveEventMeta {
  cidade?: string;
  estado?: string;
  bairro?: string;
  rua?: string;
  natureza?: string;
  ocorrenciaId?: string;
  action?: 'nova_ocorrencia' | 'novo_report' | 'nova_resolucao' | 'revisao';
}

export interface MulteiLiveEvent extends MulteiLiveEventMeta {
  id: number;
  category: MulteiLiveCategory;
  delta: 1 | -1;
  timestamp: number;
}

type MulteiLiveListener = (evt: MulteiLiveEvent) => void;

const ALLOWED_CATEGORIES: ReadonlySet<string> = new Set<MulteiLiveCategory>([
  'infracoesTransito',
  'mobilidadeUrbana',
  'resolvidos',
  'reportadas',
  'denunciasPainel'
]);

const MAX_RECENT_EVENTS = 100;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;

interface GlobalMulteiBusState {
  seq: number;
  events: MulteiLiveEvent[];
  listeners: Set<MulteiLiveListener>;
  rateLimits: Map<string, { count: number; resetAt: number }>;
}

const globalKey = '__multeiLiveBusState__';

function getBusState(): GlobalMulteiBusState {
  const g = globalThis as unknown as Record<string, GlobalMulteiBusState | undefined>;
  if (!g[globalKey]) {
    g[globalKey] = {
      seq: Date.now(),
      events: [],
      listeners: new Set<MulteiLiveListener>(),
      rateLimits: new Map<string, { count: number; resetAt: number }>()
    };
  }
  return g[globalKey]!;
}

export function isValidMulteiLiveCategory(val: unknown): val is MulteiLiveCategory {
  return typeof val === 'string' && ALLOWED_CATEGORIES.has(val);
}

export function isValidMulteiLiveDelta(val: unknown): val is 1 | -1 {
  return val === 1 || val === -1;
}

/**
 * Rate limiter simples em memória por IP para proteger o canal de eventos contra abuso.
 */
export function checkMulteiLiveRateLimit(ip: string): boolean {
  const state = getBusState();
  const now = Date.now();
  const key = ip || 'anonymous';

  if (state.rateLimits.size > 500) {
    for (const [k, v] of state.rateLimits.entries()) {
      if (now > v.resetAt) {
        state.rateLimits.delete(k);
      }
    }
  }

  const entry = state.rateLimits.get(key);
  if (!entry || now > entry.resetAt) {
    state.rateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  entry.count += 1;
  return true;
}

function cleanText(val: unknown, maxLen = 100): string | undefined {
  if (typeof val !== 'string') return undefined;
  const trimmed = val.trim().slice(0, maxLen);
  return trimmed || undefined;
}

export function sanitizeMulteiLiveMeta(raw: Record<string, unknown> | null | undefined): MulteiLiveEventMeta {
  if (!raw || typeof raw !== 'object') return {};
  const rawAction = cleanText(raw.action, 30);
  const action: MulteiLiveEventMeta['action'] =
    rawAction === 'nova_ocorrencia' ||
    rawAction === 'novo_report' ||
    rawAction === 'nova_resolucao' ||
    rawAction === 'revisao'
      ? rawAction
      : undefined;

  return {
    cidade: cleanText(raw.cidade, 80),
    estado: cleanText(raw.estado, 10),
    bairro: cleanText(raw.bairro, 80),
    rua: cleanText(raw.rua, 120),
    natureza: cleanText(raw.natureza, 30),
    ocorrenciaId: cleanText(raw.ocorrenciaId, 60),
    action
  };
}

export function publishMulteiLiveEvent(
  category: MulteiLiveCategory,
  delta: 1 | -1 = 1,
  meta?: MulteiLiveEventMeta
): MulteiLiveEvent {
  const state = getBusState();
  state.seq += 1;

  const evt: MulteiLiveEvent = {
    id: state.seq,
    category,
    delta,
    timestamp: Date.now(),
    ...(meta || {})
  };

  state.events.push(evt);
  if (state.events.length > MAX_RECENT_EVENTS) {
    state.events.splice(0, state.events.length - MAX_RECENT_EVENTS);
  }

  for (const listener of state.listeners) {
    try {
      listener(evt);
    } catch {
      // Ignora falha isolada de cliente desconectando
    }
  }

  return evt;
}

export function getMulteiLiveEventsSince(sinceId: number): {
  latestId: number;
  events: MulteiLiveEvent[];
} {
  const state = getBusState();
  if (!Number.isFinite(sinceId) || sinceId <= 0) {
    return {
      latestId: state.seq,
      events: []
    };
  }

  const events = state.events.filter((evt) => evt.id > sinceId);
  return {
    latestId: state.seq,
    events
  };
}

export function subscribeMulteiLiveEvents(listener: MulteiLiveListener): () => void {
  const state = getBusState();
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
}
