import { geohashForLocation, distanceBetween } from 'geofire-common';
import type { User } from 'firebase/auth';
import type { ReportedIncident } from '../types';
import ocorrenciasSeedRaw from '../mocks/firebase/ocorrencias.bh.json';
import reportadasSeedRaw from '../mocks/firebase/reportadas.bh.json';
import resolvidosSeedRaw from '../mocks/firebase/resolvidos.bh.json';
import usuariosSeedRaw from '../mocks/firebase/usuarios.bh.json';
import estatisticasSeedRaw from '../mocks/firebase/estatisticas.bh.json';
import { buildMockBhSceneDataUrl } from '../mocks/firebase/mockPhotos.bh';
import {
  getAddressDetailsFromCoords,
  extractCityAndStateFromText,
  normalizeState,
  isCoordinateInBrazilBounds,
  isValidBrazilUF,
  checkIfCoordsInBrazil
} from './geoService';
import {
  notifyMulteiLiveDelta,
  normalizeVerificacao,
  PANEL_SESSION_MAX_DURATION_MS,
  type MulteiUserRole,
  type MulteiPanelUserProfile,
  type MulteiPanelManagedUser,
  type CreatePanelUserPayload,
  type UpdatePanelUserPayload,
  type ReportedIncidentPanelItem,
  type ReportHistoryEntry,
  type ReportReviewDecision,
  type MulteiStats,
  type SaveUrbanResolutionPayload,
  type MapVisibleBounds,
  type SaveFirebaseIncidentPayload,
  type ResolveUrbanIncidentByPartnerPayload,
  type ResolvedIncidentPanelItem,
  type ResolutionReviewDecision,
  type MulteiLiveCategory,
  type MulteiLiveEventMeta
} from './firebaseService';

export const MOCK_BH_DEFAULT_CENTER = {
  latitude: Number(estatisticasSeedRaw?.center?.latitude ?? -19.9275),
  longitude: Number(estatisticasSeedRaw?.center?.longitude ?? -43.9385)
} as const;

const MOCK_STORE_STORAGE_KEY = 'multei_dev_mock_bh_store_v1';
const MOCK_SESSION_STORAGE_KEY = 'multei_dev_mock_bh_session_v1';
const FORCE_REAL_FIREBASE_SESSION_KEY = 'multei_force_real_firebase';

interface MockFirebaseStoreState {
  version: number;
  ocorrencias: Record<string, Record<string, any>>;
  reportadas: Record<string, Record<string, any>>;
  resolvidos: Record<string, Record<string, any>>;
  usuarios: Record<string, Record<string, any>>;
  estatisticas: MulteiStats;
}

interface MockPanelSession {
  uid: string;
  loginAt: number;
  expiresAt: number;
  profile: MulteiPanelUserProfile;
}

let inMemoryMockStore: MockFirebaseStoreState | null = null;
let didProcessMockResetQuery = false;
let storageEventsBound = false;

const mockStatsListeners = new Set<(stats: MulteiStats) => void>();
const mockAuthListeners = new Set<(profile: MulteiPanelUserProfile | null) => void>();
const mockRenderedRasterCache = new Map<string, string>();

function isLocalhostHostname(hostname: string): boolean {
  const clean = (hostname || '').trim().toLowerCase();
  return clean === 'localhost' || clean === '127.0.0.1' || clean === '[::1]';
}

/**
 * Determina se o ambiente atual deve utilizar os mocks locais (Belo Horizonte - MG)
 * em vez de realizar chamadas reais ao Firebase (Firestore, Storage e Authentication).
 * - Ativo automaticamente em `npm run dev` (`import.meta.dev`) ou quando acessado via `localhost` / `127.0.0.1`.
 * - Pode ser desativado pontualmente adicionando `?firebase=real` na URL (e reativado com `?firebase=mock`).
 */
export function isFirebaseMockEnabled(): boolean {
  const envFlag = String((import.meta as any).env?.NUXT_PUBLIC_USE_FIREBASE_MOCK ?? '')
    .trim()
    .toLowerCase();
  if (envFlag === 'false' || envFlag === '0') {
    return false;
  }

  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const fbParam = (params.get('firebase') || '').trim().toLowerCase();
      if (fbParam === 'real') {
        sessionStorage.setItem(FORCE_REAL_FIREBASE_SESSION_KEY, '1');
        return false;
      }
      if (fbParam === 'mock') {
        sessionStorage.removeItem(FORCE_REAL_FIREBASE_SESSION_KEY);
      }
      if (sessionStorage.getItem(FORCE_REAL_FIREBASE_SESSION_KEY) === '1') {
        return false;
      }
    } catch {}

    return Boolean(
      envFlag === 'true' ||
        envFlag === '1' ||
        import.meta.dev ||
        isLocalhostHostname(window.location.hostname)
    );
  }

  return Boolean(envFlag === 'true' || envFlag === '1' || import.meta.dev);
}

/**
 * Em modo `npm run dev`, mantém a URL leve `/api/multei/mock-photo?scene=...`.
 * Caso esteja rodando um build de produção em `localhost` (`nuxt preview`), converte
 * automaticamente para `data:image/svg+xml` em memória para nunca falhar por rota dev-only.
 */
export function resolveMockPhotoUrl(rawUrl?: string | null): string {
  const clean = String(rawUrl || '').trim();
  if (!clean) return '';
  if (!clean.startsWith('/api/multei/mock-photo')) {
    return clean;
  }
  if (import.meta.dev) {
    return clean;
  }
  const qIdx = clean.indexOf('?');
  const query = qIdx >= 0 ? clean.slice(qIdx + 1) : '';
  const params = new URLSearchParams(query);
  const scene = (params.get('scene') || '').trim();
  return buildMockBhSceneDataUrl(scene || 'savassi-vaga-1');
}

function normalizeMockPhotoFields<T extends Record<string, any>>(record: T): T {
  const clone: Record<string, any> = { ...record };
  if (typeof clone.fotoUrl === 'string' && clone.fotoUrl) {
    clone.fotoUrl = resolveMockPhotoUrl(clone.fotoUrl);
  }
  if (typeof clone.fotoUrl2 === 'string' && clone.fotoUrl2) {
    clone.fotoUrl2 = resolveMockPhotoUrl(clone.fotoUrl2);
  }
  if (Array.isArray(clone.fotosUrls)) {
    clone.fotosUrls = clone.fotosUrls
      .map((u: unknown) => resolveMockPhotoUrl(String(u || '')))
      .filter(Boolean);
  }
  if (typeof clone.foto_resolucao === 'string' && clone.foto_resolucao) {
    clone.foto_resolucao = resolveMockPhotoUrl(clone.foto_resolucao);
  }
  if (typeof clone.ocorrenciaFotoUrl === 'string' && clone.ocorrenciaFotoUrl) {
    clone.ocorrenciaFotoUrl = resolveMockPhotoUrl(clone.ocorrenciaFotoUrl);
  }
  if (typeof clone.maskedImageUrl === 'string' && clone.maskedImageUrl) {
    clone.maskedImageUrl = resolveMockPhotoUrl(clone.maskedImageUrl);
  }
  return clone as T;
}

function computeStatsFromRecords(
  ocorrenciasMap: Record<string, Record<string, any>>,
  resolvidosMap: Record<string, Record<string, any>>
): MulteiStats {
  let infracoesTransito = 0;
  let mobilidadeUrbana = 0;
  const resolvedIds = new Set<string>();

  for (const [docId, d] of Object.entries(ocorrenciasMap)) {
    if (!d) continue;
    const isAtivo =
      d.ativo !== undefined && d.ativo !== ''
        ? d.ativo === true || String(d.ativo).toLowerCase() === 'true'
        : true;
    if (!isAtivo) continue;

    const isPossivelDup = Boolean(
      d.possivel_duplicidade === true ||
        String(d.possivel_duplicidade).toLowerCase() === 'true'
    );
    if (isPossivelDup) continue;

    if (d.natureza === 'urbana') {
      mobilidadeUrbana++;
    } else {
      infracoesTransito++;
    }

    const statusRes = String(d.status_resolucao || '').toLowerCase();
    const isResolvidoOc = Boolean(
      d.resolvido === true ||
        String(d.resolvido).toLowerCase() === 'true' ||
        statusRes === 'resolvido' ||
        statusRes === 'em_validacao' ||
        d.resolvido_em_validacao === true ||
        String(d.resolvido_em_validacao).toLowerCase() === 'true'
    );
    if (isResolvidoOc && statusRes !== 'improcedente') {
      resolvedIds.add(docId);
    }
  }

  for (const [docId, d] of Object.entries(resolvidosMap)) {
    if (!d) continue;
    const statusRaw = String(d.status || '').toLowerCase();
    const resultadoRaw = String(d.resultado_revisao || '').toLowerCase();
    if (statusRaw === 'improcedente' || resultadoRaw === 'improcedente') {
      continue;
    }
    const key = String(d.ocorrenciaId || docId || '').trim();
    if (key) {
      resolvedIds.add(key);
    }
  }

  return {
    totalGeral: infracoesTransito + mobilidadeUrbana,
    infracoesTransito,
    mobilidadeUrbana,
    resolvidos: resolvedIds.size,
    updatedAt: new Date().toISOString()
  };
}

function buildSeedMockStore(): MockFirebaseStoreState {
  const ocorrencias: Record<string, Record<string, any>> = {};
  for (const rawItem of ocorrenciasSeedRaw as Record<string, any>[]) {
    const id = String(rawItem.id || '').trim();
    if (!id) continue;
    const lat = Number(rawItem.latitude);
    const lng = Number(rawItem.longitude);
    const computedGeohash =
      Number.isFinite(lat) && Number.isFinite(lng)
        ? geohashForLocation([lat, lng])
        : String(rawItem.geohash || '');
    ocorrencias[id] = normalizeMockPhotoFields({
      ...structuredCloneLite(rawItem),
      id,
      latitude: lat,
      longitude: lng,
      geohash: computedGeohash
    });
  }

  const reportadas: Record<string, Record<string, any>> = {};
  for (const rawItem of reportadasSeedRaw as Record<string, any>[]) {
    const id = String(rawItem.id || rawItem.ocorrenciaId || '').trim();
    if (!id) continue;
    const lat = Number(rawItem.latitude);
    const lng = Number(rawItem.longitude);
    const computedGeohash =
      Number.isFinite(lat) && Number.isFinite(lng)
        ? geohashForLocation([lat, lng])
        : String(rawItem.geohash || '');
    reportadas[id] = normalizeMockPhotoFields({
      ...structuredCloneLite(rawItem),
      id,
      ocorrenciaId: String(rawItem.ocorrenciaId || id),
      latitude: lat,
      longitude: lng,
      geohash: computedGeohash
    });
  }

  const resolvidos: Record<string, Record<string, any>> = {};
  for (const rawItem of resolvidosSeedRaw as Record<string, any>[]) {
    const id = String(rawItem.id || rawItem.ocorrenciaId || '').trim();
    if (!id) continue;
    resolvidos[id] = normalizeMockPhotoFields({
      ...structuredCloneLite(rawItem),
      id,
      ocorrenciaId: String(rawItem.ocorrenciaId || id)
    });
  }

  const usuarios: Record<string, Record<string, any>> = {};
  for (const rawUser of usuariosSeedRaw as Record<string, any>[]) {
    const id = String(rawUser.id || rawUser.uid || '').trim();
    if (!id) continue;
    usuarios[id] = {
      ...structuredCloneLite(rawUser),
      id,
      uid: String(rawUser.uid || id)
    };
  }

  const computedStats = computeStatsFromRecords(ocorrencias, resolvidos);
  const seedUpdatedAt = String(estatisticasSeedRaw?.resumo?.updatedAt || computedStats.updatedAt);

  return {
    version: 1,
    ocorrencias,
    reportadas,
    resolvidos,
    usuarios,
    estatisticas: {
      ...computedStats,
      updatedAt: seedUpdatedAt
    }
  };
}

