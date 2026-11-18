/**
 * Utilitário puro (sem Vue) para a visão de "pontos críticos" da parceria:
 * onde (rua/bairro) e quando (hora/dia da semana) há mais ocorrências — sobretudo de trânsito —
 * para orientar a fiscalização.
 */

export interface CriticalPointIncidentInput {
  id?: string;
  rua?: string;
  bairro?: string;
  natureza?: string;
  timestamp?: number | string | Date;
  latitude?: number;
  longitude?: number;
  resolvido?: boolean;
  status_resolucao?: string;
}

export type CriticalPointGroupBy = 'rua' | 'bairro';
export type CriticalPointNatureza = 'transito' | 'urbana' | '';

export interface CriticalPointsOptions {
  groupBy: CriticalPointGroupBy;
  /** `'transito'` = tudo que não é `urbana`; `'urbana'` = Mobilidade urbana; `''`/ausente = todas. */
  natureza?: CriticalPointNatureza;
  /** Quantidade máxima de pontos retornados (padrão 10; `0` = sem limite). */
  top?: number;
}

export interface CriticalPoint {
  /** Chave normalizada do agrupamento (sem acento, minúsculas). */
  key: string;
  /** Nome mais frequente do logradouro/bairro, para exibição. */
  label: string;
  /** Bairro mais frequente do grupo (quando `groupBy: 'rua'`) ou o próprio bairro. */
  bairro: string;
  count: number;
  /** Ocorrências ainda não corrigidas. */
  abertas: number;
  /** ISO da ocorrência mais recente do grupo ('' se nenhuma data válida). */
  lastAt: string;
  /** Centroide das coordenadas válidas do grupo (NaN se nenhuma). */
  latitude: number;
  longitude: number;
}

export interface TimeDistribution {
  /** Índice 0–23 = hora local. */
  byHour: number[];
  /** Índice 0–6 = domingo a sábado. */
  byWeekday: number[];
}

export const DEFAULT_CRITICAL_POINTS_TOP = 10;
export const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';

