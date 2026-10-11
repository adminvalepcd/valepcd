export type MulteiLiveCategory = 'infracoesTransito' | 'mobilidadeUrbana' | 'resolvidos';

export interface MulteiLiveEvent {
  id: number;
  category: MulteiLiveCategory;
  delta: 1 | -1;
  timestamp: number;
}

type MulteiLiveListener = (evt: MulteiLiveEvent) => void;

const ALLOWED_CATEGORIES: ReadonlySet<string> = new Set<MulteiLiveCategory>([
  'infracoesTransito',
  'mobilidadeUrbana',
  'resolvidos'
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

export function publishMulteiLiveEvent(
  category: MulteiLiveCategory,
  delta: 1 | -1 = 1
): MulteiLiveEvent {
  const state = getBusState();
  state.seq += 1;

  const evt: MulteiLiveEvent = {
    id: state.seq,
    category,
    delta,
    timestamp: Date.now()
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