function structuredCloneLite<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

function notifyMockStatsSubscribers(stats: MulteiStats) {
  const snapshot = { ...stats };
  for (const listener of mockStatsListeners) {
    try {
      listener({ ...snapshot });
    } catch {}
  }
}

function notifyMockAuthSubscribers(profile: MulteiPanelUserProfile | null) {
  const snapshot = profile ? { ...profile } : null;
  for (const listener of mockAuthListeners) {
    try {
      listener(snapshot ? { ...snapshot } : null);
    } catch {}
  }
}

function ensureCrossTabMockListeners() {
  if (storageEventsBound || typeof window === 'undefined') return;
  storageEventsBound = true;

  window.addEventListener('storage', (evt: StorageEvent) => {
    if (evt.key === MOCK_STORE_STORAGE_KEY && evt.newValue) {
      try {
        const parsed = JSON.parse(evt.newValue) as MockFirebaseStoreState;
        if (parsed && parsed.ocorrencias && parsed.estatisticas) {
          inMemoryMockStore = parsed;
          notifyMockStatsSubscribers(parsed.estatisticas);
        }
      } catch {}
    } else if (evt.key === MOCK_STORE_STORAGE_KEY && !evt.newValue) {
      inMemoryMockStore = null;
      const fresh = getMockStore();
      notifyMockStatsSubscribers(fresh.estatisticas);
    } else if (evt.key === MOCK_SESSION_STORAGE_KEY) {
      const session = getValidMockSession();
      notifyMockAuthSubscribers(session?.profile || null);
    }
  });
}

function persistMockStore(store: MockFirebaseStoreState) {
  inMemoryMockStore = store;
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MOCK_STORE_STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    console.warn('[firebaseMockService] Limite de localStorage atingido; mantendo estado em memória.', err);
  }
}

function getMockStore(): MockFirebaseStoreState {
  ensureCrossTabMockListeners();

  if (typeof window !== 'undefined' && !didProcessMockResetQuery) {
    didProcessMockResetQuery = true;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mockReset') === '1') {
        localStorage.removeItem(MOCK_STORE_STORAGE_KEY);
        inMemoryMockStore = null;
      }
    } catch {}
  }

  if (inMemoryMockStore) {
    return inMemoryMockStore;
  }

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(MOCK_STORE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<MockFirebaseStoreState>;
        if (
          parsed &&
          parsed.version === 1 &&
          parsed.ocorrencias &&
          parsed.reportadas &&
          parsed.resolvidos &&
          parsed.usuarios &&
          parsed.estatisticas
        ) {
          for (const [k, v] of Object.entries(parsed.ocorrencias)) {
            parsed.ocorrencias[k] = normalizeMockPhotoFields(v);
          }
          for (const [k, v] of Object.entries(parsed.reportadas)) {
            parsed.reportadas[k] = normalizeMockPhotoFields(v);
          }
          for (const [k, v] of Object.entries(parsed.resolvidos)) {
            parsed.resolvidos[k] = normalizeMockPhotoFields(v);
          }
          inMemoryMockStore = parsed as MockFirebaseStoreState;
          return inMemoryMockStore;
        }
      }
    } catch {}
  }

  const seeded = buildSeedMockStore();
  persistMockStore(seeded);
  return seeded;
}

/**
 * Restaura todos os dados mockados de Belo Horizonte (`ocorrencias`, `reportadas`, `resolvidos`, `usuarios`, `estatisticas`)
 * para o estado original dos arquivos `app/mocks/firebase/*.bh.json` e sincroniza Painel + Mapa.
 */
export function resetFirebaseMockStore(): MulteiStats {
  const fresh = buildSeedMockStore();
  mockRenderedRasterCache.clear();
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(MOCK_STORE_STORAGE_KEY);
    } catch {}
  }
  persistMockStore(fresh);
  notifyMockStatsSubscribers(fresh.estatisticas);
  void notifyMulteiLiveDelta('denunciasPainel', 1, {
    cidade: 'Belo Horizonte',
    estado: 'MG',
    action: 'revisao'
  });
  void notifyMulteiLiveDelta('reportadas', 1, {
    cidade: 'Belo Horizonte',
    estado: 'MG',
    action: 'revisao'
  });
  return { ...fresh.estatisticas };
}

function mapMockRecordToIncident(docId: string, rawData: Record<string, any>): ReportedIncident | null {
  if (!rawData) return null;
  const data = normalizeMockPhotoFields(rawData);
  const lat = Number(data.latitude ?? data.lat);
  const lng = Number(data.longitude ?? data.lng ?? data.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const isAtivo =
    data.ativo !== undefined && data.ativo !== ''
      ? data.ativo === true || String(data.ativo).toLowerCase() === 'true'
      : true;
  if (!isAtivo) return null;

  const ruaVal = data.rua ? String(data.rua).trim() : '';
  const bairroVal = data.bairro ? String(data.bairro).trim() : '';
  const cidadeVal = data.cidade ? String(data.cidade).trim() : '';
  const estadoVal = data.estado ? String(data.estado).trim() : '';
  const classificacaoVal = data.classificacao ? String(data.classificacao).trim().toUpperCase() : '';
  const verificacaoVal = normalizeVerificacao(data.verificacao ?? data.verification);
  const descricaoVal = data.descricao ? String(data.descricao).trim() : '';
  const fotoUrl = resolveMockPhotoUrl(data.fotoUrl || data.foto || data.image || '');
  const fotoUrl2 = data.fotoUrl2
    ? resolveMockPhotoUrl(String(data.fotoUrl2).trim())
    : Array.isArray(data.fotosUrls) && data.fotosUrls.length > 1
      ? resolveMockPhotoUrl(String(data.fotosUrls[1] || '').trim())
      : '';
  const fotosUrls =
    Array.isArray(data.fotosUrls) && data.fotosUrls.length > 0
      ? data.fotosUrls.map((u: unknown) => resolveMockPhotoUrl(String(u || '').trim())).filter(Boolean)
      : [fotoUrl, fotoUrl2].filter(Boolean);
  const descParts = [ruaVal, bairroVal, cidadeVal, estadoVal].filter(Boolean);

  const fotoResolucaoVal = resolveMockPhotoUrl(
    String(data.foto_resolucao || data.fotoResolucaoUrl || data.foto_resolvido || '').trim()
  );
  const isResolvido = Boolean(
    data.resolvido === true ||
      String(data.resolvido).toLowerCase() === 'true' ||
      String(data.status_resolucao || '').toLowerCase() === 'resolvido' ||
      (fotoResolucaoVal && String(data.status_resolucao || '').toLowerCase() !== 'em_validacao')
  );

  const isPossivelDuplicidade = Boolean(
    data.possivel_duplicidade === true ||
      String(data.possivel_duplicidade).toLowerCase() === 'true' ||
      String(data.rotulo_duplicidade || '').toLowerCase().includes('duplicidade')
  );
  const duplicidadeDeId = data.duplicidade_de_id ? String(data.duplicidade_de_id).trim() : '';
  const rotuloDuplicidade = isPossivelDuplicidade
    ? String(data.rotulo_duplicidade || 'Possível duplicidade').trim()
    : '';

  return {
    id: String(docId || data.id),
    timestamp: data.data || data.timestamp || new Date().toISOString(),
    latitude: lat,
    longitude: lng,
    geohash: data.geohash ? String(data.geohash) : geohashForLocation([lat, lng]),
    natureza: data.natureza ? String(data.natureza) : 'infracao_veicular',
    descricao: descricaoVal,
    rua: ruaVal,
    bairro: bairroVal,
    cidade: cidadeVal,
    estado: estadoVal,
    classificacao: classificacaoVal,
    verificacao: verificacaoVal,
    fotoUrl,
    fotoUrl2,
    fotosUrls,
    maskedImageUrl: fotoUrl,
    description:
      data.description || (descParts.length > 0 ? descParts.join(' - ') : 'Infração registrada'),
    ativo: true,
    motivo_denuncia: data.motivo_denuncia ? String(data.motivo_denuncia) : '',
    resolvido_em_validacao: isResolvido
      ? false
      : Boolean(
          data.resolvido_em_validacao === true ||
            String(data.resolvido_em_validacao).toLowerCase() === 'true' ||
            data.status_resolucao === 'em_validacao'
        ),
    status_resolucao: isResolvido
      ? 'resolvido'
      : data.status_resolucao
        ? String(data.status_resolucao)
        : data.resolvido_em_validacao
          ? 'em_validacao'
          : '',
    resolvido: isResolvido,
    foto_resolucao: fotoResolucaoVal,
    descricao_resolucao: data.descricao_resolucao ? String(data.descricao_resolucao).trim() : '',
    data_resolucao: data.data_resolucao ? String(data.data_resolucao).trim() : '',
    resolvido_por: data.resolvido_por ? String(data.resolvido_por).trim() : '',
    possivel_duplicidade: isPossivelDuplicidade,
    duplicidade_de_id: duplicidadeDeId,
    rotulo_duplicidade: rotuloDuplicidade
  };
}

export async function mockFetchIncidentsByVisibleArea(options: {
  bounds?: MapVisibleBounds | null;
  center?: { latitude: number; longitude: number } | null;
  radiusKm?: number;
  forceRefresh?: boolean;
}): Promise<ReportedIncident[]> {
  const store = getMockStore();
  const bounds = options.bounds;
  const defaultRadiusMeters = (options.radiusKm ?? 5) * 1000;

  let centerLat: number | null = null;
  let centerLng: number | null = null;
  let radiusMeters = defaultRadiusMeters;

  if (
    options.center &&
    Number.isFinite(options.center.latitude) &&
    Number.isFinite(options.center.longitude)
  ) {
    centerLat = options.center.latitude;
    centerLng = options.center.longitude;
    if (
      bounds &&
      Number.isFinite(bounds.north) &&
      Number.isFinite(bounds.south) &&
      Number.isFinite(bounds.east) &&
      Number.isFinite(bounds.west)
    ) {
      const cornerDistanceKm = distanceBetween([centerLat, centerLng], [bounds.north, bounds.east]);
      radiusMeters = Math.min(
        Math.max(cornerDistanceKm * 1000 + defaultRadiusMeters, defaultRadiusMeters),
        80000
      );
    }
  } else if (
    bounds &&
    Number.isFinite(bounds.north) &&
    Number.isFinite(bounds.south) &&
    Number.isFinite(bounds.east) &&
    Number.isFinite(bounds.west)
  ) {
    centerLat = bounds.center?.latitude ?? (bounds.north + bounds.south) / 2;
    centerLng = bounds.center?.longitude ?? (bounds.east + bounds.west) / 2;
    const cornerDistanceKm = distanceBetween([centerLat, centerLng], [bounds.north, bounds.east]);
    radiusMeters = Math.min(
      Math.max(cornerDistanceKm * 1000 + defaultRadiusMeters, defaultRadiusMeters),
      80000
    );
  }

  const results: ReportedIncident[] = [];
  for (const [docId, rawData] of Object.entries(store.ocorrencias)) {
    const mapped = mapMockRecordToIncident(docId, rawData);
    if (!mapped) continue;

    if (centerLat !== null && centerLng !== null) {
      const distKm = distanceBetween([centerLat, centerLng], [mapped.latitude, mapped.longitude]);
      if (distKm * 1000 > radiusMeters) continue;
    }

    results.push(mapped);
  }

  results.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime() || 0;
    const timeB = new Date(b.timestamp).getTime() || 0;
    return timeB - timeA;
  });

  return results;
}