function normalizeText(raw: unknown): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Remove número/complemento do logradouro: "Av. Afonso Pena, 1500 - Centro" → "Av. Afonso Pena". */
export function extractStreetName(rua: unknown): string {
  let s = String(rua ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  s = s.split(/\s+-\s+/)[0] || s;
  s = s.replace(/,\s*(n[º°o.]?\s*)?\d.*$/i, '');
  // Sem vírgula, só remove o número final se sobrar um nome com 2+ palavras (preserva "Rua 25")
  const withoutTrailingNumber = s.replace(/\s+(n[º°o.]?\s*)?\d+[a-z]?$/i, '');
  if (withoutTrailingNumber !== s && withoutTrailingNumber.trim().split(/\s+/).length >= 2) {
    s = withoutTrailingNumber;
  }
  return s.replace(/[,\s]+$/, '').trim();
}

export function parseIncidentTime(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return NaN;
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
  const t = new Date(String(raw)).getTime();
  return Number.isFinite(t) ? t : NaN;
}

export function isIncidentOpen(inc: CriticalPointIncidentInput): boolean {
  if (inc.resolvido === true) return false;
  return String(inc.status_resolucao || '').toLowerCase() !== 'resolvido';
}

export function matchesNatureza(inc: CriticalPointIncidentInput, natureza?: CriticalPointNatureza): boolean {
  if (!natureza) return true;
  const isUrbana = String(inc.natureza || '').toLowerCase() === 'urbana';
  return natureza === 'urbana' ? isUrbana : !isUrbana;
}

function mostFrequent(counter: Map<string, number>): string {
  let best = '';
  let bestCount = -1;
  for (const [value, count] of counter) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

interface GroupAccumulator {
  key: string;
  labels: Map<string, number>;
  bairros: Map<string, number>;
  count: number;
  abertas: number;
  lastAtMs: number;
  latSum: number;
  lngSum: number;
  coordCount: number;
}

/**
 * Agrupa as ocorrências por rua ou bairro e devolve os pontos com mais ocorrências
 * (ordenados por quantidade e, em empate, pela mais recente).
 */
export function computeCriticalPoints(
  incidents: ReadonlyArray<CriticalPointIncidentInput>,
  options: CriticalPointsOptions
): CriticalPoint[] {
  const groupBy: CriticalPointGroupBy = options?.groupBy === 'bairro' ? 'bairro' : 'rua';
  const top = options?.top === undefined ? DEFAULT_CRITICAL_POINTS_TOP : Math.max(0, Math.floor(options.top));
  const groups = new Map<string, GroupAccumulator>();

  for (const inc of incidents || []) {
    if (!inc || !matchesNatureza(inc, options?.natureza)) continue;
    const bairroLabel = String(inc.bairro ?? '').replace(/\s+/g, ' ').trim();
    const label = groupBy === 'rua' ? extractStreetName(inc.rua) : bairroLabel;
    const key = normalizeText(label);
    if (!key) continue;

    let acc = groups.get(key);
    if (!acc) {
      acc = {
        key,
        labels: new Map(),
        bairros: new Map(),
        count: 0,
        abertas: 0,
        lastAtMs: NaN,
        latSum: 0,
        lngSum: 0,
        coordCount: 0
      };
      groups.set(key, acc);
    }
    acc.count++;
    if (isIncidentOpen(inc)) acc.abertas++;
    acc.labels.set(label, (acc.labels.get(label) || 0) + 1);
    if (bairroLabel) acc.bairros.set(bairroLabel, (acc.bairros.get(bairroLabel) || 0) + 1);

    const t = parseIncidentTime(inc.timestamp);
    if (Number.isFinite(t) && (!Number.isFinite(acc.lastAtMs) || t > acc.lastAtMs)) acc.lastAtMs = t;

    const lat = Number(inc.latitude);
    const lng = Number(inc.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
      acc.latSum += lat;
      acc.lngSum += lng;
      acc.coordCount++;
    }
  }

  const points: CriticalPoint[] = Array.from(groups.values()).map((acc) => {
    const label = mostFrequent(acc.labels);
    return {
      key: acc.key,
      label,
      bairro: groupBy === 'bairro' ? label : mostFrequent(acc.bairros),
      count: acc.count,
      abertas: acc.abertas,
      lastAt: Number.isFinite(acc.lastAtMs) ? new Date(acc.lastAtMs).toISOString() : '',
      latitude: acc.coordCount > 0 ? acc.latSum / acc.coordCount : NaN,
      longitude: acc.coordCount > 0 ? acc.lngSum / acc.coordCount : NaN
    };
  });

  points.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    const ta = a.lastAt ? Date.parse(a.lastAt) : 0;
    const tb = b.lastAt ? Date.parse(b.lastAt) : 0;
    if (tb !== ta) return tb - ta;
    return a.label.localeCompare(b.label, 'pt-BR');
  });

  return top > 0 ? points.slice(0, top) : points;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};

const formatterCache = new Map<string, Intl.DateTimeFormat | null>();

function getFormatter(timeZone: string): Intl.DateTimeFormat | null {
  if (formatterCache.has(timeZone)) return formatterCache.get(timeZone) || null;
  let fmt: Intl.DateTimeFormat | null = null;
  try {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hourCycle: 'h23',
      weekday: 'short'
    });
  } catch {
    fmt = null;
  }
  formatterCache.set(timeZone, fmt);
  return fmt;
}

/**
 * Distribuição das ocorrências por hora do dia (0–23) e dia da semana (0 = domingo),
 * no fuso informado (padrão: America/Sao_Paulo).
 */
export function computeTimeDistribution(
  incidents: ReadonlyArray<CriticalPointIncidentInput>,
  options?: { natureza?: CriticalPointNatureza; timeZone?: string }
): TimeDistribution {
  const byHour = new Array<number>(24).fill(0);
  const byWeekday = new Array<number>(7).fill(0);
  const fmt = getFormatter(options?.timeZone || DEFAULT_TIME_ZONE);

  for (const inc of incidents || []) {
    if (!inc || !matchesNatureza(inc, options?.natureza)) continue;
    const t = parseIncidentTime(inc.timestamp);
    if (!Number.isFinite(t)) continue;

    let hour = NaN;
    let weekday = NaN;
    if (fmt) {
      for (const part of fmt.formatToParts(new Date(t))) {
        if (part.type === 'hour') hour = Number(part.value) % 24;
        else if (part.type === 'weekday') weekday = WEEKDAY_INDEX[part.value] ?? NaN;
      }
    } else {
      const d = new Date(t);
      hour = d.getHours();
      weekday = d.getDay();
    }
    if (Number.isInteger(hour) && hour >= 0 && hour < 24) byHour[hour]!++;
    if (Number.isInteger(weekday) && weekday >= 0 && weekday < 7) byWeekday[weekday]!++;
  }

  return { byHour, byWeekday };
}