export async function mockFindRecentNearbyTrafficIncidents(
  latitude: number,
  longitude: number,
  windowMs = 2 * 60 * 1000,
  radiusMeters = 10
): Promise<ReportedIncident[]> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return [];
  }

  const store = getMockStore();
  const now = Date.now();
  const results: ReportedIncident[] = [];

  for (const [docId, rawData] of Object.entries(store.ocorrencias)) {
    const inc = mapMockRecordToIncident(docId, rawData);
    if (!inc) continue;
    const nat = String(inc.natureza || 'infracao_veicular').trim().toLowerCase();
    if (nat === 'urbana') continue;

    const incTime = new Date(inc.timestamp).getTime();
    if (!Number.isFinite(incTime)) continue;
    const ageMs = now - incTime;
    if (ageMs < -60_000 || ageMs > windowMs) continue;

    const distKm = distanceBetween([latitude, longitude], [inc.latitude, inc.longitude]);
    if (distKm * 1000 <= radiusMeters) {
      results.push(inc);
    }
  }

  results.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime() || 0;
    const timeB = new Date(b.timestamp).getTime() || 0;
    return timeA - timeB;
  });

  return results;
}

async function rasterizeSvgDataUrlToWebp(svgDataUrl: string): Promise<string | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 800;
        canvas.height = img.naturalHeight || 600;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/webp', 0.86));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = svgDataUrl;
  });
}

export async function mockFetchIncidentImageAsBase64(
  incident: Partial<ReportedIncident>
): Promise<string | null> {
  if (!incident) return null;
  const id = (incident.id || '').trim();
  const rawUrl = (incident.fotoUrl || incident.maskedImageUrl || '').trim();

  if (rawUrl.startsWith('data:image/') && !rawUrl.startsWith('data:image/svg+xml')) {
    return rawUrl;
  }

  const cacheKey = id || rawUrl;
  if (cacheKey && mockRenderedRasterCache.has(cacheKey)) {
    return mockRenderedRasterCache.get(cacheKey)!;
  }

  if (rawUrl.startsWith('/api/multei/mock-photo')) {
    const qIdx = rawUrl.indexOf('?');
    const params = new URLSearchParams(qIdx >= 0 ? rawUrl.slice(qIdx + 1) : '');
    const scene = (params.get('scene') || 'savassi-vaga-1').trim();
    const svgDataUrl = buildMockBhSceneDataUrl(scene);
    const webp = await rasterizeSvgDataUrlToWebp(svgDataUrl);
    if (webp && cacheKey) {
      mockRenderedRasterCache.set(cacheKey, webp);
    }
    return webp;
  }

  if (rawUrl.startsWith('data:image/svg+xml')) {
    const webp = await rasterizeSvgDataUrlToWebp(rawUrl);
    if (webp && cacheKey) {
      mockRenderedRasterCache.set(cacheKey, webp);
    }
    return webp;
  }

  return null;
}

function generateMockId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

export async function mockSaveIncidentToFirebase(
  incident: SaveFirebaseIncidentPayload
): Promise<{
  success: boolean;
  id: string;
  fotoUrl: string;
  fotoUrl2?: string;
  fotosUrls?: string[];
  geohash: string;
  ativo?: boolean;
  motivo_denuncia?: string;
  possivel_credencial?: boolean;
  descricao?: string;
  rua?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  classificacao?: string;
  verificacao?: string;
  possivel_duplicidade?: boolean;
  duplicidade_de_id?: string;
  rotulo_duplicidade?: string;
}> {
  const latNum = Number(incident.latitude);
  const lngNum = Number(incident.longitude);
  if (!isCoordinateInBrazilBounds(latNum, lngNum)) {
    throw new Error('Ocorrências no Multei só podem ser incluídas no Brasil.');
  }

  let resolvedRua = (incident.rua || '').trim();
  let resolvedBairro = (incident.bairro || '').trim();
  let resolvedCidade = (incident.cidade || '').trim();
  let resolvedEstado = normalizeState((incident.estado || '').trim());
  const resolvedClassificacao = ((incident.classificacao || 'C').trim().toUpperCase()) as
    | 'A'
    | 'B'
    | 'C';
  const resolvedVerificacao = normalizeVerificacao(incident.verificacao);
  const hasStreetNum = (s: string) => /,\s*\d+/.test(s);

  if (
    (!resolvedCidade || !resolvedEstado) &&
    Number.isFinite(incident.latitude) &&
    Number.isFinite(incident.longitude)
  ) {
    try {
      const geoDetails = await getAddressDetailsFromCoords(incident.latitude, incident.longitude);
      if (geoDetails.isBrazil === false) {
        throw new Error('Ocorrências no Multei só podem ser incluídas no Brasil.');
      }
      if (
        (!resolvedRua || (!hasStreetNum(resolvedRua) && hasStreetNum(geoDetails.rua || ''))) &&
        geoDetails.rua
      ) {
        resolvedRua = geoDetails.rua.trim();
      }
      if (!resolvedBairro && geoDetails.bairro) resolvedBairro = geoDetails.bairro.trim();
      if (!resolvedCidade && geoDetails.cidade) resolvedCidade = geoDetails.cidade.trim();
      if (!resolvedEstado && geoDetails.estado) resolvedEstado = normalizeState(geoDetails.estado);
      if (
        (!resolvedCidade || !resolvedEstado || !resolvedRua || !resolvedBairro || !hasStreetNum(resolvedRua)) &&
        geoDetails.formattedAddress
      ) {
        const parsed = extractCityAndStateFromText(geoDetails.formattedAddress);
        if (
          (!resolvedRua || (!hasStreetNum(resolvedRua) && hasStreetNum(parsed.rua || ''))) &&
          parsed.rua
        ) {
          resolvedRua = parsed.rua.trim();
        }
        if (!resolvedBairro && parsed.bairro) resolvedBairro = parsed.bairro.trim();
        if (!resolvedCidade && parsed.cidade) resolvedCidade = parsed.cidade.trim();
        if (!resolvedEstado && parsed.estado) resolvedEstado = normalizeState(parsed.estado);
      }
    } catch (geoErr: any) {
      if (geoErr?.message?.includes('só podem ser incluídas no Brasil')) {
        throw geoErr;
      }
    }
  }

  if (!resolvedCidade) resolvedCidade = 'Belo Horizonte';
  if (!resolvedEstado) resolvedEstado = 'MG';

  const hasValidUf = isValidBrazilUF(resolvedEstado);
  const confirmedBrazil = hasValidUf ? true : await checkIfCoordsInBrazil(latNum, lngNum);
  if (!confirmedBrazil || (resolvedEstado && !hasValidUf)) {
    throw new Error('Ocorrências no Multei só podem ser incluídas no Brasil.');
  }

  const store = getMockStore();
  const id = generateMockId('bh-local');
  const fotoUrl = incident.foto || resolveMockPhotoUrl('/api/multei/mock-photo?scene=savassi-vaga-1');
  const fotoUrl2 = incident.foto2 ? String(incident.foto2) : '';
  const fotosUrls = [fotoUrl, fotoUrl2].filter(Boolean);

  if (fotoUrl.startsWith('data:image/')) {
    mockRenderedRasterCache.set(id, fotoUrl);
  }

  const geohash = geohashForLocation([latNum, lngNum]);
  const dataIso = incident.data || new Date().toISOString();
  const resolvedDescricao = (incident.descricao || '').trim().slice(0, 300);
  const isPossivelCredencial = Boolean(incident.possivel_credencial);
  const isPossivelDuplicidade = Boolean(!isPossivelCredencial && incident.possivel_duplicidade);
  const duplicidadeDeId = isPossivelDuplicidade ? (incident.duplicidade_de_id || '').trim() : '';
  const rotuloDuplicidade = isPossivelDuplicidade
    ? (incident.rotulo_duplicidade || 'Possível duplicidade').trim()
    : '';

  const effectiveAtivo = isPossivelCredencial
    ? false
    : incident.ativo !== undefined
      ? incident.ativo
      : true;
  const effectiveMotivoDenuncia = isPossivelCredencial
    ? (incident.motivo_denuncia || '').trim() || 'possível credencial a vista'
    : incident.motivo_denuncia || '';

  const docData: Record<string, any> = {
    id,
    data: dataIso,
    latitude: latNum,
    longitude: lngNum,
    geohash,
    fotoUrl,
    fotoUrl2: fotoUrl2 || '',
    fotosUrls,
    natureza: incident.natureza || 'infracao_veicular',
    descricao: resolvedDescricao,
    ativo: effectiveAtivo,
    motivo_denuncia: effectiveMotivoDenuncia,
    possivel_credencial: isPossivelCredencial,
    cidade: resolvedCidade,
    estado: resolvedEstado,
    rua: resolvedRua,
    bairro: resolvedBairro,
    classificacao: resolvedClassificacao,
    verificacao: resolvedVerificacao,
    possivel_duplicidade: isPossivelDuplicidade,
    origem_duplicidade: isPossivelDuplicidade,
    duplicidade_de_id: duplicidadeDeId,
    rotulo_duplicidade: rotuloDuplicidade
  };

  store.ocorrencias[id] = docData;

  if (isPossivelCredencial) {
    store.reportadas[id] = {
      id,
      ocorrenciaId: id,
      data: dataIso,
      data_report: dataIso,
      ultima_data_report: dataIso,
      latitude: latNum,
      longitude: lngNum,
      geohash,
      fotoUrl,
      fotoUrl2: fotoUrl2 || '',
      fotosUrls,
      natureza: docData.natureza,
      descricao: resolvedDescricao,
      rua: resolvedRua,
      bairro: resolvedBairro,
      cidade: resolvedCidade,
      estado: resolvedEstado,
      classificacao: resolvedClassificacao,
      verificacao: resolvedVerificacao,
      ativo: false,
      possivel_credencial: true,
      possivel_duplicidade: false,
      origem_duplicidade: false,
      duplicidade_de_id: '',
      rotulo_duplicidade: '',
      motivo_denuncia: effectiveMotivoDenuncia,
      motivo_report: effectiveMotivoDenuncia,
      total_reports: 1,
      outras_revisoes_solicitadas: false,
      historico_reports: [
        {
          motivo: effectiveMotivoDenuncia,
          data: dataIso
        }
      ],
      revisada: false,
      status_revisao: 'pendente',
      resultado_revisao: ''
    };
  }

  if (isPossivelDuplicidade) {
    const autoDuplicateReason = incident.motivo_duplicidade
      ? `Possível duplicidade detectada pelo Gemini: ${incident.motivo_duplicidade}`
      : 'Possível duplicidade detectada pelo sistema (registro nos últimos 2 min num raio de 10m com o mesmo veículo sob outro ângulo).';

    store.reportadas[id] = {
      id,
      ocorrenciaId: id,
      data: dataIso,
      data_report: dataIso,
      ultima_data_report: dataIso,
      latitude: latNum,
      longitude: lngNum,
      geohash,
      fotoUrl,
      fotoUrl2: fotoUrl2 || '',
      fotosUrls,
      natureza: docData.natureza,
      descricao: resolvedDescricao,
      rua: resolvedRua,
      bairro: resolvedBairro,
      cidade: resolvedCidade,
      estado: resolvedEstado,
      classificacao: resolvedClassificacao,
      verificacao: resolvedVerificacao,
      ativo: docData.ativo,
      possivel_duplicidade: true,
      origem_duplicidade: true,
      duplicidade_de_id: duplicidadeDeId,
      rotulo_duplicidade: rotuloDuplicidade,
      motivo_denuncia: autoDuplicateReason,
      motivo_report: autoDuplicateReason,
      total_reports: 1,
      outras_revisoes_solicitadas: false,
      historico_reports: [
        {
          motivo: autoDuplicateReason,
          data: dataIso
        }
      ],
      revisada: false,
      status_revisao: 'pendente',
      resultado_revisao: ''
    };
  }

  store.estatisticas = computeStatsFromRecords(store.ocorrencias, store.resolvidos);
  persistMockStore(store);
  notifyMockStatsSubscribers(store.estatisticas);

  if (isPossivelCredencial) {
    void notifyMulteiLiveDelta('reportadas', 1, {
      cidade: resolvedCidade,
      estado: resolvedEstado,
      bairro: resolvedBairro,
      rua: resolvedRua,
      natureza: docData.natureza,
      ocorrenciaId: id,
      action: 'novo_report'
    });
  } else if (isPossivelDuplicidade) {
    void notifyMulteiLiveDelta('reportadas', 1, {
      cidade: resolvedCidade,
      estado: resolvedEstado,
      bairro: resolvedBairro,
      rua: resolvedRua,
      natureza: docData.natureza,
      ocorrenciaId: id,
      action: 'novo_report'
    });
    void notifyMulteiLiveDelta('denunciasPainel', 1, {
      cidade: resolvedCidade,
      estado: resolvedEstado,
      bairro: resolvedBairro,
      rua: resolvedRua,
      natureza: docData.natureza,
      ocorrenciaId: id,
      action: 'nova_ocorrencia'
    });
  } else if (docData.ativo) {
    const isUrbana = docData.natureza === 'urbana';
    void notifyMulteiLiveDelta(isUrbana ? 'mobilidadeUrbana' : 'infracoesTransito', 1, {
      cidade: resolvedCidade,
      estado: resolvedEstado,
      bairro: resolvedBairro,
      rua: resolvedRua,
      natureza: docData.natureza,
      ocorrenciaId: id,
      action: 'nova_ocorrencia'
    });
  }

  return {
    success: true,
    id,
    fotoUrl,
    fotoUrl2: fotoUrl2 || '',
    fotosUrls,
    geohash,
    ativo: docData.ativo,
    motivo_denuncia: docData.motivo_denuncia,
    possivel_credencial: isPossivelCredencial,
    descricao: resolvedDescricao,
    rua: resolvedRua,
    bairro: resolvedBairro,
    cidade: resolvedCidade,
    estado: resolvedEstado,
    classificacao: resolvedClassificacao,
    verificacao: resolvedVerificacao,
    possivel_duplicidade: isPossivelDuplicidade,
    duplicidade_de_id: duplicidadeDeId,
    rotulo_duplicidade: rotuloDuplicidade
  };
}

export async function mockReportIncidentInFirebase(
  id: string,
  reason: string,
  incidentData?: Partial<ReportedIncident>
): Promise<{ success: boolean; deactivated: boolean; totalReports: number }> {
  const cleanId = (id || '').trim();
  if (!cleanId) {
    throw new Error('ID da ocorrência ausente para denúncia.');
  }

  const cleanReason = (reason || '').trim();
  if (!cleanReason) {
    throw new Error('Motivo da denúncia ausente.');
  }

  const store = getMockStore();
  const existingData: Record<string, any> = store.ocorrencias[cleanId] || {};
  const existingReportData: Record<string, any> = store.reportadas[cleanId] || {};

  const wasActive =
    existingData.ativo !== undefined
      ? existingData.ativo !== false && String(existingData.ativo).toLowerCase() !== 'false'
      : true;
  const wasUrbana = (existingData.natureza || incidentData?.natureza) === 'urbana';
  const wasPossibleDuplicate = Boolean(
    existingData.possivel_duplicidade === true ||
      String(existingData.possivel_duplicidade).toLowerCase() === 'true' ||
      incidentData?.possivel_duplicidade
  );

  const reportedAtIso = new Date().toISOString();
  const alreadyApprovedImprocedente =
    (existingReportData.revisada === true &&
      existingReportData.resultado_revisao === 'improcedente') ||
    (existingData.revisada_admin === true && existingData.resultado_revisao === 'improcedente');

  const previousHistory: ReportHistoryEntry[] = Array.isArray(existingReportData.historico_reports)
    ? [...existingReportData.historico_reports]
    : existingReportData.motivo_report || existingReportData.motivo_denuncia
      ? [
          {
            motivo: String(existingReportData.motivo_report || existingReportData.motivo_denuncia),
            data: String(existingReportData.data_report || existingReportData.data || reportedAtIso)
          }
        ]
      : [];

  previousHistory.push({
    motivo: cleanReason,
    data: reportedAtIso,
    apos_revisao: alreadyApprovedImprocedente
  });

  const previousTotal = Number(existingReportData.total_reports || 0);
  const totalReports = Math.max(previousHistory.length, previousTotal + 1);
  const outrasRevisoesSolicitadas = totalReports > 1;

  const latitude = Number(
    existingData.latitude ?? existingReportData.latitude ?? incidentData?.latitude ?? 0
  );
  const longitude = Number(
    existingData.longitude ?? existingReportData.longitude ?? incidentData?.longitude ?? 0
  );
  const geohash =
    existingData.geohash ||
    existingReportData.geohash ||
    incidentData?.geohash ||
    (latitude && longitude ? geohashForLocation([latitude, longitude]) : '');

  const shouldStayActiveOnMap = alreadyApprovedImprocedente;

  const resolvedFotoUrl = resolveMockPhotoUrl(
    existingData.fotoUrl ||
      existingReportData.fotoUrl ||
      incidentData?.fotoUrl ||
      incidentData?.maskedImageUrl ||
      ''
  );
  const resolvedFotoUrl2 = resolveMockPhotoUrl(
    existingData.fotoUrl2 || existingReportData.fotoUrl2 || incidentData?.fotoUrl2 || ''
  );
  const resolvedFotosUrls = [resolvedFotoUrl, resolvedFotoUrl2].filter(Boolean);

  const reportDocData: Record<string, any> = {
    ...existingData,
    ...existingReportData,
    id: cleanId,
    ocorrenciaId: cleanId,
    data: existingData.data || existingReportData.data || incidentData?.timestamp || reportedAtIso,
    latitude,
    longitude,
    geohash,
    fotoUrl: resolvedFotoUrl,
    fotoUrl2: resolvedFotoUrl2,
    fotosUrls: resolvedFotosUrls,
    natureza:
      existingData.natureza ||
      existingReportData.natureza ||
      incidentData?.natureza ||
      'infracao_veicular',
    descricao:
      existingData.descricao ?? existingReportData.descricao ?? incidentData?.descricao ?? '',
    rua: existingData.rua ?? existingReportData.rua ?? incidentData?.rua ?? '',
    bairro: existingData.bairro ?? existingReportData.bairro ?? incidentData?.bairro ?? '',
    cidade: existingData.cidade ?? existingReportData.cidade ?? incidentData?.cidade ?? '',
    estado: existingData.estado ?? existingReportData.estado ?? incidentData?.estado ?? '',
    classificacao:
      existingData.classificacao ??
      existingReportData.classificacao ??
      incidentData?.classificacao ??
      '',
    verificacao:
      existingData.verificacao ?? existingReportData.verificacao ?? incidentData?.verificacao ?? '',
    possivel_duplicidade: wasPossibleDuplicate,
    origem_duplicidade: wasPossibleDuplicate,
    duplicidade_de_id: wasPossibleDuplicate
      ? (existingData.duplicidade_de_id ??
          existingReportData.duplicidade_de_id ??
          incidentData?.duplicidade_de_id ??
          '')
      : '',
    rotulo_duplicidade: wasPossibleDuplicate
      ? String(
          existingData.rotulo_duplicidade ||
            existingReportData.rotulo_duplicidade ||
            incidentData?.rotulo_duplicidade ||
            'Possível duplicidade'
        )
      : '',
    ativo: shouldStayActiveOnMap,
    motivo_denuncia: cleanReason,
    motivo_report: cleanReason,
    data_report: existingReportData.data_report || reportedAtIso,
    ultima_data_report: reportedAtIso,
    total_reports: totalReports,
    outras_revisoes_solicitadas: outrasRevisoesSolicitadas,
    historico_reports: previousHistory,
    revisada: alreadyApprovedImprocedente ? true : false,
    status_revisao: alreadyApprovedImprocedente ? 'revisada' : 'pendente',
    resultado_revisao: alreadyApprovedImprocedente ? 'improcedente' : ''
  };

  store.reportadas[cleanId] = reportDocData;

  if (!shouldStayActiveOnMap && store.ocorrencias[cleanId]) {
    store.ocorrencias[cleanId] = {
      ...store.ocorrencias[cleanId],
      ativo: false,
      motivo_denuncia: cleanReason
    };
  }

  store.estatisticas = computeStatsFromRecords(store.ocorrencias, store.resolvidos);
  persistMockStore(store);
  notifyMockStatsSubscribers(store.estatisticas);

  if (!shouldStayActiveOnMap && wasActive && !wasPossibleDuplicate) {
    void notifyMulteiLiveDelta(wasUrbana ? 'mobilidadeUrbana' : 'infracoesTransito', -1, {
      cidade: String(reportDocData.cidade || ''),
      estado: String(reportDocData.estado || ''),
      bairro: String(reportDocData.bairro || ''),
      rua: String(reportDocData.rua || ''),
      natureza: String(reportDocData.natureza || ''),
      ocorrenciaId: cleanId,
      action: 'novo_report'
    });
  }

  void notifyMulteiLiveDelta('reportadas', 1, {
    cidade: String(reportDocData.cidade || ''),
    estado: String(reportDocData.estado || ''),
    bairro: String(reportDocData.bairro || ''),
    rua: String(reportDocData.rua || ''),
    natureza: String(reportDocData.natureza || ''),
    ocorrenciaId: cleanId,
    action: 'novo_report'
  });

  return {
    success: true,
    deactivated: !shouldStayActiveOnMap,
    totalReports
  };
}

export async function mockSubmitUrbanResolutionToFirebase(
  payload: SaveUrbanResolutionPayload
): Promise<{
  success: boolean;
  id: string;
  fotoUrl: string;
}> {
  const ocorrenciaId = (payload.ocorrenciaId || '').trim();
  if (!ocorrenciaId) {
    throw new Error('ID da ocorrência ausente para registro de resolução.');
  }

  const descricao = (payload.descricao || '').trim().slice(0, 300);
  if (descricao.length < 10) {
    throw new Error('A breve descrição é obrigatória.');
  }

  if (!payload.foto) {
    throw new Error('A foto do local resolvido é obrigatória.');
  }

  const store = getMockStore();
  const currentData = store.ocorrencias[ocorrenciaId] || {};
  const alreadyPending =
    currentData.resolvido_em_validacao === true ||
    String(currentData.resolvido_em_validacao).toLowerCase() === 'true' ||
    currentData.status_resolucao === 'em_validacao';

  if (alreadyPending) {
    const dupErr = new Error('Esta ocorrência já foi sinalizada como resolvida e está sob validação.');
    (dupErr as any).code = 'ALREADY_IN_VALIDATION';
    throw dupErr;
  }

  const id = generateMockId('bh-res');
  const fotoUrl = payload.foto;
  const dataIso = new Date().toISOString();
  const inc = payload.incident || {};

  store.resolvidos[id] = {
    id,
    ocorrenciaId,
    data: dataIso,
    ocorrenciaData: currentData.data || inc.timestamp || undefined,
    fotoUrl,
    descricao,
    status: 'pendente',
    natureza: 'urbana',
    latitude: Number(currentData.latitude ?? inc.latitude ?? 0),
    longitude: Number(currentData.longitude ?? inc.longitude ?? 0),
    rua: currentData.rua || inc.rua || '',
    bairro: currentData.bairro || inc.bairro || '',
    cidade: currentData.cidade || inc.cidade || 'Belo Horizonte',
    estado: currentData.estado || inc.estado || 'MG',
    ocorrenciaFotoUrl: resolveMockPhotoUrl(
      currentData.fotoUrl || inc.fotoUrl || inc.maskedImageUrl || ''
    ),
    ocorrenciaDescricao: currentData.descricao || inc.descricao || '',
    contabilizado_estatisticas: true,
    revisada: false,
    resultado_revisao: ''
  };

  if (store.ocorrencias[ocorrenciaId]) {
    store.ocorrencias[ocorrenciaId] = {
      ...store.ocorrencias[ocorrenciaId],
      resolvido_em_validacao: true,
      status_resolucao: 'em_validacao',
      resolvidoId: id,
      data_sinalizacao_resolvido: dataIso
    };
  }

  store.estatisticas = computeStatsFromRecords(store.ocorrencias, store.resolvidos);
  persistMockStore(store);
  notifyMockStatsSubscribers(store.estatisticas);

  const targetRecord = store.resolvidos[id];
  await notifyMulteiLiveDelta('resolvidos', 1, {
    cidade: String(targetRecord.cidade || ''),
    estado: String(targetRecord.estado || ''),
    bairro: String(targetRecord.bairro || ''),
    rua: String(targetRecord.rua || ''),
    natureza: 'urbana',
    ocorrenciaId,
    action: 'nova_resolucao'
  });

  return {
    success: true,
    id,
    fotoUrl
  };
}

export async function mockRecalculateAndSyncMulteiStats(
  _forceRefresh = false
): Promise<MulteiStats> {
  const store = getMockStore();
  store.estatisticas = computeStatsFromRecords(store.ocorrencias, store.resolvidos);
  persistMockStore(store);
  notifyMockStatsSubscribers(store.estatisticas);
  return { ...store.estatisticas };
}

export async function mockFetchMulteiStatsOnce(
  onCached?: (stats: MulteiStats) => void,
  options?: { forceRefresh?: boolean }
): Promise<MulteiStats> {
  const store = getMockStore();
  if (options?.forceRefresh) {
    store.estatisticas = computeStatsFromRecords(store.ocorrencias, store.resolvidos);
    persistMockStore(store);
  }
  const snapshot = { ...store.estatisticas };
  if (onCached) {
    onCached({ ...snapshot });
  }
  return snapshot;
}

export function mockSubscribeToMulteiStatsDocument(
  onUpdate: (stats: MulteiStats) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  const store = getMockStore();
  mockStatsListeners.add(onUpdate);
  queueMicrotask(() => {
    if (mockStatsListeners.has(onUpdate)) {
      onUpdate({ ...store.estatisticas });
    }
  });
  return () => {
    mockStatsListeners.delete(onUpdate);
  };
}

function normalizeUserRecordToProfile(
  uidFallback: string,
  rawDoc: Record<string, any>
): MulteiPanelUserProfile {
  const rawRole = String(rawDoc.role || rawDoc.tipo || 'admin').trim().toLowerCase();
  const role: MulteiUserRole =
    rawRole === 'parceria' || rawRole === 'parceiro' ? 'parceria' : 'admin';
  const nome = String(rawDoc.nome || '').trim() || undefined;
  const sobrenome = String(rawDoc.sobrenome || '').trim() || undefined;
  const nomeCompleto = [nome, sobrenome].filter(Boolean).join(' ').trim() || nome || undefined;
  const ativo = !(rawDoc.ativo === false || String(rawDoc.ativo).toLowerCase() === 'false');

  return {
    uid: String(rawDoc.uid || rawDoc.id || uidFallback),
    email: String(rawDoc.email || '').trim().toLowerCase(),
    nome,
    sobrenome,
    nomeCompleto,
    role,
    cidade: rawDoc.cidade ? String(rawDoc.cidade).trim() : 'Belo Horizonte',
    estado: rawDoc.estado ? normalizeState(String(rawDoc.estado).trim()) : 'MG',
    ativo
  };
}

function getValidMockSession(): MockPanelSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(MOCK_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MockPanelSession>;
    if (
      !parsed ||
      typeof parsed.uid !== 'string' ||
      !parsed.uid ||
      typeof parsed.loginAt !== 'number' ||
      typeof parsed.expiresAt !== 'number' ||
      !parsed.profile
    ) {
      return null;
    }
    const now = Date.now();
    if (
      parsed.loginAt <= 0 ||
      parsed.loginAt > now + 60_000 ||
      parsed.expiresAt - parsed.loginAt > PANEL_SESSION_MAX_DURATION_MS ||
      now >= parsed.expiresAt
    ) {
      localStorage.removeItem(MOCK_SESSION_STORAGE_KEY);
      return null;
    }

    const store = getMockStore();
    const userDoc = store.usuarios[parsed.uid];
    if (userDoc) {
      const refreshed = normalizeUserRecordToProfile(parsed.uid, userDoc);
      if (refreshed.ativo === false) {
        localStorage.removeItem(MOCK_SESSION_STORAGE_KEY);
        return null;
      }
      return {
        uid: parsed.uid,
        loginAt: parsed.loginAt,
        expiresAt: parsed.expiresAt,
        profile: refreshed
      };
    }

    return parsed as MockPanelSession;
  } catch {
    return null;
  }
}

function saveMockSession(profile: MulteiPanelUserProfile): MockPanelSession {
  const now = Date.now();
  const session: MockPanelSession = {
    uid: profile.uid,
    loginAt: now,
    expiresAt: now + PANEL_SESSION_MAX_DURATION_MS,
    profile
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(MOCK_SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {}
  }
  return session;
}

export async function mockResolveMulteiPanelUserProfile(
  user: User
): Promise<MulteiPanelUserProfile> {
  const store = getMockStore();
  const uid = String(user?.uid || '').trim();
  const email = String(user?.email || '').trim().toLowerCase();

  if (uid && store.usuarios[uid]) {
    const profile = normalizeUserRecordToProfile(uid, store.usuarios[uid]);
    if (profile.ativo === false) {
      const disabledErr: any = new Error(
        'Sua conta está desativada no painel. Entre em contato com o administrador.'
      );
      disabledErr.code = 'auth/user-disabled';
      throw disabledErr;
    }
    return profile;
  }

  for (const [docId, rawDoc] of Object.entries(store.usuarios)) {
    const docEmail = String(rawDoc.email || '').trim().toLowerCase();
    if (email && docEmail === email) {
      const profile = normalizeUserRecordToProfile(docId, rawDoc);
      if (profile.ativo === false) {
        const disabledErr: any = new Error(
          'Sua conta está desativada no painel. Entre em contato com o administrador.'
        );
        disabledErr.code = 'auth/user-disabled';
        throw disabledErr;
      }
      return profile;
    }
  }

  return {
    uid: uid || 'mock-uid-admin-bh',
    email: email || 'admin@valepcd.com.br',
    nome: 'Admin',
    sobrenome: 'Multei BH',
    nomeCompleto: 'Admin Multei BH',
    role: 'admin',
    cidade: 'Belo Horizonte',
    estado: 'MG',
    ativo: true
  };
}

export function mockGetPanelSessionRemainingMs(_user?: User | null): number {
  const session = getValidMockSession();
  if (!session) return 0;
  const rem = session.expiresAt - Date.now();
  return rem > 0 ? rem : 0;
}

export async function mockRefreshCurrentMulteiPanelProfile(): Promise<MulteiPanelUserProfile | null> {
  const session = getValidMockSession();
  return session?.profile || null;
}

export async function mockSignInMulteiPanel(
  email: string,
  password: string
): Promise<MulteiPanelUserProfile> {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !password) {
    throw new Error('Preencha o e-mail e a senha.');
  }

  const store = getMockStore();
  let matchedProfile: MulteiPanelUserProfile | null = null;

  for (const [docId, rawDoc] of Object.entries(store.usuarios)) {
    const docEmail = String(rawDoc.email || '').trim().toLowerCase();
    if (docEmail === cleanEmail) {
      matchedProfile = normalizeUserRecordToProfile(docId, rawDoc);
      break;
    }
  }

  if (matchedProfile && matchedProfile.ativo === false) {
    const disabledErr: any = new Error(
      'Sua conta está desativada no painel. Entre em contato com o administrador.'
    );
    disabledErr.code = 'auth/user-disabled';
    throw disabledErr;
  }

  if (!matchedProfile) {
    const inferredParceria =
      cleanEmail.includes('parceria') ||
      cleanEmail.includes('pbh') ||
      cleanEmail.includes('bhtrans');
    const localName = cleanEmail.split('@')[0] || 'Dev';
    const capitalized = localName.charAt(0).toUpperCase() + localName.slice(1);
    matchedProfile = {
      uid: `mock-dev-${localName.replace(/[^a-z0-9]/gi, '') || 'user'}`,
      email: cleanEmail,
      nome: capitalized,
      sobrenome: 'Mock BH',
      nomeCompleto: `${capitalized} Mock BH`,
      role: inferredParceria ? 'parceria' : 'admin',
      cidade: 'Belo Horizonte',
      estado: 'MG',
      ativo: true
    };
  }

  saveMockSession(matchedProfile);
  notifyMockAuthSubscribers(matchedProfile);
  return matchedProfile;
}

export async function mockSignOutMulteiPanel(): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(MOCK_SESSION_STORAGE_KEY);
    } catch {}
  }
  notifyMockAuthSubscribers(null);
}

export function mockSubscribeToMulteiPanelAuth(
  onChange: (profile: MulteiPanelUserProfile | null) => void,
  onSessionExpired?: () => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  ensureCrossTabMockListeners();
  mockAuthListeners.add(onChange);

  let expiryTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleExpiry = (session: MockPanelSession | null) => {
    if (expiryTimer) {
      clearTimeout(expiryTimer);
      expiryTimer = null;
    }
    if (!session) return;
    const rem = session.expiresAt - Date.now();
    if (rem > 0) {
      expiryTimer = setTimeout(() => {
        void mockSignOutMulteiPanel();
        onSessionExpired?.();
      }, rem);
    }
  };

  const initialSession = getValidMockSession();
  scheduleExpiry(initialSession);
  queueMicrotask(() => {
    if (mockAuthListeners.has(onChange)) {
      onChange(initialSession?.profile ? { ...initialSession.profile } : null);
    }
  });

  return () => {
    if (expiryTimer) {
      clearTimeout(expiryTimer);
      expiryTimer = null;
    }
    mockAuthListeners.delete(onChange);
  };
}

export async function mockFetchPanelUsersFromFirebase(): Promise<MulteiPanelManagedUser[]> {
  const store = getMockStore();
  const users: MulteiPanelManagedUser[] = Object.entries(store.usuarios).map(([docId, d]) => {
    const rawRole = String(d.role || 'admin').trim().toLowerCase();
    const role: 'admin' | 'parceria' =
      rawRole === 'parceria' || rawRole === 'parceiro' ? 'parceria' : 'admin';
    const nome = String(d.nome || '').trim();
    const sobrenome = String(d.sobrenome || '').trim();
    const email = String(d.email || '').trim().toLowerCase();
    const nomeCompleto =
      [nome, sobrenome].filter(Boolean).join(' ').trim() || nome || email || docId;
    const cidade = String(d.cidade || 'Belo Horizonte').trim();
    const rawEstado = String(d.estado || 'MG').trim();
    const estado = (normalizeState(rawEstado) || rawEstado).toUpperCase();
    const ativo = !(d.ativo === false || String(d.ativo).trim().toLowerCase() === 'false');

    return {
      id: docId,
      uid: String(d.uid || docId).trim(),
      role,
      nome,
      sobrenome,
      nomeCompleto,
      email,
      cidade,
      estado,
      ativo,
      createdAt: d.createdAt ? String(d.createdAt) : undefined,
      updatedAt: d.updatedAt ? String(d.updatedAt) : undefined
    };
  });

  users.sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto, 'pt-BR'));
  return users;
}

export async function mockCreatePanelUserInFirebase(
  payload: CreatePanelUserPayload
): Promise<MulteiPanelManagedUser> {
  const cleanRole: 'admin' | 'parceria' = payload.role === 'parceria' ? 'parceria' : 'admin';
  const cleanNome = (payload.nome || '').trim();
  const cleanSobrenome = (payload.sobrenome || '').trim();
  const cleanEmail = (payload.email || '').trim().toLowerCase();
  const rawPassword = payload.senha || '';
  const cleanCidade = (payload.cidade || '').trim();
  const rawEstado = (payload.estado || '').trim();
  const cleanEstado = (normalizeState(rawEstado) || rawEstado).toUpperCase();
  const isAtivo = payload.ativo !== false;

  if (!cleanNome) throw new Error('Informe o nome do usuário.');
  if (!cleanSobrenome) throw new Error('Informe o sobrenome do usuário.');
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Informe um endereço de e-mail válido.');
  }
  if (!rawPassword || rawPassword.length < 6) {
    throw new Error('A senha deve ter pelo menos 6 caracteres.');
  }
  if (!cleanCidade) throw new Error('Informe a cidade do usuário.');
  if (!cleanEstado || cleanEstado.length !== 2) {
    throw new Error('Informe a UF (estado com 2 letras, ex: SP).');
  }

  const store = getMockStore();
  for (const existing of Object.values(store.usuarios)) {
    if (String(existing.email || '').trim().toLowerCase() === cleanEmail) {
      const dupErr: any = new Error('Este e-mail já está em uso por outro usuário.');
      dupErr.code = 'auth/email-already-in-use';
      throw dupErr;
    }
  }

  const createdUid = generateMockId('mock-uid');
  const displayName = `${cleanNome} ${cleanSobrenome}`.trim();
  const nowIso = new Date().toISOString();

  // IMPORTANTE: A senha NUNCA é armazenada no mock store nem no localStorage.
  store.usuarios[createdUid] = {
    id: createdUid,
    uid: createdUid,
    role: cleanRole,
    nome: cleanNome,
    sobrenome: cleanSobrenome,
    email: cleanEmail,
    cidade: cleanCidade,
    estado: cleanEstado,
    ativo: isAtivo,
    createdAt: nowIso,
    updatedAt: nowIso
  };
  persistMockStore(store);

  return {
    id: createdUid,
    uid: createdUid,
    role: cleanRole,
    nome: cleanNome,
    sobrenome: cleanSobrenome,
    nomeCompleto: displayName,
    email: cleanEmail,
    cidade: cleanCidade,
    estado: cleanEstado,
    ativo: isAtivo,
    createdAt: nowIso,
    updatedAt: nowIso
  };
}

export async function mockUpdatePanelUserInFirebase(
  docId: string,
  payload: UpdatePanelUserPayload
): Promise<void> {
  if (!docId) throw new Error('ID do usuário inválido.');

  const cleanRole: 'admin' | 'parceria' = payload.role === 'parceria' ? 'parceria' : 'admin';
  const cleanNome = (payload.nome || '').trim();
  const cleanSobrenome = (payload.sobrenome || '').trim();
  const cleanEmail = (payload.email || '').trim().toLowerCase();
  const cleanCidade = (payload.cidade || '').trim();
  const rawEstado = (payload.estado || '').trim();
  const cleanEstado = (normalizeState(rawEstado) || rawEstado).toUpperCase();

  if (!cleanNome) throw new Error('Informe o nome do usuário.');
  if (!cleanSobrenome) throw new Error('Informe o sobrenome do usuário.');
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Informe um endereço de e-mail válido.');
  }
  if (!cleanCidade) throw new Error('Informe a cidade do usuário.');
  if (!cleanEstado || cleanEstado.length !== 2) {
    throw new Error('Informe a UF (estado com 2 letras, ex: SP).');
  }

  const store = getMockStore();
  const existing = store.usuarios[docId] || { id: docId, uid: docId };
  store.usuarios[docId] = {
    ...existing,
    role: cleanRole,
    nome: cleanNome,
    sobrenome: cleanSobrenome,
    email: cleanEmail,
    cidade: cleanCidade,
    estado: cleanEstado,
    ativo: Boolean(payload.ativo),
    updatedAt: new Date().toISOString()
  };
  persistMockStore(store);
}

export async function mockTogglePanelUserActiveInFirebase(
  docId: string,
  ativo: boolean
): Promise<void> {
  if (!docId) throw new Error('ID do usuário inválido.');
  const store = getMockStore();
  if (!store.usuarios[docId]) return;
  store.usuarios[docId] = {
    ...store.usuarios[docId],
    ativo: Boolean(ativo),
    updatedAt: new Date().toISOString()
  };
  persistMockStore(store);
}

export async function mockDeletePanelUserFromFirebase(docId: string): Promise<void> {
  if (!docId) throw new Error('ID do usuário inválido.');
  const store = getMockStore();
  delete store.usuarios[docId];
  persistMockStore(store);
}

export async function mockSendPanelUserPasswordReset(email: string): Promise<void> {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error('E-mail inválido para redefinição de senha.');
  }
}

function parseResultadoRevisao(raw: unknown): ReportReviewDecision | '' {
  if (
    raw === 'procedente' ||
    raw === 'improcedente' ||
    raw === 'nao_duplicidade' ||
    raw === 'indefinido' ||
    raw === 'duplicidade'
  ) {
    return raw;
  }
  return '';
}

export async function mockFetchReportedIncidentsForPanel(): Promise<ReportedIncidentPanelItem[]> {
  const store = getMockStore();
  const groupedByOcorrencia = new Map<string, ReportedIncidentPanelItem>();

  for (const [docId, rawDoc] of Object.entries(store.reportadas)) {
    const d = normalizeMockPhotoFields(rawDoc);
    const ocorrenciaId = String(d.ocorrenciaId || docId).trim();
    if (!ocorrenciaId) continue;

    const rawHistory: ReportHistoryEntry[] = Array.isArray(d.historico_reports)
      ? d.historico_reports.map((h: any) => ({
          motivo: String(h?.motivo || ''),
          data: String(h?.data || d.data_report || d.data || ''),
          apos_revisao: Boolean(h?.apos_revisao)
        }))
      : [
          {
            motivo: String(d.motivo_report || d.motivo_denuncia || 'Sem motivo informado'),
            data: String(d.data_report || d.data || new Date().toISOString())
          }
        ];

    const dataReport = String(d.data_report || d.data || new Date().toISOString());
    const ultimaDataReport = String(d.ultima_data_report || dataReport);
    let isRevisada =
      d.revisada === true ||
      String(d.revisada).toLowerCase() === 'true' ||
      d.status_revisao === 'revisada';

    let resultadoRevisao = parseResultadoRevisao(d.resultado_revisao);
    const dataRevisaoMs = d.data_revisao ? new Date(String(d.data_revisao)).getTime() : 0;
    const ultimaDataReportMs = new Date(ultimaDataReport).getTime() || 0;
    if (
      isRevisada &&
      resultadoRevisao === 'nao_duplicidade' &&
      rawHistory.length > 1 &&
      (!dataRevisaoMs || ultimaDataReportMs > dataRevisaoMs + 500)
    ) {
      isRevisada = false;
      resultadoRevisao = '';
    }

    const isPossivelDuplicidade = Boolean(
      resultadoRevisao !== 'nao_duplicidade' &&
        resultadoRevisao !== 'duplicidade' &&
        resultadoRevisao !== 'procedente' &&
        resultadoRevisao !== 'improcedente' &&
        (d.possivel_duplicidade === true ||
          String(d.possivel_duplicidade).toLowerCase() === 'true' ||
          String(d.rotulo_duplicidade || '').toLowerCase().includes('duplicidade'))
    );
    const duplicidadeDeId =
      resultadoRevisao === 'nao_duplicidade' || resultadoRevisao === 'improcedente'
        ? ''
        : d.duplicidade_de_id
          ? String(d.duplicidade_de_id).trim()
          : '';
    const isOrigemDuplicidade = Boolean(
      isPossivelDuplicidade || resultadoRevisao === 'indefinido'
    );
    const rotuloDuplicidade = isPossivelDuplicidade
      ? String(d.rotulo_duplicidade || 'Possível duplicidade').trim()
      : '';

    const docFotoUrl = resolveMockPhotoUrl(String(d.fotoUrl || d.foto || d.image || ''));
    const docFotoUrl2 = d.fotoUrl2
      ? resolveMockPhotoUrl(String(d.fotoUrl2).trim())
      : Array.isArray(d.fotosUrls) && d.fotosUrls.length > 1
        ? resolveMockPhotoUrl(String(d.fotosUrls[1] || '').trim())
        : '';
    const docFotosUrls = [docFotoUrl, docFotoUrl2].filter(Boolean);
    const totalReports = Math.max(Number(d.total_reports || 1), rawHistory.length);

    groupedByOcorrencia.set(ocorrenciaId, {
      id: docId,
      ocorrenciaId,
      data: String(d.data || dataReport),
      data_report: dataReport,
      ultima_data_report: ultimaDataReport,
      latitude: Number(d.latitude ?? d.lat ?? 0),
      longitude: Number(d.longitude ?? d.lng ?? d.lon ?? 0),
      geohash: String(d.geohash || ''),
      fotoUrl: docFotoUrl,
      fotoUrl2: docFotoUrl2,
      fotosUrls: docFotosUrls,
      natureza: String(d.natureza || 'infracao_veicular'),
      descricao: String(d.descricao || ''),
      rua: String(d.rua || ''),
      bairro: String(d.bairro || ''),
      cidade: String(d.cidade || ''),
      estado: String(d.estado || ''),
      classificacao: String(d.classificacao || ''),
      verificacao: normalizeVerificacao(d.verificacao ?? d.verification),
      ativo: Boolean(d.ativo === true || String(d.ativo).toLowerCase() === 'true'),
      motivo_denuncia: String(d.motivo_denuncia || d.motivo_report || ''),
      motivo_report: String(d.motivo_report || d.motivo_denuncia || ''),
      total_reports: totalReports,
      outras_revisoes_solicitadas: Boolean(d.outras_revisoes_solicitadas || totalReports > 1),
      historico_reports: rawHistory,
      revisada: isRevisada,
      resultado_revisao: resultadoRevisao,
      data_revisao: d.data_revisao ? String(d.data_revisao) : undefined,
      revisado_por: d.revisado_por ? String(d.revisado_por) : undefined,
      observacao_admin: d.observacao_admin ? String(d.observacao_admin) : undefined,
      legacyDocIds: [docId],
      possivel_duplicidade: isPossivelDuplicidade,
      origem_duplicidade: isOrigemDuplicidade,
      duplicidade_de_id: duplicidadeDeId,
      rotulo_duplicidade: rotuloDuplicidade
    });
  }

  // Sincroniza eventuais ocorrências com possivel_duplicidade ou possivel_credencial ainda fora de reportadas
  for (const [ocorrenciaId, rawOc] of Object.entries(store.ocorrencias)) {
    if (groupedByOcorrencia.has(ocorrenciaId)) continue;
    const d = normalizeMockPhotoFields(rawOc);
    const isDup = Boolean(d.possivel_duplicidade === true);
    const isCred = Boolean(d.possivel_credencial === true);
    if (!isDup && !isCred) continue;

    const dataIso = String(d.data || new Date().toISOString());
    const defaultReason = isCred
      ? 'possível credencial a vista'
      : 'Possível duplicidade detectada pelo sistema (registro nos últimos 2 min num raio de 10m com o mesmo veículo sob outro ângulo).';
    const foto1 = resolveMockPhotoUrl(String(d.fotoUrl || d.foto || ''));
    const foto2 = d.fotoUrl2 ? resolveMockPhotoUrl(String(d.fotoUrl2).trim()) : '';

    groupedByOcorrencia.set(ocorrenciaId, {
      id: ocorrenciaId,
      ocorrenciaId,
      data: dataIso,
      data_report: dataIso,
      ultima_data_report: dataIso,
      latitude: Number(d.latitude ?? 0),
      longitude: Number(d.longitude ?? 0),
      geohash: String(d.geohash || ''),
      fotoUrl: foto1,
      fotoUrl2: foto2,
      fotosUrls: [foto1, foto2].filter(Boolean),
      natureza: String(d.natureza || 'infracao_veicular'),
      descricao: String(d.descricao || ''),
      rua: String(d.rua || ''),
      bairro: String(d.bairro || ''),
      cidade: String(d.cidade || ''),
      estado: String(d.estado || ''),
      classificacao: String(d.classificacao || ''),
      verificacao: normalizeVerificacao(d.verificacao),
      ativo: Boolean(d.ativo === true),
      motivo_denuncia: String(d.motivo_denuncia || defaultReason),
      motivo_report: String(d.motivo_denuncia || defaultReason),
      total_reports: 1,
      outras_revisoes_solicitadas: false,
      historico_reports: [{ motivo: String(d.motivo_denuncia || defaultReason), data: dataIso }],
      revisada: Boolean(d.revisada_admin === true),
      resultado_revisao: parseResultadoRevisao(d.resultado_revisao),
      data_revisao: d.data_revisao ? String(d.data_revisao) : undefined,
      legacyDocIds: [ocorrenciaId],
      possivel_duplicidade: isDup,
      origem_duplicidade: isDup,
      duplicidade_de_id: isDup && d.duplicidade_de_id ? String(d.duplicidade_de_id) : '',
      rotulo_duplicidade: isDup ? String(d.rotulo_duplicidade || 'Possível duplicidade') : ''
    });
  }

  const list = Array.from(groupedByOcorrencia.values());

  // Hidrata fotos da ocorrência original (`duplicidade_de_id`) e campos complementares
  for (const item of list) {
    const selfData = store.ocorrencias[item.ocorrenciaId];
    if (selfData) {
      if (!item.descricao && selfData.descricao) {
        item.descricao = String(selfData.descricao).trim();
      }
      if (!item.fotoUrl && selfData.fotoUrl) {
        item.fotoUrl = resolveMockPhotoUrl(String(selfData.fotoUrl));
      }
      if (!item.fotoUrl2 && selfData.fotoUrl2) {
        item.fotoUrl2 = resolveMockPhotoUrl(String(selfData.fotoUrl2));
      }
      item.fotosUrls = [item.fotoUrl, item.fotoUrl2 || ''].filter(Boolean);
    }

    if (item.duplicidade_de_id && !item.duplicidade_original_fotoUrl) {
      const origData = store.ocorrencias[item.duplicidade_de_id];
      if (origData) {
        if (origData.fotoUrl) {
          item.duplicidade_original_fotoUrl = resolveMockPhotoUrl(String(origData.fotoUrl));
        }
        if (origData.fotoUrl2) {
          item.duplicidade_original_fotoUrl2 = resolveMockPhotoUrl(String(origData.fotoUrl2));
        }
      }
    }
  }

  list.sort((a, b) => {
    const timeA = new Date(a.ultima_data_report || a.data_report).getTime() || 0;
    const timeB = new Date(b.ultima_data_report || b.data_report).getTime() || 0;
    return timeB - timeA;
  });

  return list;
}

export async function mockReviewReportedIncidentInFirebase(params: {
  item: ReportedIncidentPanelItem;
  decision: ReportReviewDecision;
  observacaoAdmin?: string;
  reviewerEmail?: string;
}): Promise<ReportedIncidentPanelItem> {
  const { item, decision, observacaoAdmin = '', reviewerEmail = '' } = params;
  const ocorrenciaId = (item.ocorrenciaId || item.id || '').trim();
  if (!ocorrenciaId) {
    throw new Error('ID da ocorrência inválido para revisão.');
  }

  const store = getMockStore();
  const existingOc = store.ocorrencias[ocorrenciaId] || {};
  const wasActiveInOcorrencias =
    existingOc.ativo !== undefined
      ? existingOc.ativo === true || String(existingOc.ativo).toLowerCase() === 'true'
      : Boolean(item.ativo);
  const isUrbana = (existingOc.natureza || item.natureza) === 'urbana';
  const wasPossivelDuplicidade = Boolean(
    existingOc.possivel_duplicidade === true ||
      String(existingOc.possivel_duplicidade).toLowerCase() === 'true' ||
      item.possivel_duplicidade
  );
  const wasCountedInStats = wasActiveInOcorrencias && !wasPossivelDuplicidade;

  let targetAtivo = true;
  let targetPossivelDuplicidade = false;
  let targetRotuloDuplicidade = '';

  if (decision === 'nao_duplicidade') {
    targetAtivo = true;
    targetPossivelDuplicidade = false;
    targetRotuloDuplicidade = '';
  } else if (decision === 'indefinido') {
    targetAtivo = true;
    targetPossivelDuplicidade = true;
    targetRotuloDuplicidade = 'Possível duplicidade';
  } else if (decision === 'duplicidade') {
    targetAtivo = false;
    targetPossivelDuplicidade = false;
    targetRotuloDuplicidade = '';
  } else if (decision === 'improcedente') {
    targetAtivo = true;
    targetPossivelDuplicidade = false;
    targetRotuloDuplicidade = '';
  } else if (decision === 'procedente') {
    targetAtivo = false;
    targetPossivelDuplicidade = false;
    targetRotuloDuplicidade = '';
  }

  const clearDuplicityLink = decision === 'nao_duplicidade' || decision === 'improcedente';
  const targetOrigemDuplicidade = decision === 'indefinido';
  const shouldBeCountedInStats = targetAtivo && !targetPossivelDuplicidade;
  const nowIso = new Date().toISOString();

  store.ocorrencias[ocorrenciaId] = {
    ...existingOc,
    id: ocorrenciaId,
    ativo: targetAtivo,
    possivel_duplicidade: targetPossivelDuplicidade,
    rotulo_duplicidade: targetRotuloDuplicidade,
    origem_duplicidade: targetOrigemDuplicidade,
    ...(clearDuplicityLink ? { duplicidade_de_id: '' } : {}),
    revisada_admin: true,
    resultado_revisao: decision,
    data_revisao: nowIso,
    ...(targetAtivo ? { motivo_denuncia: '' } : {})
  };

  const targetReportDocId = (item.id || ocorrenciaId).trim();
  store.reportadas[targetReportDocId] = {
    ...(store.reportadas[targetReportDocId] || {}),
    id: targetReportDocId,
    ocorrenciaId,
    ativo: targetAtivo,
    possivel_duplicidade: targetPossivelDuplicidade,
    rotulo_duplicidade: targetRotuloDuplicidade,
    origem_duplicidade: targetOrigemDuplicidade,
    ...(clearDuplicityLink ? { duplicidade_de_id: '' } : {}),
    revisada: true,
    status_revisao: 'revisada',
    resultado_revisao: decision,
    data_revisao: nowIso,
    revisado_por: reviewerEmail,
    observacao_admin: observacaoAdmin.trim(),
    total_reports: item.total_reports,
    outras_revisoes_solicitadas: item.total_reports > 1,
    historico_reports: item.historico_reports
  };

  store.estatisticas = computeStatsFromRecords(store.ocorrencias, store.resolvidos);
  persistMockStore(store);
  notifyMockStatsSubscribers(store.estatisticas);

  const category: MulteiLiveCategory = isUrbana ? 'mobilidadeUrbana' : 'infracoesTransito';
  const reviewMeta: MulteiLiveEventMeta = {
    cidade: String(item.cidade || ''),
    estado: String(item.estado || ''),
    bairro: String(item.bairro || ''),
    rua: String(item.rua || ''),
    natureza: String(item.natureza || ''),
    ocorrenciaId,
    action: 'revisao'
  };

  if (!wasCountedInStats && shouldBeCountedInStats) {
    void notifyMulteiLiveDelta(category, 1, reviewMeta);
  } else if (wasCountedInStats && !shouldBeCountedInStats) {
    void notifyMulteiLiveDelta(category, -1, reviewMeta);
  }

  void notifyMulteiLiveDelta('reportadas', 1, reviewMeta);
  void notifyMulteiLiveDelta('denunciasPainel', 1, reviewMeta);

  return {
    ...item,
    ativo: targetAtivo,
    possivel_duplicidade: targetPossivelDuplicidade,
    rotulo_duplicidade: targetRotuloDuplicidade,
    origem_duplicidade: targetOrigemDuplicidade,
    duplicidade_de_id: clearDuplicityLink ? '' : item.duplicidade_de_id,
    duplicidade_original_fotoUrl: clearDuplicityLink
      ? undefined
      : item.duplicidade_original_fotoUrl,
    revisada: true,
    resultado_revisao: decision,
    data_revisao: nowIso,
    revisado_por: reviewerEmail,
    observacao_admin: observacaoAdmin.trim()
  };
}

function normalizeCityKey(raw?: string): string {
  if (!raw) return '';
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export async function mockFetchPartnerIncidentsFromFirebase(
  options: {
    cidade?: string;
    estado?: string;
    center?: { latitude: number; longitude: number } | null;
    radiusKm?: number;
  } = {}
): Promise<ReportedIncident[]> {
  const store = getMockStore();
  const targetCityKey = normalizeCityKey(options?.cidade);
  const targetStateKey = normalizeState(options?.estado || '').toUpperCase();
  const radiusMeters = (options?.radiusKm ?? 5) * 1000;

  const results: ReportedIncident[] = [];
  for (const [docId, rawData] of Object.entries(store.ocorrencias)) {
    const incident = mapMockRecordToIncident(docId, rawData);
    if (!incident) continue;
    if (incident.possivel_duplicidade) continue;

    if (targetCityKey) {
      const incCityKey = normalizeCityKey(incident.cidade);
      if (incCityKey !== targetCityKey) continue;
    }

    if (targetStateKey && incident.estado) {
      const incStateKey = normalizeState(incident.estado).toUpperCase();
      if (incStateKey && incStateKey !== targetStateKey) continue;
    }

    if (
      options.center &&
      Number.isFinite(options.center.latitude) &&
      Number.isFinite(options.center.longitude)
    ) {
      const distKm = distanceBetween(
        [options.center.latitude, options.center.longitude],
        [incident.latitude, incident.longitude]
      );
      if (distKm * 1000 > radiusMeters) continue;
    }

    results.push(incident);
  }

  if (
    options.center &&
    Number.isFinite(options.center.latitude) &&
    Number.isFinite(options.center.longitude)
  ) {
    const cLat = options.center.latitude;
    const cLng = options.center.longitude;
    results.sort((a, b) => {
      const dA = distanceBetween([cLat, cLng], [a.latitude, a.longitude]);
      const dB = distanceBetween([cLat, cLng], [b.latitude, b.longitude]);
      return dA - dB;
    });
  } else {
    results.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime() || 0;
      const timeB = new Date(b.timestamp).getTime() || 0;
      return timeB - timeA;
    });
  }

  return results;
}

export async function mockResolveUrbanIncidentByPartnerInFirebase(
  payload: ResolveUrbanIncidentByPartnerPayload
): Promise<{
  success: boolean;
  ocorrenciaId: string;
  fotoResolucaoUrl: string;
  dataResolucao: string;
  descricaoResolucao: string;
}> {
  const ocorrenciaId = (payload.ocorrenciaId || '').trim();
  if (!ocorrenciaId) {
    throw new Error('ID da ocorrência ausente para registro de resolução.');
  }

  const descricaoResolucao = (payload.descricao || '').trim().slice(0, 300);
  if (!descricaoResolucao) {
    throw new Error('Informe a descrição da correção realizada.');
  }

  if (!payload.foto) {
    throw new Error(
      'Envie uma nova foto comprovando que o problema de acesso urbano foi corrigido.'
    );
  }

  const store = getMockStore();
  const existingData = store.ocorrencias[ocorrenciaId] || {};
  const prevStatsResolvidos = store.estatisticas.resolvidos;

  const fotoResolucaoUrl = payload.foto;
  const dataResolucao = new Date().toISOString();
  const resolvidoPor = (payload.resolvidoPor || '').trim();
  const inc = payload.incident || {};

  store.ocorrencias[ocorrenciaId] = {
    ...existingData,
    id: ocorrenciaId,
    resolvido: true,
    status_resolucao: 'resolvido',
    resolvido_em_validacao: false,
    foto_resolucao: fotoResolucaoUrl,
    descricao_resolucao: descricaoResolucao,
    data_resolucao: dataResolucao,
    ...(resolvidoPor ? { resolvido_por: resolvidoPor } : {})
  };

  store.resolvidos[ocorrenciaId] = {
    ...(store.resolvidos[ocorrenciaId] || {}),
    id: ocorrenciaId,
    ocorrenciaId,
    data: dataResolucao,
    ocorrenciaData: existingData.data || inc.timestamp || undefined,
    fotoUrl: fotoResolucaoUrl,
    descricao: descricaoResolucao,
    status: 'resolvido',
    contabilizado_estatisticas: true,
    revisada: true,
    resultado_revisao: 'procedente',
    data_revisao: dataResolucao,
    revisado_por: resolvidoPor,
    resolvido_por: resolvidoPor,
    natureza: 'urbana',
    latitude: Number(existingData.latitude ?? inc.latitude ?? 0),
    longitude: Number(existingData.longitude ?? inc.longitude ?? 0),
    rua: existingData.rua || inc.rua || '',
    bairro: existingData.bairro || inc.bairro || '',
    cidade: existingData.cidade || inc.cidade || 'Belo Horizonte',
    estado: existingData.estado || inc.estado || 'MG',
    ocorrenciaFotoUrl: resolveMockPhotoUrl(
      existingData.fotoUrl || inc.fotoUrl || inc.maskedImageUrl || ''
    ),
    ocorrenciaDescricao: existingData.descricao || inc.descricao || ''
  };

  store.estatisticas = computeStatsFromRecords(store.ocorrencias, store.resolvidos);
  persistMockStore(store);
  notifyMockStatsSubscribers(store.estatisticas);

  const resolutionMeta: MulteiLiveEventMeta = {
    cidade: String(existingData.cidade || inc.cidade || 'Belo Horizonte'),
    estado: String(existingData.estado || inc.estado || 'MG'),
    bairro: String(existingData.bairro || inc.bairro || ''),
    rua: String(existingData.rua || inc.rua || ''),
    natureza: 'urbana',
    ocorrenciaId,
    action: 'nova_resolucao'
  };

  if (store.estatisticas.resolvidos > prevStatsResolvidos) {
    await notifyMulteiLiveDelta('resolvidos', 1, resolutionMeta);
  } else {
    void notifyMulteiLiveDelta('denunciasPainel', 1, resolutionMeta);
  }

  return {
    success: true,
    ocorrenciaId,
    fotoResolucaoUrl,
    dataResolucao,
    descricaoResolucao
  };
}

export async function mockFetchResolvedIncidentsForPanel(options?: {
  cidade?: string;
  estado?: string;
}): Promise<ResolvedIncidentPanelItem[]> {
  const store = getMockStore();
  const items: ResolvedIncidentPanelItem[] = [];

  for (const [docId, rawDoc] of Object.entries(store.resolvidos)) {
    const d = normalizeMockPhotoFields(rawDoc);
    const id = String(docId || d.id || '').trim();
    const ocorrenciaId = String(d.ocorrenciaId || id).trim();
    const statusRaw = String(d.status || 'pendente').trim().toLowerCase();

    let revisada = Boolean(d.revisada === true);
    let resultadoRevisao: ResolutionReviewDecision | '' = '';

    if (d.resultado_revisao === 'procedente' || d.resultado_revisao === 'improcedente') {
      resultadoRevisao = d.resultado_revisao;
      revisada = true;
    } else if (statusRaw === 'procedente' || statusRaw === 'resolvido') {
      resultadoRevisao = 'procedente';
      revisada = true;
    } else if (statusRaw === 'improcedente') {
      resultadoRevisao = 'improcedente';
      revisada = true;
    }

    const oc = store.ocorrencias[ocorrenciaId] || {};

    items.push({
      id,
      ocorrenciaId,
      data: String(d.data || new Date().toISOString()),
      ocorrenciaData: d.ocorrenciaData
        ? String(d.ocorrenciaData)
        : oc.data
          ? String(oc.data)
          : undefined,
      fotoUrl: resolveMockPhotoUrl(String(d.fotoUrl || d.foto_resolucao || d.foto || '').trim()),
      descricao: String(d.descricao || d.descricao_resolucao || '').trim(),
      ocorrenciaFotoUrl: resolveMockPhotoUrl(
        String(d.ocorrenciaFotoUrl || oc.fotoUrl || '').trim()
      ),
      ocorrenciaDescricao: String(d.ocorrenciaDescricao || oc.descricao || '').trim(),
      status: statusRaw,
      natureza: String(d.natureza || 'urbana').trim(),
      latitude: Number(d.latitude ?? oc.latitude ?? 0),
      longitude: Number(d.longitude ?? oc.longitude ?? 0),
      rua: String(d.rua || oc.rua || '').trim(),
      bairro: String(d.bairro || oc.bairro || '').trim(),
      cidade: String(d.cidade || oc.cidade || '').trim(),
      estado: String(d.estado || oc.estado || '').trim(),
      revisada,
      resultado_revisao: resultadoRevisao,
      data_revisao: d.data_revisao ? String(d.data_revisao) : undefined,
      revisado_por: d.revisado_por ? String(d.revisado_por) : undefined,
      observacao_admin: d.observacao_admin ? String(d.observacao_admin) : undefined,
      resolvido_por: d.resolvido_por ? String(d.resolvido_por) : undefined
    });
  }

  const filterCity = normalizeCityKey(options?.cidade);
  const filterUf = String(options?.estado || '').trim().toUpperCase();

  const filtered = items.filter((item) => {
    if (filterCity && normalizeCityKey(item.cidade) !== filterCity) return false;
    if (filterUf) {
      const itemUf = String(item.estado || '').trim().toUpperCase();
      if (itemUf && itemUf !== filterUf) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    const timeA = new Date(a.data).getTime() || 0;
    const timeB = new Date(b.data).getTime() || 0;
    return timeB - timeA;
  });

  return filtered;
}

export async function mockReviewResolvedIncidentInFirebase(params: {
  item: ResolvedIncidentPanelItem;
  decision: ResolutionReviewDecision;
  observacaoAdmin?: string;
  reviewerEmail?: string;
}): Promise<ResolvedIncidentPanelItem> {
  const { item, decision, observacaoAdmin = '', reviewerEmail = '' } = params;
  const docId = (item.id || item.ocorrenciaId || '').trim();
  const ocorrenciaId = (item.ocorrenciaId || item.id || '').trim();
  if (!docId) {
    throw new Error('ID do registro de resolução inválido.');
  }

  const store = getMockStore();
  const prevResolvidosCount = store.estatisticas.resolvidos;
  const nowIso = new Date().toISOString();
  const isProcedente = decision === 'procedente';
  const nextStatus = isProcedente ? 'procedente' : 'improcedente';

  store.resolvidos[docId] = {
    ...(store.resolvidos[docId] || {}),
    id: docId,
    ocorrenciaId,
    status: nextStatus,
    revisada: true,
    resultado_revisao: decision,
    contabilizado_estatisticas: isProcedente,
    data_revisao: nowIso,
    revisado_por: reviewerEmail,
    observacao_admin: observacaoAdmin.trim()
  };

  if (ocorrenciaId && store.ocorrencias[ocorrenciaId]) {
    if (isProcedente) {
      store.ocorrencias[ocorrenciaId] = {
        ...store.ocorrencias[ocorrenciaId],
        resolvido: true,
        status_resolucao: 'resolvido',
        resolvido_em_validacao: false,
        foto_resolucao: resolveMockPhotoUrl(item.fotoUrl),
        descricao_resolucao: item.descricao,
        data_resolucao: item.data || nowIso,
        resolvido_por: reviewerEmail || item.resolvido_por || 'Comunidade Multei',
        revisada_resolucao: true,
        resultado_revisao_resolucao: 'procedente',
        data_revisao_resolucao: nowIso
      };
    } else {
      store.ocorrencias[ocorrenciaId] = {
        ...store.ocorrencias[ocorrenciaId],
        resolvido: false,
        status_resolucao: 'improcedente',
        resolvido_em_validacao: false,
        foto_resolucao: '',
        descricao_resolucao: '',
        data_resolucao: '',
        revisada_resolucao: true,
        resultado_revisao_resolucao: 'improcedente',
        data_revisao_resolucao: nowIso
      };
    }
  }

  store.estatisticas = computeStatsFromRecords(store.ocorrencias, store.resolvidos);
  persistMockStore(store);
  notifyMockStatsSubscribers(store.estatisticas);

  const resolutionMeta: MulteiLiveEventMeta = {
    cidade: String(item.cidade || 'Belo Horizonte'),
    estado: String(item.estado || 'MG'),
    bairro: String(item.bairro || ''),
    rua: String(item.rua || ''),
    natureza: 'urbana',
    ocorrenciaId,
    action: 'revisao'
  };

  if (store.estatisticas.resolvidos < prevResolvidosCount) {
    await notifyMulteiLiveDelta('resolvidos', -1, resolutionMeta);
  } else if (store.estatisticas.resolvidos > prevResolvidosCount) {
    await notifyMulteiLiveDelta('resolvidos', 1, resolutionMeta);
  }

  void notifyMulteiLiveDelta('denunciasPainel', 1, resolutionMeta);

  return {
    ...item,
    status: nextStatus,
    revisada: true,
    resultado_revisao: decision,
    data_revisao: nowIso,
    revisado_por: reviewerEmail,
    observacao_admin: observacaoAdmin.trim()
  };
}
