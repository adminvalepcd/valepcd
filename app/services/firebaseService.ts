import { useNuxtApp } from '#app';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  increment,
  query,
  where,
  orderBy,
  startAt,
  endAt,
  type Firestore
} from 'firebase/firestore';
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  getBlob,
  type FirebaseStorage
} from 'firebase/storage';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  browserLocalPersistence,
  inMemoryPersistence,
  setPersistence,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User
} from 'firebase/auth';
import {
  geohashForLocation,
  geohashQueryBounds,
  distanceBetween
} from 'geofire-common';
import type { ReportedIncident } from '../types';
import {
  getAddressDetailsFromCoords,
  extractCityAndStateFromText,
  normalizeState,
  isCoordinateInBrazilBounds,
  isValidBrazilUF,
  checkIfCoordsInBrazil
} from './geoService';

export const OCORRENCIAS_COLLECTION = 'ocorrencias';
export const RESOLVIDOS_COLLECTION = 'resolvidos';
export const REPORTADAS_COLLECTION = 'reportadas';
export const ESTATISTICAS_COLLECTION = 'estatisticas';
export const ESTATISTICAS_DOC_ID = 'resumo';
export const USUARIOS_COLLECTION = 'usuarios';

export type MulteiUserRole = 'admin' | 'parceria' | 'parceiro';

export interface MulteiPanelUserProfile {
  uid: string;
  email: string;
  nome?: string;
  sobrenome?: string;
  nomeCompleto?: string;
  role: MulteiUserRole;
  cidade?: string;
  estado?: string;
  ativo?: boolean;
}

export interface MulteiPanelManagedUser {
  id: string;
  uid: string;
  role: 'admin' | 'parceria';
  nome: string;
  sobrenome: string;
  nomeCompleto: string;
  email: string;
  cidade: string;
  estado: string;
  ativo: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReportHistoryEntry {
  motivo: string;
  data: string;
  apos_revisao?: boolean;
}

export type ReportReviewDecision =
  | 'procedente'
  | 'improcedente'
  | 'nao_duplicidade'
  | 'indefinido'
  | 'duplicidade';

export interface ReportedIncidentPanelItem {
  id: string;
  ocorrenciaId: string;
  data: string;
  data_report: string;
  ultima_data_report: string;
  latitude: number;
  longitude: number;
  geohash: string;
  fotoUrl: string;
  natureza: string;
  descricao: string;
  rua: string;
  bairro: string;
  cidade: string;
  estado: string;
  classificacao: string;
  verificacao: string;
  ativo: boolean;
  motivo_denuncia: string;
  motivo_report: string;
  total_reports: number;
  outras_revisoes_solicitadas: boolean;
  historico_reports: ReportHistoryEntry[];
  revisada: boolean;
  resultado_revisao?: ReportReviewDecision | '';
  data_revisao?: string;
  revisado_por?: string;
  observacao_admin?: string;
  legacyDocIds?: string[];
  possivel_duplicidade?: boolean;
  origem_duplicidade?: boolean;
  duplicidade_de_id?: string;
  rotulo_duplicidade?: string;
  duplicidade_original_fotoUrl?: string;
}

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

export interface MulteiLiveDeltaEvent extends MulteiLiveEventMeta {
  id: number;
  category: MulteiLiveCategory;
  delta: 1 | -1;
  timestamp: number;
}

export interface MulteiStats {
  totalGeral: number;
  infracoesTransito: number;
  mobilidadeUrbana: number;
  resolvidos: number;
  updatedAt?: string;
}

export interface SaveUrbanResolutionPayload {
  ocorrenciaId: string;
  foto: string;
  descricao: string;
  incident?: Partial<ReportedIncident>;
}

export interface MapVisibleBounds {
  north: number;
  south: number;
  east: number;
  west: number;
  center?: {
    latitude: number;
    longitude: number;
  } | null;
}

export interface SaveFirebaseIncidentPayload {
  data?: string;
  latitude: number;
  longitude: number;
  foto: string;
  ativo?: boolean;
  motivo_denuncia?: string;
  cidade?: string;
  estado?: string;
  rua?: string;
  bairro?: string;
  classificacao?: 'A' | 'B' | 'C' | string;
  verificacao?: 'exclusiva' | 'transferencia' | 'pedestre' | '' | string;
  natureza?: string;
  descricao?: string;
  possivel_duplicidade?: boolean;
  duplicidade_de_id?: string;
  rotulo_duplicidade?: string;
  motivo_duplicidade?: string;
}

export function normalizeVerificacao(raw?: unknown): 'exclusiva' | 'transferencia' | 'pedestre' | '' {
  if (!raw) return '';
  const v = String(raw).trim().toLowerCase();
  if (!v) return '';
  if (v.includes('transfer') || v.includes('zebrad')) {
    return 'transferencia';
  }
  if (v.includes('exclusiv') || v.includes('vaga') || v.includes('acess') || v.includes('cadeira')) {
    return 'exclusiva';
  }
  if (v.includes('pedestr') || v.includes('faixa')) {
    return 'pedestre';
  }
  return '';
}

/**
 * Obtém as instâncias do Firestore ($db), Storage ($storage) e Auth ($auth) do plugin Nuxt
 * ou diretamente do app Firebase inicializado (seguro após chamadas await).
 */
function getFirebaseServices(): { db: Firestore; storage: FirebaseStorage; auth: Auth } {
  try {
    const nuxtApp = useNuxtApp();
    if (nuxtApp?.$db && nuxtApp?.$storage) {
      const app = getApps().length > 0 ? getApp() : undefined;
      return {
        db: nuxtApp.$db as Firestore,
        storage: nuxtApp.$storage as FirebaseStorage,
        auth: (nuxtApp.$auth as Auth) || (app ? getAuth(app) : ({} as Auth))
      };
    }
  } catch {
    // Caso chamado fora do contexto síncrono do Nuxt composable, usa getApp()
  }

  if (getApps().length > 0) {
    const app = getApp();
    return {
      db: getFirestore(app),
      storage: getStorage(app),
      auth: getAuth(app)
    };
  }

  throw new Error('Firebase não está inicializado.');
}

/**
 * Converte uma string Data URL / Base64 para Uint8Array binário para upload no Firebase Storage.
 */
function base64ToUint8Array(base64Str: string): { bytes: Uint8Array; contentType: string } {
  const trimmed = (base64Str || '').trim();
  let contentType = 'image/webp';
  let rawBase64 = trimmed;

  const match = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
  if (match) {
    contentType = match[1].toLowerCase();
    rawBase64 = match[2];
  } else if (trimmed.includes(',')) {
    rawBase64 = trimmed.split(',').pop() || '';
  }

  const binaryString = atob(rawBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return { bytes, contentType };
}

/**
 * Converte um documento bruto da coleção `ocorrencias` em `ReportedIncident`.
 */
function mapDocToIncident(docId: string, data: Record<string, any>): ReportedIncident | null {
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
  const fotoUrl = data.fotoUrl || data.foto || data.image || '';
  const descParts = [ruaVal, bairroVal, cidadeVal, estadoVal].filter(Boolean);

  const fotoResolucaoVal = String(
    data.foto_resolucao || data.fotoResolucaoUrl || data.foto_resolvido || ''
  ).trim();
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
    maskedImageUrl: fotoUrl,
    description: data.description || (descParts.length > 0 ? descParts.join(' - ') : 'Infração registrada'),
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

const REGION_CACHE_STORAGE_KEY = 'multei_region_cache_v1';
const STATS_CACHE_STORAGE_KEY = 'multei_stats_cache_v1';
const REGION_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos de cache por região
const STATS_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos de cache para fallback de estatísticas
const MAX_CACHED_REGIONS = 8;

interface CachedRegionEntry {
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  fetchedAt: number;
  incidents: ReportedIncident[];
}

let inMemoryRegionCache: CachedRegionEntry[] | null = null;
const inFlightRegionPromises = new Map<string, Promise<ReportedIncident[]>>();

function loadRegionCacheEntries(): CachedRegionEntry[] {
  if (inMemoryRegionCache) {
    return inMemoryRegionCache;
  }
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(REGION_CACHE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        inMemoryRegionCache = parsed;
        return parsed;
      }
    }
  } catch {}
  inMemoryRegionCache = [];
  return [];
}

function saveRegionCacheEntries(entries: CachedRegionEntry[]) {
  inMemoryRegionCache = entries;
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(REGION_CACHE_STORAGE_KEY, JSON.stringify(entries));
  } catch {}
}

function findValidCachedRegion(
  centerLat: number,
  centerLng: number,
  radiusMeters: number
): ReportedIncident[] | null {
  const now = Date.now();
  const entries = loadRegionCacheEntries();
  const validEntries = entries.filter(
    (entry) =>
      entry &&
      typeof entry.fetchedAt === 'number' &&
      now - entry.fetchedAt < REGION_CACHE_TTL_MS &&
      Array.isArray(entry.incidents)
  );

  if (validEntries.length !== entries.length) {
    saveRegionCacheEntries(validEntries);
  }

  for (const entry of validEntries) {
    const distKm = distanceBetween([entry.centerLat, entry.centerLng], [centerLat, centerLng]);
    const distMeters = distKm * 1000;
    // Se o centro solicitado está a até 1.5 km do centro já carregado (ou totalmente coberto pelo raio em cache)
    const isCovered =
      (distMeters <= 1500 && radiusMeters <= entry.radiusMeters + 500) ||
      distMeters + radiusMeters <= entry.radiusMeters + 300;

    if (isCovered) {
      return entry.incidents;
    }
  }

  return null;
}

function storeRegionInCache(
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
  incidents: ReportedIncident[]
) {
  const now = Date.now();
  const entries = loadRegionCacheEntries().filter((entry) => {
    if (!entry || now - entry.fetchedAt >= REGION_CACHE_TTL_MS) return false;
    const distKm = distanceBetween([entry.centerLat, entry.centerLng], [centerLat, centerLng]);
    // Substitui entradas muito próximas (< 1.5 km) pela mais recente
    return distKm * 1000 > 1500;
  });

  entries.unshift({
    centerLat,
    centerLng,
    radiusMeters,
    fetchedAt: now,
    incidents
  });

  saveRegionCacheEntries(entries.slice(0, MAX_CACHED_REGIONS));
}

/**
 * Busca ocorrências no Firestore em um raio de 5 km (padrão) ao redor do centro carregado
 * usando `geohashQueryBounds` (geofire-common) e cache regional inteligente (TTL de 15 min),
 * evitando chamadas repetidas ao recarregar a página na mesma região.
 */
export async function fetchIncidentsByVisibleArea(options: {
  bounds?: MapVisibleBounds | null;
  center?: { latitude: number; longitude: number } | null;
  radiusKm?: number;
  forceRefresh?: boolean;
}): Promise<ReportedIncident[]> {
  try {
    let centerLat: number;
    let centerLng: number;
    let radiusMeters: number;
    const bounds = options.bounds;
    const defaultRadiusMeters = (options.radiusKm ?? 5) * 1000;

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
        // Garante no mínimo 5 km de raio carregado ao redor da tela (ou mais se o zoom estiver aberto)
        radiusMeters = Math.min(Math.max(cornerDistanceKm * 1000 + defaultRadiusMeters, defaultRadiusMeters), 80000);
      } else {
        radiusMeters = defaultRadiusMeters;
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
      radiusMeters = Math.min(Math.max(cornerDistanceKm * 1000 + defaultRadiusMeters, defaultRadiusMeters), 80000);
    } else {
      const cachedFallback = loadIncidentsFromLocalCache();
      if (!options.forceRefresh && cachedFallback.length > 0) {
        return cachedFallback;
      }
      const { db } = getFirebaseServices();
      const colRef = collection(db, OCORRENCIAS_COLLECTION);
      const snap = await getDocs(colRef);
      const all: ReportedIncident[] = [];
      snap.forEach((docSnap) => {
        const mapped = mapDocToIncident(docSnap.id, docSnap.data());
        if (mapped) all.push(mapped);
      });
      return all;
    }

    // 1. Verifica se a região já está em cache válido (0 leituras no Firestore)
    if (!options.forceRefresh) {
      const cachedRegion = findValidCachedRegion(centerLat, centerLng, radiusMeters);
      if (cachedRegion) {
        return cachedRegion;
      }
    }

    // 2. Deduplica chamadas simultâneas para a mesma região arredondada (~1 km)
    const inflightKey = `${centerLat.toFixed(2)}_${centerLng.toFixed(2)}_${Math.round(radiusMeters / 1000)}`;
    if (!options.forceRefresh && inFlightRegionPromises.has(inflightKey)) {
      return await inFlightRegionPromises.get(inflightKey)!;
    }

    const fetchPromise = (async () => {
      const { db } = getFirebaseServices();
      const colRef = collection(db, OCORRENCIAS_COLLECTION);
      const queryBounds = geohashQueryBounds([centerLat, centerLng], radiusMeters);
      const snapshots = await Promise.all(
        queryBounds.map(([startHash, endHash]) => {
          const q = query(colRef, orderBy('geohash'), startAt(startHash), endAt(endHash));
          return getDocs(q);
        })
      );

      const seenIds = new Set<string>();
      const results: ReportedIncident[] = [];

      for (const snap of snapshots) {
        snap.forEach((docSnap) => {
          if (seenIds.has(docSnap.id)) return;
          seenIds.add(docSnap.id);

          const incident = mapDocToIncident(docSnap.id, docSnap.data());
          if (!incident) return;

          // Filtra pelo raio carregado (5 km ao redor da visualização) para manter todos os pinos da vizinhança em memória
          const distKm = distanceBetween(
            [centerLat, centerLng],
            [incident.latitude, incident.longitude]
          );
          if (distKm * 1000 > radiusMeters) return;

          results.push(incident);
        });
      }

      results.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime() || 0;
        const timeB = new Date(b.timestamp).getTime() || 0;
        return timeB - timeA;
      });

      storeRegionInCache(centerLat, centerLng, radiusMeters, results);

      if (typeof window !== 'undefined' && results.length > 0) {
        try {
          localStorage.setItem('multei_cached_incidents', JSON.stringify(results));
        } catch {}
      }

      return results;
    })();

    inFlightRegionPromises.set(inflightKey, fetchPromise);
    try {
      return await fetchPromise;
    } finally {
      inFlightRegionPromises.delete(inflightKey);
    }
  } catch (err) {
    console.warn('[firebaseService] Erro ao buscar ocorrências no Firestore, usando cache local:', err);
    return loadIncidentsFromLocalCache();
  }
}

const recentIncidentBase64Memory = new Map<string, string>();

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Falha ao converter Blob em Data URL.'));
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(blob);
  });
}

/**
 * Busca ocorrências de trânsito ativas registradas nos últimos `windowMs` (padrão: 2 minutos)
 * dentro de um raio físico de `radiusMeters` (padrão: 10 metros) para verificação anti-duplicidade.
 */
export async function findRecentNearbyTrafficIncidents(
  latitude: number,
  longitude: number,
  windowMs = 2 * 60 * 1000,
  radiusMeters = 10
): Promise<ReportedIncident[]> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return [];
  }

  const now = Date.now();
  const candidatesById = new Map<string, ReportedIncident>();

  const checkAndAddCandidate = (inc: ReportedIncident | null | undefined) => {
    if (!inc || !inc.id) return;
    if (inc.ativo === false) return;
    const nat = String(inc.natureza || 'infracao_veicular').trim().toLowerCase();
    if (nat === 'urbana') return;

    const incTime = new Date(inc.timestamp).getTime();
    if (!Number.isFinite(incTime)) return;
    const ageMs = now - incTime;
    // Aceita registros feitos nos últimos 2 minutos (com tolerância de 60s para pequenas diferenças de relógio)
    if (ageMs < -60_000 || ageMs > windowMs) return;

    const distKm = distanceBetween([latitude, longitude], [inc.latitude, inc.longitude]);
    const distMeters = distKm * 1000;
    if (distMeters <= radiusMeters) {
      candidatesById.set(inc.id, inc);
    }
  };

  // 1. Verifica primeiramente no cache local (caso o registro anterior tenha acabado de ser enviado)
  try {
    const localList = loadIncidentsFromLocalCache();
    for (const item of localList) {
      checkAndAddCandidate(item);
    }
  } catch {}

  // 2. Consulta diretamente no Firestore em um raio curto usando geohashQueryBounds
  try {
    const { db } = getFirebaseServices();
    const colRef = collection(db, OCORRENCIAS_COLLECTION);
    // Usa no mínimo 35m nos bounds de geohash para não perder bordas de células vizinhas e filtra exatamente <= 10m em seguida
    const queryBounds = geohashQueryBounds([latitude, longitude], Math.max(radiusMeters, 35));
    const snapshots = await Promise.all(
      queryBounds.map(([startHash, endHash]) => {
        const q = query(colRef, orderBy('geohash'), startAt(startHash), endAt(endHash));
        return getDocsFromServer(q).catch(() => getDocs(q));
      })
    );

    for (const snap of snapshots) {
      snap.forEach((docSnap) => {
        const mapped = mapDocToIncident(docSnap.id, docSnap.data() || {});
        checkAndAddCandidate(mapped);
      });
    }
  } catch (err) {
    console.warn('[firebaseService] Aviso ao buscar ocorrências recentes em 10m:', err);
  }

  const results = Array.from(candidatesById.values());
  // Ordena da mais antiga (original/primária) para a mais recente
  results.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime() || 0;
    const timeB = new Date(b.timestamp).getTime() || 0;
    return timeA - timeB;
  });

  return results;
}

/**
 * Obtém a imagem de uma ocorrência existente em formato Base64 Data URL para comparação no Gemini.
 */
export async function fetchIncidentImageAsBase64(
  incident: Partial<ReportedIncident>
): Promise<string | null> {
  if (!incident) return null;

  const id = (incident.id || '').trim();
  const rawUrl = (incident.fotoUrl || incident.maskedImageUrl || '').trim();

  if (rawUrl.startsWith('data:image/')) {
    return rawUrl;
  }

  if (id && recentIncidentBase64Memory.has(id)) {
    return recentIncidentBase64Memory.get(id)!;
  }
  if (rawUrl && recentIncidentBase64Memory.has(rawUrl)) {
    return recentIncidentBase64Memory.get(rawUrl)!;
  }

  // 1. Tenta obter do CacheStorage do navegador se já estiver em cache
  if (typeof window !== 'undefined' && rawUrl && 'caches' in window) {
    try {
      const cache = await window.caches.open(IMAGE_CACHE_NAME);
      const cachedResp = await cache.match(rawUrl, { ignoreVary: true });
      if (cachedResp && cachedResp.ok && cachedResp.type !== 'opaque') {
        const blob = await cachedResp.blob();
        if (blob.size > 0) {
          const base64 = await blobToDataUrl(blob);
          if (id) recentIncidentBase64Memory.set(id, base64);
          return base64;
        }
      }
    } catch {}
  }

  // 2. Tenta buscar via SDK oficial do Firebase Storage (`ocorrencias/{id}.webp`)
  if (id) {
    try {
      const { storage } = getFirebaseServices();
      const fileRef = storageRef(storage, `ocorrencias/${id}.webp`);
      const blob = await getBlob(fileRef);
      if (blob && blob.size > 0) {
        const base64 = await blobToDataUrl(blob);
        recentIncidentBase64Memory.set(id, base64);
        return base64;
      }
    } catch {}
  }

  // 3. Fallback: tenta buscar via fetch direto da URL pública do Storage
  if (rawUrl) {
    try {
      const resp = await fetch(rawUrl, { mode: 'cors', credentials: 'omit', cache: 'force-cache' });
      if (resp.ok) {
        const blob = await resp.blob();
        if (blob.size > 0) {
          const base64 = await blobToDataUrl(blob);
          if (id) recentIncidentBase64Memory.set(id, base64);
          recentIncidentBase64Memory.set(rawUrl, base64);
          return base64;
        }
      }
    } catch {}
  }

  return null;
}

/**
 * Salva uma nova ocorrência no Firebase:
 * 1. Gera um ID único do Firestore para a coleção `ocorrencias`
 * 2. Faz upload da foto anonimizada para `/ocorrencias/{id}.webp` no Firebase Storage
 * 3. Obtém a `downloadURL`
 * 4. Grava o documento em `ocorrencias/{id}` com `geohash`, `natureza` e metadados de duplicidade (se houver)
 * 5. Atualiza o documento agregador `estatisticas/resumo` (apenas se não for possível duplicidade)
 */
export async function saveIncidentToFirebase(
  incident: SaveFirebaseIncidentPayload
): Promise<{
  success: boolean;
  id: string;
  fotoUrl: string;
  geohash: string;
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
  const resolvedClassificacao = ((incident.classificacao || 'C').trim().toUpperCase()) as 'A' | 'B' | 'C';
  const resolvedVerificacao = normalizeVerificacao(incident.verificacao);

  const hasStreetNum = (s: string) => /,\s*\d+/.test(s);

  if (
    (!resolvedCidade || !resolvedEstado || !resolvedRua || !resolvedBairro || !hasStreetNum(resolvedRua)) &&
    Number.isFinite(incident.latitude) &&
    Number.isFinite(incident.longitude)
  ) {
    try {
      const geoDetails = await getAddressDetailsFromCoords(incident.latitude, incident.longitude);
      if (geoDetails.isBrazil === false) {
        throw new Error('Ocorrências no Multei só podem ser incluídas no Brasil.');
      }
      if ((!resolvedRua || (!hasStreetNum(resolvedRua) && hasStreetNum(geoDetails.rua || ''))) && geoDetails.rua) {
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
        if ((!resolvedRua || (!hasStreetNum(resolvedRua) && hasStreetNum(parsed.rua || ''))) && parsed.rua) {
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

  const confirmedBrazil = await checkIfCoordsInBrazil(latNum, lngNum);
  if (!confirmedBrazil || !isValidBrazilUF(resolvedEstado)) {
    throw new Error('Ocorrências no Multei só podem ser incluídas no Brasil.');
  }

  const { db, storage } = getFirebaseServices();

  // 1. Gera referência com ID nativo do Firestore na coleção "ocorrencias"
  const newDocRef = doc(collection(db, OCORRENCIAS_COLLECTION));
  const id = newDocRef.id;

  // 2. Converte a foto WebP (Base64) para binário e faz upload em /ocorrencias/{id}.webp
  let fotoUrl = '';
  if (incident.foto) {
    const { bytes, contentType } = base64ToUint8Array(incident.foto);
    const imageFileRef = storageRef(storage, `ocorrencias/${id}.webp`);
    await uploadBytes(imageFileRef, bytes, {
      contentType: contentType || 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable'
    });
    fotoUrl = await getDownloadURL(imageFileRef);
    await seedIncidentImageCache(fotoUrl, bytes, contentType || 'image/webp');
    recentIncidentBase64Memory.set(id, incident.foto);
    if (fotoUrl) {
      recentIncidentBase64Memory.set(fotoUrl, incident.foto);
    }
  }

  // 3. Calcula o geohash das coordenadas
  const latitude = Number(incident.latitude);
  const longitude = Number(incident.longitude);
  const geohash = geohashForLocation([latitude, longitude]);
  const dataIso = incident.data || new Date().toISOString();

  const resolvedDescricao = (incident.descricao || '').trim().slice(0, 300);
  const isPossivelDuplicidade = Boolean(incident.possivel_duplicidade);
  const duplicidadeDeId = isPossivelDuplicidade ? (incident.duplicidade_de_id || '').trim() : '';
  const rotuloDuplicidade = isPossivelDuplicidade
    ? (incident.rotulo_duplicidade || 'Possível duplicidade').trim()
    : '';

  // 4. Monta e salva o documento na coleção "ocorrencias"
  const docData: Record<string, any> = {
    id,
    data: dataIso,
    latitude,
    longitude,
    geohash,
    fotoUrl,
    natureza: incident.natureza || 'infracao_veicular',
    descricao: resolvedDescricao,
    ativo: incident.ativo !== undefined ? incident.ativo : true,
    motivo_denuncia: incident.motivo_denuncia || '',
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

  await setDoc(newDocRef, docData);

  // 4b. Se for possível duplicidade, inclui automaticamente na coleção `reportadas` para averiguação no Painel Admin
  if (isPossivelDuplicidade) {
    const autoDuplicateReason = incident.motivo_duplicidade
      ? `Possível duplicidade detectada pelo Gemini: ${incident.motivo_duplicidade}`
      : 'Possível duplicidade detectada pelo sistema (registro nos últimos 2 min num raio de 10m com o mesmo veículo sob outro ângulo).';
    try {
      await setDoc(
        doc(db, REPORTADAS_COLLECTION, id),
        {
          id,
          ocorrenciaId: id,
          data: dataIso,
          data_report: dataIso,
          ultima_data_report: dataIso,
          latitude,
          longitude,
          geohash,
          fotoUrl,
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
          resultado_revisao: ''
        },
        { merge: true }
      );
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
    } catch (repErr) {
      console.warn('[firebaseService] Aviso ao registrar possível duplicidade em reportadas:', repErr);
    }
  }

  // 5. Atualiza contadores em `estatisticas/resumo` (apenas se ativa e NÃO for possível duplicidade)
  if (docData.ativo && !isPossivelDuplicidade) {
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
    try {
      const statsRef = doc(db, ESTATISTICAS_COLLECTION, ESTATISTICAS_DOC_ID);
      await setDoc(
        statsRef,
        {
          totalGeral: increment(1),
          [isUrbana ? 'mobilidadeUrbana' : 'infracoesTransito']: increment(1),
          updatedAt: dataIso
        },
        { merge: true }
      );
    } catch (statsErr) {
      console.warn('[firebaseService] Aviso ao atualizar estatísticas:', statsErr);
    }
  }

  saveIncidentToLocalCache({
    id,
    timestamp: dataIso,
    latitude,
    longitude,
    geohash,
    natureza: docData.natureza,
    descricao: resolvedDescricao,
    rua: resolvedRua,
    bairro: resolvedBairro,
    cidade: resolvedCidade,
    estado: resolvedEstado,
    classificacao: resolvedClassificacao,
    verificacao: resolvedVerificacao,
    fotoUrl,
    maskedImageUrl: fotoUrl || incident.foto,
    description:
      [resolvedRua, resolvedBairro, resolvedCidade, resolvedEstado].filter(Boolean).join(' - ') ||
      'Infração registrada',
    ativo: docData.ativo,
    motivo_denuncia: docData.motivo_denuncia,
    possivel_duplicidade: isPossivelDuplicidade,
    duplicidade_de_id: duplicidadeDeId,
    rotulo_duplicidade: rotuloDuplicidade
  });

  return {
    success: true,
    id,
    fotoUrl,
    geohash,
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

/**
 * Reporta uma ocorrência no Firestore consolidando na mesma entrada da coleção `reportadas` (`reportadas/{ocorrenciaId}`).
 * - Se for o 1º report (ainda não validada como improcedente pelo admin), marca `ativo: false` em `ocorrencias` e atualiza as estatísticas.
 * - Se a ocorrência já foi validada como `improcedente` pelo admin (Opção A), mantém `ativo: true` no mapa,
 *   e apenas incrementa `total_reports` (2ª, 3ª vez reportada) e `historico_reports` no mesmo documento em `reportadas`.
 */
export async function reportIncidentInFirebase(
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

  const { db } = getFirebaseServices();
  const docRef = doc(db, OCORRENCIAS_COLLECTION, cleanId);
  let targetReportDocRef = doc(db, REPORTADAS_COLLECTION, cleanId);

  let wasActive = true;
  let wasUrbana = incidentData?.natureza === 'urbana';
  let wasPossibleDuplicate = Boolean(incidentData?.possivel_duplicidade);
  let existingData: Record<string, any> = {};
  let existingReportData: Record<string, any> = {};

  try {
    const [ocorrenciaSnap, reportSnap] = await Promise.all([
      getDoc(docRef),
      getDoc(targetReportDocRef)
    ]);

    if (ocorrenciaSnap.exists()) {
      existingData = ocorrenciaSnap.data() || {};
      wasActive = existingData.ativo !== false && String(existingData.ativo).toLowerCase() !== 'false';
      wasUrbana = existingData.natureza === 'urbana';
      wasPossibleDuplicate = Boolean(
        existingData.possivel_duplicidade === true ||
          String(existingData.possivel_duplicidade).toLowerCase() === 'true'
      );
    }

    if (reportSnap.exists()) {
      existingReportData = reportSnap.data() || {};
    } else {
      // Verifica se já existe um documento na coleção reportadas para o mesmo ocorrenciaId (mesmo com ID gerado automaticamente no passado)
      const legacyQuery = query(
        collection(db, REPORTADAS_COLLECTION),
        where('ocorrenciaId', '==', cleanId)
      );
      const legacySnap = await getDocs(legacyQuery);
      if (!legacySnap.empty) {
        // Reutiliza o próprio documento existente para não criar um segundo registro duplicado
        targetReportDocRef = legacySnap.docs[0].ref;
        legacySnap.forEach((docItem) => {
          const d = docItem.data() || {};
          existingReportData = { ...existingReportData, ...d };
        });
      }
    }
  } catch {}

  const reportedAtIso = new Date().toISOString();

  // Verifica se já foi revisada e considerada improcedente pelo administrador (Opção A)
  const alreadyApprovedImprocedente =
    (existingReportData.revisada === true && existingReportData.resultado_revisao === 'improcedente') ||
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

  const latitude = Number(existingData.latitude ?? existingReportData.latitude ?? incidentData?.latitude ?? 0);
  const longitude = Number(existingData.longitude ?? existingReportData.longitude ?? incidentData?.longitude ?? 0);
  const geohash =
    existingData.geohash ||
    existingReportData.geohash ||
    incidentData?.geohash ||
    (latitude && longitude ? geohashForLocation([latitude, longitude]) : '');

  const shouldStayActiveOnMap = alreadyApprovedImprocedente;

  const reportDocData = {
    ...existingData,
    ...existingReportData,
    id: targetReportDocRef.id,
    ocorrenciaId: cleanId,
    data: existingData.data || existingReportData.data || incidentData?.timestamp || reportedAtIso,
    latitude,
    longitude,
    geohash,
    fotoUrl:
      existingData.fotoUrl ||
      existingReportData.fotoUrl ||
      incidentData?.fotoUrl ||
      incidentData?.maskedImageUrl ||
      '',
    natureza: existingData.natureza || existingReportData.natureza || incidentData?.natureza || 'infracao_veicular',
    descricao: existingData.descricao ?? existingReportData.descricao ?? incidentData?.descricao ?? '',
    rua: existingData.rua ?? existingReportData.rua ?? incidentData?.rua ?? '',
    bairro: existingData.bairro ?? existingReportData.bairro ?? incidentData?.bairro ?? '',
    cidade: existingData.cidade ?? existingReportData.cidade ?? incidentData?.cidade ?? '',
    estado: existingData.estado ?? existingReportData.estado ?? incidentData?.estado ?? '',
    classificacao: existingData.classificacao ?? existingReportData.classificacao ?? incidentData?.classificacao ?? '',
    verificacao: existingData.verificacao ?? existingReportData.verificacao ?? incidentData?.verificacao ?? '',
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

  await setDoc(targetReportDocRef, reportDocData, { merge: true });

  if (!shouldStayActiveOnMap) {
    removeIncidentFromLocalCache(cleanId);

    await updateDoc(docRef, {
      ativo: false,
      motivo_denuncia: cleanReason
    });

    if (wasActive && !wasPossibleDuplicate) {
      adjustCachedStats({
        totalGeralDelta: -1,
        infracoesTransitoDelta: wasUrbana ? 0 : -1,
        mobilidadeUrbanaDelta: wasUrbana ? -1 : 0,
        resolvidosDelta: 0
      });
      void notifyMulteiLiveDelta(wasUrbana ? 'mobilidadeUrbana' : 'infracoesTransito', -1, {
        cidade: String(reportDocData.cidade || ''),
        estado: String(reportDocData.estado || ''),
        bairro: String(reportDocData.bairro || ''),
        rua: String(reportDocData.rua || ''),
        natureza: String(reportDocData.natureza || ''),
        ocorrenciaId: cleanId,
        action: 'novo_report'
      });
      try {
        const statsRef = doc(db, ESTATISTICAS_COLLECTION, ESTATISTICAS_DOC_ID);
        await setDoc(
          statsRef,
          {
            totalGeral: increment(-1),
            [wasUrbana ? 'mobilidadeUrbana' : 'infracoesTransito']: increment(-1),
            updatedAt: reportedAtIso
          },
          { merge: true }
        );
      } catch (statsErr) {
        console.warn('[firebaseService] Aviso ao decrementar estatísticas:', statsErr);
      }
    }
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

/**
 * Registra uma solicitação de "Problema Resolvido" para ocorrências de Mobilidade Urbana
 * na coleção `resolvidos` do Firestore (com upload da foto comprovante no Firebase Storage),
 * e marca na coleção `ocorrencias` que a ocorrência já foi sinalizada como resolvida e está sob validação.
 */
export async function submitUrbanResolutionToFirebase(
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

  const { db, storage } = getFirebaseServices();
  const ocorrenciaRef = doc(db, OCORRENCIAS_COLLECTION, ocorrenciaId);

  // Verifica se a ocorrência já foi sinalizada como resolvida no banco para evitar duplicidades
  try {
    const ocorrenciaSnap = await getDoc(ocorrenciaRef);
    if (ocorrenciaSnap.exists()) {
      const currentData = ocorrenciaSnap.data() || {};
      const alreadyPending =
        currentData.resolvido_em_validacao === true ||
        String(currentData.resolvido_em_validacao).toLowerCase() === 'true' ||
        currentData.status_resolucao === 'em_validacao';
      if (alreadyPending) {
        const dupErr = new Error('Esta ocorrência já foi sinalizada como resolvida e está sob validação.');
        (dupErr as any).code = 'ALREADY_IN_VALIDATION';
        throw dupErr;
      }
    }
  } catch (err: any) {
    if (err?.code === 'ALREADY_IN_VALIDATION') {
      throw err;
    }
  }

  const newDocRef = doc(collection(db, RESOLVIDOS_COLLECTION));
  const id = newDocRef.id;

  const { bytes, contentType } = base64ToUint8Array(payload.foto);
  let fotoUrl = '';
  try {
    const primaryRef = storageRef(storage, `resolvidos/${id}.webp`);
    await uploadBytes(primaryRef, bytes, {
      contentType: contentType || 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable'
    });
    fotoUrl = await getDownloadURL(primaryRef);
  } catch {
    const fallbackRef = storageRef(storage, `ocorrencias/resolvido_${id}.webp`);
    await uploadBytes(fallbackRef, bytes, {
      contentType: contentType || 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable'
    });
    fotoUrl = await getDownloadURL(fallbackRef);
  }

  const dataIso = new Date().toISOString();
  const inc = payload.incident || {};

  const docData = {
    id,
    ocorrenciaId,
    data: dataIso,
    fotoUrl,
    descricao,
    status: 'pendente',
    natureza: 'urbana',
    latitude: Number(inc.latitude || 0),
    longitude: Number(inc.longitude || 0),
    rua: inc.rua || '',
    bairro: inc.bairro || '',
    cidade: inc.cidade || '',
    estado: inc.estado || '',
    ocorrenciaFotoUrl: inc.fotoUrl || inc.maskedImageUrl || '',
    ocorrenciaDescricao: inc.descricao || ''
  };

  await setDoc(newDocRef, docData);

  // Marca na coleção "ocorrencias" que esta ocorrência já foi sinalizada como resolvida e está sob validação
  await updateDoc(ocorrenciaRef, {
    resolvido_em_validacao: true,
    status_resolucao: 'em_validacao',
    resolvidoId: id,
    data_sinalizacao_resolvido: dataIso
  });

  // Atualiza contador de resolvidos em `estatisticas/resumo` e emite +1 ao vivo no backend Nuxt
  adjustCachedStats({
    totalGeralDelta: 0,
    infracoesTransitoDelta: 0,
    mobilidadeUrbanaDelta: 0,
    resolvidosDelta: 1
  });
  void notifyMulteiLiveDelta('resolvidos', 1, {
    cidade: String(docData.cidade || ''),
    estado: String(docData.estado || ''),
    bairro: String(docData.bairro || ''),
    rua: String(docData.rua || ''),
    natureza: 'urbana',
    ocorrenciaId,
    action: 'nova_resolucao'
  });
  try {
    const statsRef = doc(db, ESTATISTICAS_COLLECTION, ESTATISTICAS_DOC_ID);
    await setDoc(
      statsRef,
      {
        resolvidos: increment(1),
        updatedAt: dataIso
      },
      { merge: true }
    );
  } catch (statsErr) {
    console.warn('[firebaseService] Aviso ao incrementar contador de resolvidos:', statsErr);
  }

  // Atualiza também o cache local e regional para refletir o status imediatamente
  markIncidentResolvedInLocalCache(ocorrenciaId);

  return {
    success: true,
    id,
    fotoUrl
  };
}

const LIVE_BROADCAST_CHANNEL_NAME = 'multei_live_stats_channel_v1';

/**
 * Envia o evento anônimo de +1 (ou -1) para o backend do Nuxt (`/api/multei/live`)
 * e sincroniza abas abertas no mesmo navegador via `BroadcastChannel`.
 */
export async function notifyMulteiLiveDelta(
  category: MulteiLiveCategory,
  delta: 1 | -1 = 1,
  meta?: MulteiLiveEventMeta
): Promise<void> {
  if (typeof window === 'undefined') return;

  let dispatchedEvent: MulteiLiveDeltaEvent | null = null;

  try {
    const res = await fetch('/api/multei/live', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        category,
        delta,
        ...(meta || {})
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.event && typeof data.event.id === 'number') {
        dispatchedEvent = data.event as MulteiLiveDeltaEvent;
      }
    }
  } catch {
    // Falha silenciosa de rede — fallback local via BroadcastChannel abaixo
  }

  if (!dispatchedEvent) {
    dispatchedEvent = {
      id: Date.now(),
      category,
      delta,
      timestamp: Date.now(),
      ...(meta || {})
    };
  }

  try {
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel(LIVE_BROADCAST_CHANNEL_NAME);
      bc.postMessage(dispatchedEvent);
      bc.close();
    }
  } catch {}
}

const STATS_SESSION_STORAGE_KEY = 'multei_stats_session_v1';
let inMemoryLiveStatsEntry: { stats: MulteiStats; fetchedAt: number } | null = null;
let inFlightStatsPromise: Promise<MulteiStats> | null = null;

function loadSessionStatsEntry(): { stats: MulteiStats; fetchedAt: number } | null {
  if (inMemoryLiveStatsEntry && Date.now() - inMemoryLiveStatsEntry.fetchedAt < STATS_CACHE_TTL_MS) {
    return inMemoryLiveStatsEntry;
  }
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STATS_SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed?.stats &&
        typeof parsed.fetchedAt === 'number' &&
        Date.now() - parsed.fetchedAt < STATS_CACHE_TTL_MS
      ) {
        inMemoryLiveStatsEntry = parsed;
        return parsed;
      }
    }
  } catch {}
  return null;
}

function loadCachedStatsEntry(): { stats: MulteiStats; fetchedAt: number } | null {
  const sessionEntry = loadSessionStatsEntry();
  if (sessionEntry) return sessionEntry;
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STATS_CACHE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.stats && typeof parsed.fetchedAt === 'number') {
        return parsed;
      }
    }
  } catch {}
  return null;
}

function saveCachedStatsEntry(stats: MulteiStats) {
  const payload = {
    stats,
    fetchedAt: Date.now()
  };
  inMemoryLiveStatsEntry = payload;
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STATS_SESSION_STORAGE_KEY, JSON.stringify(payload));
  } catch {}
  try {
    localStorage.setItem(STATS_CACHE_STORAGE_KEY, JSON.stringify(payload));
  } catch {}
}

function adjustCachedStats(deltas: {
  totalGeralDelta: number;
  infracoesTransitoDelta: number;
  mobilidadeUrbanaDelta: number;
  resolvidosDelta: number;
}) {
  const cached = loadCachedStatsEntry();
  if (!cached) return;
  const s = cached.stats;
  const infracoesTransito = Math.max(0, Number(s.infracoesTransito || 0) + deltas.infracoesTransitoDelta);
  const mobilidadeUrbana = Math.max(0, Number(s.mobilidadeUrbana || 0) + deltas.mobilidadeUrbanaDelta);
  const resolvidos = Math.max(0, Number(s.resolvidos || 0) + deltas.resolvidosDelta);
  const totalGeral = Math.max(infracoesTransito + mobilidadeUrbana, Number(s.totalGeral || 0) + deltas.totalGeralDelta);
  saveCachedStatsEntry({
    totalGeral,
    infracoesTransito,
    mobilidadeUrbana,
    resolvidos,
    updatedAt: new Date().toISOString()
  });
}

/**
 * Recalcula as métricas a partir das coleções `ocorrencias` e `resolvidos`
 * e grava o documento único `estatisticas/resumo`.
 */
export async function recalculateAndSyncMulteiStats(forceRefresh = false): Promise<MulteiStats> {
  if (!forceRefresh) {
    const cached = loadCachedStatsEntry();
    if (cached && Date.now() - cached.fetchedAt < STATS_CACHE_TTL_MS) {
      return cached.stats;
    }
  }

  const { db } = getFirebaseServices();
  const [ocorrenciasSnap, resolvidosSnap] = await Promise.all([
    getDocs(collection(db, OCORRENCIAS_COLLECTION)),
    getDocs(collection(db, RESOLVIDOS_COLLECTION))
  ]);

  let infracoesTransito = 0;
  let mobilidadeUrbana = 0;

  ocorrenciasSnap.forEach((docSnap) => {
    const d = docSnap.data() || {};
    const isAtivo =
      d.ativo !== undefined && d.ativo !== ''
        ? d.ativo === true || String(d.ativo).toLowerCase() === 'true'
        : true;
    if (!isAtivo) return;

    const isPossivelDuplicidade = Boolean(
      d.possivel_duplicidade === true ||
        String(d.possivel_duplicidade).toLowerCase() === 'true'
    );
    if (isPossivelDuplicidade) return;

    if (d.natureza === 'urbana') {
      mobilidadeUrbana++;
    } else {
      infracoesTransito++;
    }
  });

  const resolvidos = resolvidosSnap.size;
  const totalGeral = infracoesTransito + mobilidadeUrbana;
  const updatedAt = new Date().toISOString();

  const stats: MulteiStats = {
    totalGeral,
    infracoesTransito,
    mobilidadeUrbana,
    resolvidos,
    updatedAt
  };

  saveCachedStatsEntry(stats);

  try {
    const statsRef = doc(db, ESTATISTICAS_COLLECTION, ESTATISTICAS_DOC_ID);
    await setDoc(statsRef, stats, { merge: true });
  } catch (err) {
    console.warn('[firebaseService] Aviso ao gravar estatisticas/resumo inicial:', err);
  }

  return stats;
}

/**
 * Realiza UMA ÚNICA busca no Firebase na sessão da aba e reutiliza `sessionStorage` + memória
 * ao navegar entre páginas (`/` <-> `/multei/sobre`), mantendo os valores vivos via SSE (`+1` / `-1`).
 */
export async function fetchMulteiStatsOnce(
  onCached?: (stats: MulteiStats) => void,
  options?: { forceRefresh?: boolean }
): Promise<MulteiStats> {
  if (!options?.forceRefresh) {
    const sessionEntry = loadSessionStatsEntry();
    if (sessionEntry?.stats) {
      if (onCached) {
        onCached(sessionEntry.stats);
      }
      return sessionEntry.stats;
    }
  }

  const cachedEntry = loadCachedStatsEntry();
  if (cachedEntry?.stats && onCached) {
    onCached(cachedEntry.stats);
  }

  if (!options?.forceRefresh && inFlightStatsPromise) {
    return await inFlightStatsPromise;
  }

  const fetchPromise = (async (): Promise<MulteiStats> => {
    try {
      const { db } = getFirebaseServices();
      const statsRef = doc(db, ESTATISTICAS_COLLECTION, ESTATISTICAS_DOC_ID);
      const snap = await getDoc(statsRef);

      if (snap.exists()) {
        const d = snap.data() || {};
        if (typeof d.totalGeral === 'number') {
          const infracoesTransito = Math.max(0, Number(d.infracoesTransito || 0));
          const mobilidadeUrbana = Math.max(0, Number(d.mobilidadeUrbana || 0));
          const resolvidos = Math.max(0, Number(d.resolvidos || 0));
          const totalGeral = Math.max(
            infracoesTransito + mobilidadeUrbana,
            Number(d.totalGeral || 0)
          );
          const nextStats: MulteiStats = {
            totalGeral,
            infracoesTransito,
            mobilidadeUrbana,
            resolvidos,
            updatedAt: d.updatedAt ? String(d.updatedAt) : undefined
          };
          saveCachedStatsEntry(nextStats);
          return nextStats;
        }
      }

      return await recalculateAndSyncMulteiStats(true);
    } catch (err) {
      console.warn('[firebaseService] Aviso ao buscar estatísticas únicas no Firebase:', err);
      if (cachedEntry?.stats) {
        return cachedEntry.stats;
      }
      throw err;
    }
  })();

  inFlightStatsPromise = fetchPromise;
  try {
    return await fetchPromise;
  } finally {
    inFlightStatsPromise = null;
  }
}

/**
 * Conecta ao canal de eventos em tempo real gerenciado pelo backend do Nuxt (`/api/multei/live`)
 * via Server-Sent Events (SSE) + fallback de polling leve + BroadcastChannel entre abas,
 * aplicando incrementos (+1 / -1) na tela sem novas consultas ao Firebase.
 */
export function subscribeToMulteiLiveEvents(
  onDelta: (evt: MulteiLiveDeltaEvent) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const seenEventIds = new Set<number>();
  let lastSeenId = 0;
  let eventSource: EventSource | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let broadcastChannel: BroadcastChannel | null = null;
  let isClosed = false;

  const processIncomingEvent = (raw: unknown) => {
    if (isClosed || !raw || typeof raw !== 'object') return;
    const evt = raw as Partial<MulteiLiveDeltaEvent>;
    const id = Number(evt.id);
    const delta = evt.delta === -1 ? -1 : evt.delta === 1 ? 1 : null;
    const category = evt.category;

    if (
      !Number.isFinite(id) ||
      !delta ||
      (category !== 'infracoesTransito' &&
        category !== 'mobilidadeUrbana' &&
        category !== 'resolvidos' &&
        category !== 'reportadas' &&
        category !== 'denunciasPainel')
    ) {
      return;
    }

    if (seenEventIds.has(id)) return;
    seenEventIds.add(id);
    if (id > lastSeenId) {
      lastSeenId = id;
    }

    if (
      category === 'infracoesTransito' ||
      category === 'mobilidadeUrbana' ||
      category === 'resolvidos'
    ) {
      adjustCachedStats({
        totalGeralDelta: category === 'resolvidos' ? 0 : delta,
        infracoesTransitoDelta: category === 'infracoesTransito' ? delta : 0,
        mobilidadeUrbanaDelta: category === 'mobilidadeUrbana' ? delta : 0,
        resolvidosDelta: category === 'resolvidos' ? delta : 0
      });
    }

    onDelta({
      id,
      category,
      delta,
      timestamp: Number(evt.timestamp) || Date.now(),
      ...(evt.cidade ? { cidade: String(evt.cidade) } : {}),
      ...(evt.estado ? { estado: String(evt.estado) } : {}),
      ...(evt.bairro ? { bairro: String(evt.bairro) } : {}),
      ...(evt.rua ? { rua: String(evt.rua) } : {}),
      ...(evt.natureza ? { natureza: String(evt.natureza) } : {}),
      ...(evt.ocorrenciaId ? { ocorrenciaId: String(evt.ocorrenciaId) } : {}),
      ...(evt.action ? { action: evt.action } : {})
    });
  };

  // 1. Conexão SSE com o backend do Nuxt
  if ('EventSource' in window) {
    try {
      eventSource = new EventSource('/api/multei/live');

      eventSource.addEventListener('connected', (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          if (typeof parsed?.latestId === 'number' && parsed.latestId > lastSeenId) {
            lastSeenId = parsed.latestId;
          }
        } catch {}
      });

      eventSource.addEventListener('multei-delta', (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          processIncomingEvent(parsed);
        } catch {}
      });
    } catch {}
  }

  // 2. Fallback de reconciliação leve no backend Nuxt (caso o container Serverless reconecte o stream SSE)
  pollTimer = setInterval(async () => {
    if (isClosed) return;
    try {
      const url = `/api/multei/live?mode=poll&since=${encodeURIComponent(lastSeenId)}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (lastSeenId === 0 && typeof data?.latestId === 'number') {
        lastSeenId = data.latestId;
        return;
      }
      if (Array.isArray(data?.events)) {
        for (const item of data.events) {
          processIncomingEvent(item);
        }
      }
      if (typeof data?.latestId === 'number' && data.latestId > lastSeenId) {
        lastSeenId = data.latestId;
      }
    } catch {}
  }, 8_000);

  // 3. Sincronização instantânea entre abas do mesmo navegador
  if ('BroadcastChannel' in window) {
    try {
      broadcastChannel = new BroadcastChannel(LIVE_BROADCAST_CHANNEL_NAME);
      broadcastChannel.onmessage = (e: MessageEvent) => {
        processIncomingEvent(e.data);
      };
    } catch {}
  }

  return () => {
    isClosed = true;
    if (eventSource) {
      try {
        eventSource.close();
      } catch {}
      eventSource = null;
    }
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (broadcastChannel) {
      try {
        broadcastChannel.close();
      } catch {}
      broadcastChannel = null;
    }
  };
}

/**
 * Mantido por compatibilidade: busca inicialmente do Firebase uma única vez
 * e assina o canal de eventos em tempo real do backend Nuxt.
 */
export function subscribeToMulteiStats(
  onUpdate: (stats: MulteiStats) => void,
  onError?: (err: unknown) => void
): () => void {
  let currentStats: MulteiStats = {
    totalGeral: 0,
    infracoesTransito: 0,
    mobilidadeUrbana: 0,
    resolvidos: 0
  };

  fetchMulteiStatsOnce((cached) => {
    currentStats = { ...cached };
    onUpdate(currentStats);
  })
    .then((fresh) => {
      currentStats = { ...fresh };
      onUpdate(currentStats);
    })
    .catch((err) => {
      if (onError) onError(err);
    });

  const unsubscribeLive = subscribeToMulteiLiveEvents((evt) => {
    if (evt.category === 'infracoesTransito') {
      currentStats.infracoesTransito = Math.max(0, currentStats.infracoesTransito + evt.delta);
      currentStats.totalGeral = Math.max(
        currentStats.infracoesTransito + currentStats.mobilidadeUrbana,
        currentStats.totalGeral + evt.delta
      );
    } else if (evt.category === 'mobilidadeUrbana') {
      currentStats.mobilidadeUrbana = Math.max(0, currentStats.mobilidadeUrbana + evt.delta);
      currentStats.totalGeral = Math.max(
        currentStats.infracoesTransito + currentStats.mobilidadeUrbana,
        currentStats.totalGeral + evt.delta
      );
    } else if (evt.category === 'resolvidos') {
      currentStats.resolvidos = Math.max(0, currentStats.resolvidos + evt.delta);
    }
    currentStats.updatedAt = new Date(evt.timestamp).toISOString();
    onUpdate({ ...currentStats });
  });

  return unsubscribeLive;
}

function loadIncidentsFromLocalCache(): ReportedIncident[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('multei_cached_incidents');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return [];
}

function saveIncidentToLocalCache(inc: ReportedIncident) {
  if (typeof window === 'undefined') return;
  try {
    const list = loadIncidentsFromLocalCache().filter((item) => item.id !== inc.id);
    list.unshift(inc);
    localStorage.setItem('multei_cached_incidents', JSON.stringify(list));
  } catch {}

  try {
    const entries = loadRegionCacheEntries().map((entry) => {
      const distKm = distanceBetween([entry.centerLat, entry.centerLng], [inc.latitude, inc.longitude]);
      if (distKm * 1000 <= entry.radiusMeters) {
        const filtered = (entry.incidents || []).filter((item) => item.id !== inc.id);
        return {
          ...entry,
          incidents: [inc, ...filtered]
        };
      }
      return entry;
    });
    saveRegionCacheEntries(entries);
  } catch {}

  if (!inc.possivel_duplicidade) {
    const isUrbana = inc.natureza === 'urbana';
    adjustCachedStats({
      totalGeralDelta: 1,
      infracoesTransitoDelta: isUrbana ? 0 : 1,
      mobilidadeUrbanaDelta: isUrbana ? 1 : 0,
      resolvidosDelta: 0
    });
  }
}

function removeIncidentFromLocalCache(id: string) {
  if (typeof window === 'undefined') return;
  try {
    const cached = loadIncidentsFromLocalCache();
    const updated = cached.filter((inc) => inc.id !== id);
    localStorage.setItem('multei_cached_incidents', JSON.stringify(updated));
  } catch {}

  try {
    const entries = loadRegionCacheEntries().map((entry) => ({
      ...entry,
      incidents: (entry.incidents || []).filter((inc) => inc.id !== id)
    }));
    saveRegionCacheEntries(entries);
  } catch {}
}

function markIncidentResolvedInLocalCache(ocorrenciaId: string) {
  if (typeof window === 'undefined') return;
  try {
    const cached = loadIncidentsFromLocalCache();
    const updated = cached.map((item) =>
      item.id === ocorrenciaId
        ? {
            ...item,
            resolvido_em_validacao: true,
            status_resolucao: 'em_validacao'
          }
        : item
    );
    localStorage.setItem('multei_cached_incidents', JSON.stringify(updated));
  } catch {}

  try {
    const entries = loadRegionCacheEntries().map((entry) => ({
      ...entry,
      incidents: (entry.incidents || []).map((item) =>
        item.id === ocorrenciaId
          ? {
              ...item,
              resolvido_em_validacao: true,
              status_resolucao: 'em_validacao'
            }
          : item
      )
    }));
    saveRegionCacheEntries(entries);
  } catch {}
}

const IMAGE_CACHE_NAME = 'multei-images-cache-v1';
const inMemoryImageBlobUrls = new Map<string, string>();

/**
 * Pré-armazena no cache local (memória + CacheStorage do navegador) a imagem recém-enviada,
 * evitando novo download ao visualizar a própria ocorrência.
 */
export async function seedIncidentImageCache(
  url: string,
  bytes: Uint8Array,
  contentType = 'image/webp'
): Promise<void> {
  if (!url || typeof window === 'undefined') return;
  try {
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: contentType });
    if (!inMemoryImageBlobUrls.has(url)) {
      inMemoryImageBlobUrls.set(url, URL.createObjectURL(blob));
    }
    if ('caches' in window) {
      const cache = await window.caches.open(IMAGE_CACHE_NAME);
      const response = new Response(blob, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      });
      await cache.put(url, response);
    }
  } catch {}
}

/**
 * Retorna a URL da imagem a partir do cache permanente do cliente (memória ou CacheStorage),
 * garantindo que uma foto já baixada nunca precise ser baixada novamente do Firebase Storage.
 */
export async function getCachedIncidentImageUrl(url: string): Promise<string> {
  if (!url || typeof window === 'undefined') return url;
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;

  const existingMemoryUrl = inMemoryImageBlobUrls.get(url);
  if (existingMemoryUrl) {
    return existingMemoryUrl;
  }

  if ('caches' in window) {
    try {
      const cache = await window.caches.open(IMAGE_CACHE_NAME);
      const cachedResponse = await cache.match(url, { ignoreVary: true });
      if (cachedResponse) {
        if (cachedResponse.ok && cachedResponse.type !== 'opaque') {
          const blob = await cachedResponse.blob();
          if (blob.size > 0) {
            const objUrl = URL.createObjectURL(blob);
            inMemoryImageBlobUrls.set(url, objUrl);
            return objUrl;
          }
        }
        // Se for resposta opaque salva pelo Service Worker (sw-image-cache.js),
        // o próprio Service Worker entregará do disco sem chamar a rede.
        return url;
      }

      // Se ainda não estiver no CacheStorage, tenta buscar via fetch com cache forçado e salvar no CacheStorage
      const netResponse = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'force-cache' });
      if (netResponse.ok) {
        try {
          await cache.put(url, netResponse.clone());
        } catch {}
        const blob = await netResponse.blob();
        if (blob.size > 0) {
          const objUrl = URL.createObjectURL(blob);
          inMemoryImageBlobUrls.set(url, objUrl);
          return objUrl;
        }
      }
    } catch {
      // Caso o bucket não tenha cabeçalho CORS para fetch JS, o Service Worker (sw-image-cache.js)
      // intercepta a tag <img> diretamente e faz o cache em CacheStorage no modo no-cors.
    }
  }

  return url;
}

/**
 * Resolve o perfil do usuário autenticado na coleção `usuarios` do Firestore (`admin` ou `parceiro`).
 * Caso a coleção `usuarios` ainda esteja vazia no primeiro acesso, registra o primeiro usuário autenticado como `admin`.
 */
export async function resolveMulteiPanelUserProfile(user: User): Promise<MulteiPanelUserProfile> {
  const { db, auth } = getFirebaseServices();
  const email = (user.email || '').trim().toLowerCase();
  const authDisplayName = (user.displayName || '').trim();

  const normalizeDocFields = (rawDoc: Record<string, any>): Record<string, any> => {
    const out: Record<string, any> = { ...rawDoc };
    for (const [k, v] of Object.entries(rawDoc || {})) {
      out[k.trim().toLowerCase()] = v;
    }
    return out;
  };

  const hasNameInDoc = (rawDoc: Record<string, any>): boolean => {
    const d = normalizeDocFields(rawDoc);
    return Boolean(
      String(d.nome ?? d.name ?? d.primeiro_nome ?? d.sobrenome ?? d.lastname ?? '').trim()
    );
  };

  const isDocActive = (rawDoc: Record<string, any>): boolean => {
    const d = normalizeDocFields(rawDoc);
    if (d.ativo === false || String(d.ativo).trim().toLowerCase() === 'false') {
      return false;
    }
    return true;
  };

  const buildProfileFromDoc = (rawDoc: Record<string, any>): MulteiPanelUserProfile => {
    const d = normalizeDocFields(rawDoc);
    const rawRole = String(d.role || d.tipo || d.cargo || d.perfil || 'admin').trim().toLowerCase();
    const role: MulteiUserRole =
      rawRole === 'parceria' || rawRole === 'parceiro' ? 'parceria' : 'admin';
    const nome = String(d.nome ?? d.name ?? d.primeiro_nome ?? '').trim() || undefined;
    const sobrenome = String(d.sobrenome ?? d.lastname ?? d.ultimo_nome ?? '').trim() || undefined;
    const joinedName = [nome, sobrenome].filter(Boolean).join(' ').trim();
    const nomeCompleto = joinedName || authDisplayName || undefined;
    const ativo = isDocActive(rawDoc);

    return {
      uid: user.uid,
      email: d.email ? String(d.email).trim() : email,
      nome: nome || nomeCompleto,
      sobrenome,
      nomeCompleto,
      role,
      cidade: d.cidade ? String(d.cidade).trim() : undefined,
      estado: d.estado ? String(d.estado).trim() : undefined,
      ativo
    };
  };

  const fetchCollectionDocsFresh = async (colName: string) => {
    const colRef = collection(db, colName);
    try {
      return await getDocsFromServer(colRef);
    } catch {
      return await getDocs(colRef);
    }
  };

  const candidateCollections = [USUARIOS_COLLECTION, 'usarios', 'usuários'];
  let fallbackDocData: Record<string, any> | null = null;

  for (const colName of candidateCollections) {
    try {
      const snap = await fetchCollectionDocsFresh(colName);
      if (snap.empty) continue;

      // 1. Procura documento correspondente ao usuário autenticado (por uid ou email)
      for (const docSnap of snap.docs) {
        const raw = docSnap.data() || {};
        const d = normalizeDocFields(raw);
        const docEmail = String(d.email || d['e-mail'] || '').trim().toLowerCase();
        const docUid = String(d.uid || d.id || '').trim();
        const isMatch =
          docSnap.id === user.uid ||
          (email && docSnap.id.toLowerCase() === email) ||
          (email && docEmail === email) ||
          (docUid && docUid === user.uid);

        if (isMatch) {
          if (!isDocActive(raw)) {
            await signOut(auth);
            const disabledErr: any = new Error('Sua conta está desativada no painel. Entre em contato com o administrador.');
            disabledErr.code = 'auth/user-disabled';
            throw disabledErr;
          }
          if (hasNameInDoc(raw)) {
            return buildProfileFromDoc(raw);
          }
          if (!fallbackDocData) {
            fallbackDocData = raw;
          }
        }
      }

      if (fallbackDocData) {
        break;
      }

      // 2. Fallback legado: caso exista apenas 1 documento na coleção sem vínculo de email/uid
      if (snap.docs.length === 1) {
        const onlyRaw = snap.docs[0].data() || {};
        const onlyNorm = normalizeDocFields(onlyRaw);
        const onlyEmail = String(onlyNorm.email || onlyNorm['e-mail'] || '').trim();
        const onlyUid = String(onlyNorm.uid || '').trim();
        if (!onlyEmail && !onlyUid) {
          fallbackDocData = onlyRaw;
        }
      }
    } catch (err: any) {
      if (err?.code === 'auth/user-disabled') {
        throw err;
      }
      console.warn(`[firebaseService] Aviso ao ler coleção '${colName}':`, err);
    }
  }

  if (fallbackDocData) {
    return buildProfileFromDoc(fallbackDocData);
  }

  return {
    uid: user.uid,
    email,
    nome: authDisplayName || undefined,
    nomeCompleto: authDisplayName || undefined,
    role: 'admin',
    ativo: true
  };
}

const PANEL_SESSION_STORAGE_KEY = 'multei_panel_session_meta_v1';
export const PANEL_SESSION_MAX_DURATION_MS = 24 * 60 * 60 * 1000; // 24 horas

interface PanelSessionMeta {
  uid: string;
  loginAt: number;
  expiresAt: number;
  profile?: MulteiPanelUserProfile;
}

let isSigningInPanel = false;

function savePanelSessionMeta(
  uid: string,
  loginAt = Date.now(),
  profile?: MulteiPanelUserProfile
): PanelSessionMeta {
  const existing = getRawValidPanelSessionMeta(uid);
  const effectiveLoginAt = existing && existing.uid === uid ? existing.loginAt : loginAt;
  const meta: PanelSessionMeta = {
    uid,
    loginAt: effectiveLoginAt,
    expiresAt: effectiveLoginAt + PANEL_SESSION_MAX_DURATION_MS,
    profile: profile || existing?.profile
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(PANEL_SESSION_STORAGE_KEY, JSON.stringify(meta));
    } catch {}
  }
  return meta;
}

function clearPanelSessionMeta(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PANEL_SESSION_STORAGE_KEY);
  } catch {}
}

function getRawValidPanelSessionMeta(expectedUid?: string): PanelSessionMeta | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(PANEL_SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PanelSessionMeta>;
    if (
      !parsed ||
      typeof parsed.uid !== 'string' ||
      !parsed.uid ||
      (expectedUid && parsed.uid !== expectedUid) ||
      typeof parsed.loginAt !== 'number' ||
      typeof parsed.expiresAt !== 'number' ||
      !Number.isFinite(parsed.loginAt) ||
      !Number.isFinite(parsed.expiresAt)
    ) {
      return null;
    }

    const now = Date.now();
    // Proteção contra adulteração: loginAt não pode estar no futuro e a janela não pode exceder 24h
    if (
      parsed.loginAt <= 0 ||
      parsed.loginAt > now + 60_000 ||
      parsed.expiresAt - parsed.loginAt > PANEL_SESSION_MAX_DURATION_MS ||
      now >= parsed.expiresAt
    ) {
      return null;
    }

    return {
      uid: parsed.uid,
      loginAt: parsed.loginAt,
      expiresAt: parsed.expiresAt,
      profile: parsed.profile
    };
  } catch {
    return null;
  }
}

function getValidPanelSessionMeta(user: User): PanelSessionMeta | null {
  if (typeof window === 'undefined' || !user?.uid) return null;
  const existing = getRawValidPanelSessionMeta(user.uid);
  if (existing) return existing;

  // Se o login acabou de acontecer (`isSigningInPanel`), registra imediatamente a janela de 24h
  if (isSigningInPanel) {
    return savePanelSessionMeta(user.uid, Date.now());
  }

  return null;
}

/**
 * Retorna o tempo restante (em ms) da sessão de 24h.
 * Comportamento Fail-Close: se não for possível ler ou validar a janela de 24 horas,
 * retorna `0` para encerrar a sessão e exigir novo login imediatamente.
 */
export function getPanelSessionRemainingMs(user?: User | null): number {
  if (!user) return 0;
  const meta = getValidPanelSessionMeta(user);
  if (!meta) return 0;
  const remaining = meta.expiresAt - Date.now();
  return remaining > 0 ? remaining : 0;
}

export async function refreshCurrentMulteiPanelProfile(): Promise<MulteiPanelUserProfile | null> {
  if (typeof window === 'undefined') return null;
  try {
    const { auth } = getFirebaseServices();
    if (!auth.currentUser) {
      const cachedMeta = getRawValidPanelSessionMeta();
      return cachedMeta?.profile || null;
    }
    if (getPanelSessionRemainingMs(auth.currentUser) <= 0) {
      clearPanelSessionMeta();
      await signOut(auth);
      return null;
    }
    const profile = await resolveMulteiPanelUserProfile(auth.currentUser);
    savePanelSessionMeta(auth.currentUser.uid, Date.now(), profile);
    return profile;
  } catch {
    return null;
  }
}

export async function signInMulteiPanel(
  email: string,
  password: string
): Promise<MulteiPanelUserProfile> {
  const { auth } = getFirebaseServices();
  const cleanEmail = (email || '').trim();
  if (!cleanEmail || !password) {
    throw new Error('Preencha o e-mail e a senha.');
  }

  isSigningInPanel = true;
  try {
    try {
      await setPersistence(auth, browserLocalPersistence);
    } catch {}
    clearPanelSessionMeta();
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
    const loginAt = Date.now();
    savePanelSessionMeta(cred.user.uid, loginAt);
    const profile = await resolveMulteiPanelUserProfile(cred.user);
    savePanelSessionMeta(cred.user.uid, loginAt, profile);
    return profile;
  } finally {
    isSigningInPanel = false;
  }
}

export async function signOutMulteiPanel(): Promise<void> {
  clearPanelSessionMeta();
  const { auth } = getFirebaseServices();
  await signOut(auth);
}

export function subscribeToMulteiPanelAuth(
  onChange: (profile: MulteiPanelUserProfile | null) => void,
  onSessionExpired?: () => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  try {
    const { auth } = getFirebaseServices();
    let expiryTimeout: ReturnType<typeof setTimeout> | null = null;
    let checkInterval: ReturnType<typeof setInterval> | null = null;

    const clearTimers = () => {
      if (expiryTimeout) {
        clearTimeout(expiryTimeout);
        expiryTimeout = null;
      }
      if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
      }
    };

    const expireSessionNow = async () => {
      clearTimers();
      clearPanelSessionMeta();
      try {
        await signOut(auth);
      } catch {}
      onSessionExpired?.();
      onChange(null);
    };

    const verifyActiveSession = () => {
      const current = auth.currentUser;
      if (!current) {
        const rawMeta = localStorage.getItem(PANEL_SESSION_STORAGE_KEY);
        if (rawMeta && !getRawValidPanelSessionMeta()) {
          void expireSessionNow();
        }
        return;
      }
      if (getPanelSessionRemainingMs(current) <= 0) {
        void expireSessionNow();
      }
    };

    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      verifyActiveSession();
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    // Restaura imediatamente a sessão válida (< 24h) ao navegar (Voltar/Avançar) enquanto o Firebase Auth inicializa
    const initialValidMeta = getRawValidPanelSessionMeta();
    if (initialValidMeta?.profile) {
      const initialRemaining = initialValidMeta.expiresAt - Date.now();
      if (initialRemaining > 0) {
        expiryTimeout = setTimeout(() => {
          void expireSessionNow();
        }, initialRemaining);
        checkInterval = setInterval(verifyActiveSession, 60_000);
        onChange(initialValidMeta.profile);
      }
    }

    const unsubscribeFirebase = onAuthStateChanged(auth, async (user) => {
      if (typeof (auth as any).authStateReady === 'function') {
        try {
          await (auth as any).authStateReady();
        } catch {}
      }

      clearTimers();
      if (!user) {
        // Se existe uma sessão válida de 24h recém-autenticada no localStorage, mantém até expirar ou logout explícito
        const validMeta = getRawValidPanelSessionMeta();
        if (validMeta?.profile) {
          const rem = validMeta.expiresAt - Date.now();
          if (rem > 0) {
            expiryTimeout = setTimeout(() => {
              void expireSessionNow();
            }, rem);
            checkInterval = setInterval(verifyActiveSession, 60_000);
            onChange(validMeta.profile);
            return;
          }
        }
        clearPanelSessionMeta();
        onChange(null);
        return;
      }

      // Caso o usuário já esteja autenticado no Firebase Auth mas a chave local ainda não exista, inicializa a janela de 24h
      if (!getRawValidPanelSessionMeta(user.uid)) {
        savePanelSessionMeta(user.uid, Date.now());
      }

      const remainingMs = getPanelSessionRemainingMs(user);
      if (remainingMs <= 0) {
        await expireSessionNow();
        return;
      }

      expiryTimeout = setTimeout(() => {
        void expireSessionNow();
      }, remainingMs);

      checkInterval = setInterval(verifyActiveSession, 60_000);

      try {
        const profile = await resolveMulteiPanelUserProfile(user);
        savePanelSessionMeta(user.uid, Date.now(), profile);
        onChange(profile);
      } catch {
        const cachedMeta = getRawValidPanelSessionMeta(user.uid);
        onChange(cachedMeta?.profile || null);
      }
    });

    return () => {
      clearTimers();
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      unsubscribeFirebase();
    };
  } catch {
    onChange(null);
    return () => {};
  }
}

/**
 * Lista todos os usuários cadastrados na coleção `usuarios` para a aba de Gestão de Usuários.
 */
export async function fetchPanelUsersFromFirebase(): Promise<MulteiPanelManagedUser[]> {
  const { db } = getFirebaseServices();
  const colRef = collection(db, USUARIOS_COLLECTION);
  let snap;
  try {
    snap = await getDocsFromServer(colRef);
  } catch {
    snap = await getDocs(colRef);
  }

  const normalizeDocFields = (rawDoc: Record<string, any>): Record<string, any> => {
    const out: Record<string, any> = { ...rawDoc };
    for (const [k, v] of Object.entries(rawDoc || {})) {
      out[k.trim().toLowerCase()] = v;
    }
    return out;
  };

  const users: MulteiPanelManagedUser[] = snap.docs.map((docSnap) => {
    const raw = docSnap.data() || {};
    const d = normalizeDocFields(raw);
    const rawRole = String(d.role || d.tipo || d.cargo || d.perfil || 'admin').trim().toLowerCase();
    const role: 'admin' | 'parceria' =
      rawRole === 'parceria' || rawRole === 'parceiro' ? 'parceria' : 'admin';
    const nome = String(d.nome ?? d.name ?? d.primeiro_nome ?? '').trim();
    const sobrenome = String(d.sobrenome ?? d.lastname ?? d.ultimo_nome ?? '').trim();
    const email = String(d.email ?? d['e-mail'] ?? '').trim().toLowerCase();
    const nomeCompleto = [nome, sobrenome].filter(Boolean).join(' ').trim() || nome || email || docSnap.id;
    const cidade = String(d.cidade ?? '').trim();
    const rawEstado = String(d.estado ?? '').trim();
    const estado = (normalizeState(rawEstado) || rawEstado).toUpperCase();
    const ativo = !(d.ativo === false || String(d.ativo).trim().toLowerCase() === 'false');

    return {
      id: docSnap.id,
      uid: String(d.uid || docSnap.id).trim(),
      role,
      nome,
      sobrenome,
      nomeCompleto,
      email,
      cidade,
      estado,
      ativo,
      createdAt: d.createdat || d.criado_em || undefined,
      updatedAt: d.updatedat || d.atualizado_em || undefined
    };
  });

  users.sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto, 'pt-BR'));
  return users;
}

export interface CreatePanelUserPayload {
  role: 'admin' | 'parceria';
  nome: string;
  sobrenome: string;
  email: string;
  senha: string;
  cidade: string;
  estado: string;
  ativo?: boolean;
}

export interface UpdatePanelUserPayload {
  role: 'admin' | 'parceria';
  nome: string;
  sobrenome: string;
  email: string;
  cidade: string;
  estado: string;
  ativo: boolean;
}

/**
 * Cria um novo usuário no Firebase Authentication usando uma instância secundária isolada
 * (para não desconectar o administrador logado) e grava os metadados na coleção `usuarios`
 * SEM salvar a senha no Firestore.
 */
export async function createPanelUserInFirebase(
  payload: CreatePanelUserPayload
): Promise<MulteiPanelManagedUser> {
  const { db } = getFirebaseServices();

  const cleanRole: 'admin' | 'parceria' = payload.role === 'parceria' ? 'parceria' : 'admin';
  const cleanNome = (payload.nome || '').trim();
  const cleanSobrenome = (payload.sobrenome || '').trim();
  const cleanEmail = (payload.email || '').trim().toLowerCase();
  const rawPassword = payload.senha || '';
  const cleanCidade = (payload.cidade || '').trim();
  const rawEstado = (payload.estado || '').trim();
  const cleanEstado = (normalizeState(rawEstado) || rawEstado).toUpperCase();
  const isAtivo = payload.ativo !== false;

  if (!cleanNome) {
    throw new Error('Informe o nome do usuário.');
  }
  if (!cleanSobrenome) {
    throw new Error('Informe o sobrenome do usuário.');
  }
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Informe um endereço de e-mail válido.');
  }
  if (!rawPassword || rawPassword.length < 6) {
    throw new Error('A senha deve ter pelo menos 6 caracteres.');
  }
  if (!cleanCidade) {
    throw new Error('Informe a cidade do usuário.');
  }
  if (!cleanEstado || cleanEstado.length !== 2) {
    throw new Error('Informe a UF (estado com 2 letras, ex: SP).');
  }

  // Usa um App Firebase secundário com persistência em memória para criar o usuário no Firebase Auth
  // sem alterar a sessão do administrador autenticado no app principal.
  const primaryApp = getApp();
  const secondaryAppName = 'MulteiAdminUserCreator';
  const existingSecondary = getApps().find((a) => a.name === secondaryAppName);
  const secondaryApp = existingSecondary || initializeApp(primaryApp.options, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);

  await setPersistence(secondaryAuth, inMemoryPersistence);

  const userCredential = await createUserWithEmailAndPassword(
    secondaryAuth,
    cleanEmail,
    rawPassword
  );
  const createdUid = userCredential.user.uid;
  const displayName = `${cleanNome} ${cleanSobrenome}`.trim();

  try {
    await updateProfile(userCredential.user, { displayName });
  } catch {
    // Falha não-crítica ao atualizar displayName no Auth
  }

  await signOut(secondaryAuth);

  const nowIso = new Date().toISOString();
  // IMPORTANTE: A senha NUNCA é salva no documento do Firestore.
  const firestoreDocData = {
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

  await setDoc(doc(db, USUARIOS_COLLECTION, createdUid), firestoreDocData, { merge: true });

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

/**
 * Atualiza os dados cadastrais de um usuário na coleção `usuarios` (sem armazenar senha).
 */
export async function updatePanelUserInFirebase(
  docId: string,
  payload: UpdatePanelUserPayload
): Promise<void> {
  const { db } = getFirebaseServices();
  if (!docId) {
    throw new Error('ID do usuário inválido.');
  }

  const cleanRole: 'admin' | 'parceria' = payload.role === 'parceria' ? 'parceria' : 'admin';
  const cleanNome = (payload.nome || '').trim();
  const cleanSobrenome = (payload.sobrenome || '').trim();
  const cleanEmail = (payload.email || '').trim().toLowerCase();
  const cleanCidade = (payload.cidade || '').trim();
  const rawEstado = (payload.estado || '').trim();
  const cleanEstado = (normalizeState(rawEstado) || rawEstado).toUpperCase();

  if (!cleanNome) {
    throw new Error('Informe o nome do usuário.');
  }
  if (!cleanSobrenome) {
    throw new Error('Informe o sobrenome do usuário.');
  }
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Informe um endereço de e-mail válido.');
  }
  if (!cleanCidade) {
    throw new Error('Informe a cidade do usuário.');
  }
  if (!cleanEstado || cleanEstado.length !== 2) {
    throw new Error('Informe a UF (estado com 2 letras, ex: SP).');
  }

  const nowIso = new Date().toISOString();
  await setDoc(
    doc(db, USUARIOS_COLLECTION, docId),
    {
      role: cleanRole,
      nome: cleanNome,
      sobrenome: cleanSobrenome,
      email: cleanEmail,
      cidade: cleanCidade,
      estado: cleanEstado,
      ativo: Boolean(payload.ativo),
      updatedAt: nowIso
    },
    { merge: true }
  );
}

/**
 * Ativa ou desativa um usuário na coleção `usuarios`.
 */
export async function togglePanelUserActiveInFirebase(
  docId: string,
  ativo: boolean
): Promise<void> {
  const { db } = getFirebaseServices();
  if (!docId) {
    throw new Error('ID do usuário inválido.');
  }
  await setDoc(
    doc(db, USUARIOS_COLLECTION, docId),
    {
      ativo: Boolean(ativo),
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
}

/**
 * Exclui o registro do usuário na coleção `usuarios`.
 */
export async function deletePanelUserFromFirebase(docId: string): Promise<void> {
  const { db } = getFirebaseServices();
  if (!docId) {
    throw new Error('ID do usuário inválido.');
  }
  await deleteDoc(doc(db, USUARIOS_COLLECTION, docId));
}

/**
 * Envia e-mail oficial do Firebase Authentication para redefinição de senha do usuário.
 */
export async function sendPanelUserPasswordReset(email: string): Promise<void> {
  const { auth } = getFirebaseServices();
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error('E-mail inválido para redefinição de senha.');
  }
  await sendPasswordResetEmail(auth, cleanEmail);
}

/**
 * Busca todas as ocorrências reportadas na coleção `reportadas` (e sincroniza eventuais
 * ocorrências com `possivel_duplicidade: true` da coleção `ocorrencias`), consolidando múltiplos reports
 * da mesma `ocorrenciaId` para exibir o histórico completo, selo de 2ª/3ª vez reportada e opções de duplicidade.
 */
export async function fetchReportedIncidentsForPanel(): Promise<ReportedIncidentPanelItem[]> {
  const { db } = getFirebaseServices();
  const reportadasCol = collection(db, REPORTADAS_COLLECTION);
  const dupQuery = query(
    collection(db, OCORRENCIAS_COLLECTION),
    where('possivel_duplicidade', '==', true)
  );
  const [snap, dupOcorrenciasSnap] = await Promise.all([
    getDocsFromServer(reportadasCol).catch(() => getDocs(reportadasCol)),
    getDocsFromServer(dupQuery)
      .catch(() => getDocs(dupQuery))
      .catch(() => null)
  ]);

  const groupedByOcorrencia = new Map<string, ReportedIncidentPanelItem>();

  const parseResultadoRevisao = (raw: unknown): ReportReviewDecision | '' => {
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
  };

  snap.forEach((docSnap) => {
    const d = docSnap.data() || {};
    const ocorrenciaId = String(d.ocorrenciaId || docSnap.id).trim();
    if (!ocorrenciaId) return;

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

    // Se a ocorrência teve a triagem automática marcada como "nao_duplicidade" e depois recebeu
    // uma nova solicitação de revisão da comunidade (2ª solicitação), limpa a pill de "nao_duplicidade"
    // e coloca a nova solicitação como pendente no fluxo principal.
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

    const existing = groupedByOcorrencia.get(ocorrenciaId);
    if (!existing) {
      const totalReports = Math.max(Number(d.total_reports || 1), rawHistory.length);
      groupedByOcorrencia.set(ocorrenciaId, {
        id: docSnap.id,
        ocorrenciaId,
        data: String(d.data || dataReport),
        data_report: dataReport,
        ultima_data_report: ultimaDataReport,
        latitude: Number(d.latitude ?? d.lat ?? 0),
        longitude: Number(d.longitude ?? d.lng ?? d.lon ?? 0),
        geohash: String(d.geohash || ''),
        fotoUrl: String(d.fotoUrl || d.foto || d.image || ''),
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
        legacyDocIds: [docSnap.id],
        possivel_duplicidade: isPossivelDuplicidade,
        origem_duplicidade: isOrigemDuplicidade,
        duplicidade_de_id: duplicidadeDeId,
        rotulo_duplicidade: rotuloDuplicidade
      });
    } else {
      // Mescla caso existam documentos antigos separados para a mesma ocorrenciaId
      const mergedHistory = [...existing.historico_reports];
      for (const h of rawHistory) {
        const isDup = mergedHistory.some(
          (item) => item.motivo === h.motivo && item.data === h.data
        );
        if (!isDup) {
          mergedHistory.push(h);
        }
      }
      mergedHistory.sort((a, b) => (new Date(a.data).getTime() || 0) - (new Date(b.data).getTime() || 0));

      const mergedTotal = Math.max(
        existing.total_reports,
        Number(d.total_reports || 1),
        mergedHistory.length
      );

      const isCanonicalId = docSnap.id === ocorrenciaId;
      existing.id = isCanonicalId ? docSnap.id : existing.id;
      existing.total_reports = mergedTotal;
      existing.outras_revisoes_solicitadas = mergedTotal > 1;
      existing.historico_reports = mergedHistory;
      if (!existing.descricao && d.descricao) {
        existing.descricao = String(d.descricao);
      }
      if ((!existing.natureza || existing.natureza === 'infracao_veicular') && d.natureza === 'urbana') {
        existing.natureza = 'urbana';
      }
      if (!existing.fotoUrl && (d.fotoUrl || d.foto || d.image)) {
        existing.fotoUrl = String(d.fotoUrl || d.foto || d.image);
      }
      if (!existing.rua && d.rua) existing.rua = String(d.rua);
      if (!existing.bairro && d.bairro) existing.bairro = String(d.bairro);
      if (!existing.cidade && d.cidade) existing.cidade = String(d.cidade);
      if (!existing.estado && d.estado) existing.estado = String(d.estado);
      if (isPossivelDuplicidade) {
        existing.possivel_duplicidade = true;
        existing.duplicidade_de_id = duplicidadeDeId || existing.duplicidade_de_id;
        existing.rotulo_duplicidade = rotuloDuplicidade || existing.rotulo_duplicidade || 'Possível duplicidade';
      }
      if (isOrigemDuplicidade) {
        existing.origem_duplicidade = true;
      }
      if (new Date(ultimaDataReport).getTime() > new Date(existing.ultima_data_report).getTime()) {
        existing.ultima_data_report = ultimaDataReport;
        existing.motivo_report = String(d.motivo_report || d.motivo_denuncia || existing.motivo_report);
        existing.motivo_denuncia = existing.motivo_report;
      }
      if (isRevisada) {
        existing.revisada = true;
        existing.resultado_revisao = resultadoRevisao || existing.resultado_revisao;
        existing.data_revisao = d.data_revisao ? String(d.data_revisao) : existing.data_revisao;
        existing.revisado_por = d.revisado_por ? String(d.revisado_por) : existing.revisado_por;
        existing.observacao_admin = d.observacao_admin
          ? String(d.observacao_admin)
          : existing.observacao_admin;
      }
      existing.legacyDocIds = Array.from(new Set([...(existing.legacyDocIds || []), docSnap.id]));
    }
  });

  // Garante que qualquer ocorrência com `possivel_duplicidade: true` em `ocorrencias` apareça em `reportadas`
  if (dupOcorrenciasSnap && !dupOcorrenciasSnap.empty) {
    dupOcorrenciasSnap.forEach((docSnap) => {
      const ocorrenciaId = docSnap.id;
      if (groupedByOcorrencia.has(ocorrenciaId)) return;
      const d = docSnap.data() || {};
      const dataIso = String(d.data || new Date().toISOString());
      const defaultReason =
        'Possível duplicidade detectada pelo sistema (registro nos últimos 2 min num raio de 10m com o mesmo veículo sob outro ângulo).';
      const isRevisada = Boolean(d.revisada_admin === true);
      const resultadoRevisao = parseResultadoRevisao(d.resultado_revisao);
      const isAtivo =
        d.ativo !== undefined && d.ativo !== ''
          ? d.ativo === true || String(d.ativo).toLowerCase() === 'true'
          : true;

      groupedByOcorrencia.set(ocorrenciaId, {
        id: ocorrenciaId,
        ocorrenciaId,
        data: dataIso,
        data_report: dataIso,
        ultima_data_report: dataIso,
        latitude: Number(d.latitude ?? d.lat ?? 0),
        longitude: Number(d.longitude ?? d.lng ?? d.lon ?? 0),
        geohash: String(d.geohash || ''),
        fotoUrl: String(d.fotoUrl || d.foto || d.image || ''),
        natureza: String(d.natureza || 'infracao_veicular'),
        descricao: String(d.descricao || ''),
        rua: String(d.rua || ''),
        bairro: String(d.bairro || ''),
        cidade: String(d.cidade || ''),
        estado: String(d.estado || ''),
        classificacao: String(d.classificacao || ''),
        verificacao: normalizeVerificacao(d.verificacao ?? d.verification),
        ativo: isAtivo,
        motivo_denuncia: String(d.motivo_denuncia || defaultReason),
        motivo_report: String(d.motivo_denuncia || defaultReason),
        total_reports: 1,
        outras_revisoes_solicitadas: false,
        historico_reports: [
          {
            motivo: String(d.motivo_denuncia || defaultReason),
            data: dataIso
          }
        ],
        revisada: isRevisada,
        resultado_revisao: resultadoRevisao,
        data_revisao: d.data_revisao ? String(d.data_revisao) : undefined,
        legacyDocIds: [ocorrenciaId],
        possivel_duplicidade: true,
        origem_duplicidade: true,
        duplicidade_de_id: d.duplicidade_de_id ? String(d.duplicidade_de_id).trim() : '',
        rotulo_duplicidade: String(d.rotulo_duplicidade || 'Possível duplicidade').trim()
      });
    });
  }

  const list = Array.from(groupedByOcorrencia.values());

  // Busca a foto da ocorrência original (`duplicidade_de_id`) e hidrata `descricao` / dados da ocorrência original se ausentes
  await Promise.all(
    list.map(async (item) => {
      if (!item.descricao && item.ocorrenciaId) {
        try {
          const selfSnap = await getDoc(doc(db, OCORRENCIAS_COLLECTION, item.ocorrenciaId));
          if (selfSnap.exists()) {
            const selfData = selfSnap.data() || {};
            if (selfData.descricao) {
              item.descricao = String(selfData.descricao).trim();
            }
            if ((!item.natureza || item.natureza === 'infracao_veicular') && selfData.natureza === 'urbana') {
              item.natureza = 'urbana';
            }
          }
        } catch {}
      }

      if (!item.duplicidade_de_id) return;
      try {
        const origSnap = await getDoc(doc(db, OCORRENCIAS_COLLECTION, item.duplicidade_de_id));
        if (origSnap.exists()) {
          const origData = origSnap.data() || {};
          const origPhoto = String(origData.fotoUrl || origData.foto || origData.image || '').trim();
          if (origPhoto) {
            item.duplicidade_original_fotoUrl = origPhoto;
          }
        }
      } catch {}
    })
  );

  // Se houver documentos duplicados da mesma ocorrenciaId (ex: um ID legado aleatório + outro com ocorrenciaId),
  // consolida todos os dados em `item.id` e remove os documentos duplicados extras.
  await Promise.all(
    list.map(async (item) => {
      const extraDocIds = (item.legacyDocIds || []).filter((docId) => docId && docId !== item.id);
      if (extraDocIds.length === 0) return;
      try {
        const canonicalRef = doc(db, REPORTADAS_COLLECTION, item.id);
        const { legacyDocIds, duplicidade_original_fotoUrl, ...cleanItemData } = item;
        await setDoc(canonicalRef, cleanItemData, { merge: true });
        await Promise.all(
          extraDocIds.map((dupId) =>
            deleteDoc(doc(db, REPORTADAS_COLLECTION, dupId)).catch(() => {})
          )
        );
        item.legacyDocIds = [item.id];
      } catch {}
    })
  );

  list.sort((a, b) => {
    const timeA = new Date(a.ultima_data_report || a.data_report).getTime() || 0;
    const timeB = new Date(b.ultima_data_report || b.data_report).getTime() || 0;
    return timeB - timeA;
  });

  return list;
}

/**
 * Aplica a validação do administrador sobre uma ocorrência reportada ou com possível duplicidade:
 * - Para reports tradicionais (fluxo principal):
 *   - `decision === 'improcedente'`: A denúncia não procede (mantém/ativa a ocorrência no mapa).
 *   - `decision === 'procedente'`: A denúncia procede (inativa a ocorrência).
 *   - `decision === 'duplicidade'`: Marca a ocorrência como duplicada no report comum (inativa a ocorrência).
 * - Para averiguação de Possível Duplicidade (detectada automaticamente pelo sistema):
 *   - `decision === 'nao_duplicidade'`: Marca que NÃO é duplicidade (`possivel_duplicidade: false`, `ativo: true`), desagrupa os pins, passa ao fluxo principal e INCREMENTA (+1) a contagem de denúncias.
 *   - `decision === 'indefinido'`: Mantém ativa como possível duplicidade (`possivel_duplicidade: true`, `ativo: true`), SEM incrementar na contagem.
 *   - `decision === 'duplicidade'`: Confirma que É duplicidade e INATIVA a denúncia (`ativo: false`), sem incrementar na contagem.
 */
export async function reviewReportedIncidentInFirebase(params: {
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

  const { db } = getFirebaseServices();
  const ocorrenciaRef = doc(db, OCORRENCIAS_COLLECTION, ocorrenciaId);

  let wasActiveInOcorrencias = Boolean(item.ativo);
  let isUrbana = item.natureza === 'urbana';
  let wasPossivelDuplicidadeInOcorrencias = Boolean(item.possivel_duplicidade);

  try {
    const ocorrenciaSnap = await getDoc(ocorrenciaRef);
    if (ocorrenciaSnap.exists()) {
      const d = ocorrenciaSnap.data() || {};
      wasActiveInOcorrencias =
        d.ativo !== undefined && d.ativo !== ''
          ? d.ativo === true || String(d.ativo).toLowerCase() === 'true'
          : true;
      isUrbana = d.natureza === 'urbana';
      wasPossivelDuplicidadeInOcorrencias = Boolean(
        d.possivel_duplicidade === true ||
          String(d.possivel_duplicidade).toLowerCase() === 'true'
      );
    }
  } catch {}

  // Uma ocorrência só estava contabilizada nas estatísticas se estava ativa E não estava marcada como possível duplicidade
  const wasCountedInStats = wasActiveInOcorrencias && !wasPossivelDuplicidadeInOcorrencias;

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

  // 1. Atualiza o documento na coleção `ocorrencias`
  await setDoc(
    ocorrenciaRef,
    {
      ativo: targetAtivo,
      possivel_duplicidade: targetPossivelDuplicidade,
      rotulo_duplicidade: targetRotuloDuplicidade,
      origem_duplicidade: targetOrigemDuplicidade,
      ...(clearDuplicityLink ? { duplicidade_de_id: '' } : {}),
      revisada_admin: true,
      resultado_revisao: decision,
      data_revisao: nowIso,
      ...(targetAtivo ? { motivo_denuncia: '' } : {})
    },
    { merge: true }
  );

  // 2. Atualiza apenas o documento existente na coleção `reportadas` (sem criar segundo documento)
  const targetReportDocId = (item.id || ocorrenciaId).trim();
  const reportUpdatePayload = {
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

  await setDoc(doc(db, REPORTADAS_COLLECTION, targetReportDocId), reportUpdatePayload, {
    merge: true
  });

  // Caso existam documentos duplicados legados com outro ID para a mesma ocorrenciaId, remove as duplicatas
  const extraDocIds = (item.legacyDocIds || []).filter(
    (docId) => docId && docId !== targetReportDocId
  );
  if (extraDocIds.length > 0) {
    await Promise.all(
      extraDocIds.map((dupId) =>
        deleteDoc(doc(db, REPORTADAS_COLLECTION, dupId)).catch(() => {})
      )
    );
  }

  // 3. Atualiza cache local de ocorrências do mapa (desagrupando os pins se nao_duplicidade)
  if (!targetAtivo) {
    removeIncidentFromLocalCache(ocorrenciaId);
  } else if (typeof window !== 'undefined') {
    const patchCacheItem = (inc: ReportedIncident): ReportedIncident =>
      inc.id === ocorrenciaId
        ? {
            ...inc,
            ativo: true,
            possivel_duplicidade: targetPossivelDuplicidade,
            rotulo_duplicidade: targetRotuloDuplicidade,
            ...(clearDuplicityLink ? { duplicidade_de_id: '' } : {})
          }
        : inc;

    try {
      const cached = loadIncidentsFromLocalCache().map(patchCacheItem);
      localStorage.setItem('multei_cached_incidents', JSON.stringify(cached));
    } catch {}

    try {
      const entries = loadRegionCacheEntries().map((entry) => ({
        ...entry,
        incidents: (entry.incidents || []).map(patchCacheItem)
      }));
      saveRegionCacheEntries(entries);
    } catch {}
  }

  // 4. Ajusta as estatísticas e emite o evento ao vivo conforme a transição de contabilização
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
    // Ex: marcada como "Não é duplicidade" (ou improcedente em ocorrência comum que estava inativa) -> incrementa +1 na contagem
    adjustCachedStats({
      totalGeralDelta: 1,
      infracoesTransitoDelta: isUrbana ? 0 : 1,
      mobilidadeUrbanaDelta: isUrbana ? 1 : 0,
      resolvidosDelta: 0
    });
    void notifyMulteiLiveDelta(category, 1, reviewMeta);
    try {
      const statsRef = doc(db, ESTATISTICAS_COLLECTION, ESTATISTICAS_DOC_ID);
      await setDoc(
        statsRef,
        {
          totalGeral: increment(1),
          [category]: increment(1),
          updatedAt: nowIso
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('[firebaseService] Aviso ao incrementar estatísticas na revisão:', err);
    }
  } else if (wasCountedInStats && !shouldBeCountedInStats) {
    // Estava contabilizada e passou a não contabilizar (ex: procedente, duplicidade ou indefinido após nao_duplicidade) -> subtrai -1
    adjustCachedStats({
      totalGeralDelta: -1,
      infracoesTransitoDelta: isUrbana ? 0 : -1,
      mobilidadeUrbanaDelta: isUrbana ? -1 : 0,
      resolvidosDelta: 0
    });
    void notifyMulteiLiveDelta(category, -1, reviewMeta);
    try {
      const statsRef = doc(db, ESTATISTICAS_COLLECTION, ESTATISTICAS_DOC_ID);
      await setDoc(
        statsRef,
        {
          totalGeral: increment(-1),
          [category]: increment(-1),
          updatedAt: nowIso
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('[firebaseService] Aviso ao decrementar estatísticas na revisão:', err);
    }
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

/**
 * Lista as ocorrências ativas da coleção `ocorrencias` para a aba "Denúncias" (Parcerias / Admin):
 * - Filtra exclusivamente pela cidade cadastrada do usuário (`cidade`), caso definida.
 * - Se `center` for informado (modo "Ao meu redor"), busca ocorrências num raio de 5 km (padrão) do GPS da pessoa.
 */
export async function fetchPartnerIncidentsFromFirebase(options: {
  cidade?: string;
  estado?: string;
  center?: { latitude: number; longitude: number } | null;
  radiusKm?: number;
}): Promise<ReportedIncident[]> {
  const { db } = getFirebaseServices();
  const colRef = collection(db, OCORRENCIAS_COLLECTION);
  const targetCityKey = normalizeCityKey(options.cidade);
  const targetStateKey = normalizeState(options.estado || '').toUpperCase();
  const radiusMeters = (options.radiusKm ?? 5) * 1000;

  let docsList: Array<{ id: string; data: Record<string, any> }> = [];

  if (
    options.center &&
    Number.isFinite(options.center.latitude) &&
    Number.isFinite(options.center.longitude)
  ) {
    const queryBounds = geohashQueryBounds(
      [options.center.latitude, options.center.longitude],
      radiusMeters
    );
    const snapshots = await Promise.all(
      queryBounds.map(([startHash, endHash]) => {
        const q = query(colRef, orderBy('geohash'), startAt(startHash), endAt(endHash));
        return getDocsFromServer(q).catch(() => getDocs(q));
      })
    );
    const seen = new Set<string>();
    for (const snap of snapshots) {
      snap.forEach((docSnap) => {
        if (seen.has(docSnap.id)) return;
        seen.add(docSnap.id);
        docsList.push({ id: docSnap.id, data: docSnap.data() || {} });
      });
    }
  } else {
    let snap;
    try {
      snap = await getDocsFromServer(colRef);
    } catch {
      snap = await getDocs(colRef);
    }
    let realTransito = 0;
    let realUrbana = 0;
    let realResolvidos = 0;
    snap.forEach((docSnap) => {
      const d = docSnap.data() || {};
      docsList.push({ id: docSnap.id, data: d });

      const lat = Number(d.latitude ?? d.lat);
      const lng = Number(d.longitude ?? d.lng ?? d.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const isAtivo =
        d.ativo !== undefined && d.ativo !== ''
          ? d.ativo === true || String(d.ativo).toLowerCase() === 'true'
          : true;
      if (!isAtivo) return;

      const isPossivelDup = Boolean(
        d.possivel_duplicidade === true ||
          String(d.possivel_duplicidade).toLowerCase() === 'true'
      );
      if (isPossivelDup) return;

      if (d.natureza === 'urbana') {
        realUrbana++;
      } else {
        realTransito++;
      }

      const fotoRes = String(d.foto_resolucao || d.fotoResolucaoUrl || d.foto_resolvido || '').trim();
      const isRes = Boolean(
        d.resolvido === true ||
          String(d.resolvido).toLowerCase() === 'true' ||
          String(d.status_resolucao || '').toLowerCase() === 'resolvido' ||
          (fotoRes && String(d.status_resolucao || '').toLowerCase() !== 'em_validacao')
      );
      if (isRes) {
        realResolvidos++;
      }
    });

    // Sincroniza automaticamente `estatisticas/resumo` com a contagem real da coleção `ocorrencias`
    const realTotal = realTransito + realUrbana;
    const syncedStats: MulteiStats = {
      totalGeral: realTotal,
      infracoesTransito: realTransito,
      mobilidadeUrbana: realUrbana,
      resolvidos: realResolvidos,
      updatedAt: new Date().toISOString()
    };
    saveCachedStatsEntry(syncedStats);
    setDoc(doc(db, ESTATISTICAS_COLLECTION, ESTATISTICAS_DOC_ID), syncedStats, { merge: true }).catch(
      () => {}
    );
  }

  const results: ReportedIncident[] = [];

  for (const item of docsList) {
    const incident = mapDocToIncident(item.id, item.data);
    if (!incident) continue;
    if (incident.possivel_duplicidade) continue;

    if (targetCityKey) {
      const incCityKey = normalizeCityKey(incident.cidade);
      if (incCityKey !== targetCityKey) {
        continue;
      }
    }

    if (targetStateKey && incident.estado) {
      const incStateKey = normalizeState(incident.estado).toUpperCase();
      if (incStateKey && incStateKey !== targetStateKey) {
        continue;
      }
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
      if (distKm * 1000 > radiusMeters) {
        continue;
      }
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

export interface ResolveUrbanIncidentByPartnerPayload {
  ocorrenciaId: string;
  foto: string;
  descricao: string;
  resolvidoPor?: string;
  incident?: Partial<ReportedIncident>;
}

/**
 * Registra a resolução definitiva de um problema de acesso urbano (`natureza === 'urbana'`)
 * declarada por um Parceiro Municipal (ou Admin), fazendo upload da foto do "Depois" e
 * gravando diretamente no documento da coleção `ocorrencias` (`resolvido: true`, `foto_resolucao`, `descricao_resolucao`, `data_resolucao`).
 */
export async function resolveUrbanIncidentByPartnerInFirebase(
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
  if (descricaoResolucao.length < 10) {
    throw new Error('Informe uma descrição da correção com pelo menos 10 caracteres.');
  }

  if (!payload.foto) {
    throw new Error('Envie uma nova foto comprovando que o problema de acesso urbano foi corrigido.');
  }

  const { db, storage } = getFirebaseServices();
  const ocorrenciaRef = doc(db, OCORRENCIAS_COLLECTION, ocorrenciaId);

  let alreadyCountedInStats = false;
  let existingData: Record<string, any> = {};

  try {
    const snap = await getDoc(ocorrenciaRef);
    if (snap.exists()) {
      existingData = snap.data() || {};
      alreadyCountedInStats = Boolean(
        existingData.resolvido === true ||
          String(existingData.resolvido).toLowerCase() === 'true' ||
          existingData.resolvido_em_validacao === true ||
          String(existingData.resolvido_em_validacao).toLowerCase() === 'true' ||
          existingData.status_resolucao === 'resolvido' ||
          existingData.status_resolucao === 'em_validacao'
      );
    }
  } catch {}

  const { bytes, contentType } = base64ToUint8Array(payload.foto);
  let fotoResolucaoUrl = '';
  const storageSuffix = `${ocorrenciaId}_${Date.now()}`;

  try {
    const primaryRef = storageRef(storage, `ocorrencias/resolvido_${storageSuffix}.webp`);
    await uploadBytes(primaryRef, bytes, {
      contentType: contentType || 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable'
    });
    fotoResolucaoUrl = await getDownloadURL(primaryRef);
  } catch {
    const fallbackRef = storageRef(storage, `resolvidos/${storageSuffix}.webp`);
    await uploadBytes(fallbackRef, bytes, {
      contentType: contentType || 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable'
    });
    fotoResolucaoUrl = await getDownloadURL(fallbackRef);
  }

  await seedIncidentImageCache(fotoResolucaoUrl, bytes, contentType || 'image/webp');

  const dataResolucao = new Date().toISOString();
  const resolvidoPor = (payload.resolvidoPor || '').trim();

  // 1. Grava os dados de resolução diretamente no documento da coleção `ocorrencias`
  await setDoc(
    ocorrenciaRef,
    {
      resolvido: true,
      status_resolucao: 'resolvido',
      resolvido_em_validacao: false,
      foto_resolucao: fotoResolucaoUrl,
      descricao_resolucao: descricaoResolucao,
      data_resolucao: dataResolucao,
      ...(resolvidoPor ? { resolvido_por: resolvidoPor } : {})
    },
    { merge: true }
  );

  // 2. Mantém registro espelhado na coleção `resolvidos`
  try {
    const inc = payload.incident || {};
    await setDoc(
      doc(db, RESOLVIDOS_COLLECTION, ocorrenciaId),
      {
        id: ocorrenciaId,
        ocorrenciaId,
        data: dataResolucao,
        fotoUrl: fotoResolucaoUrl,
        descricao: descricaoResolucao,
        status: 'resolvido',
        natureza: 'urbana',
        latitude: Number(existingData.latitude ?? inc.latitude ?? 0),
        longitude: Number(existingData.longitude ?? inc.longitude ?? 0),
        rua: existingData.rua || inc.rua || '',
        bairro: existingData.bairro || inc.bairro || '',
        cidade: existingData.cidade || inc.cidade || '',
        estado: existingData.estado || inc.estado || '',
        ocorrenciaFotoUrl: existingData.fotoUrl || inc.fotoUrl || inc.maskedImageUrl || '',
        ocorrenciaDescricao: existingData.descricao || inc.descricao || '',
        resolvido_por: resolvidoPor
      },
      { merge: true }
    );
  } catch {}

  // 3. Caso ainda não tivesse incrementado o contador de `resolvidos`, incrementa +1
  const incMeta = payload.incident || {};
  const resolutionMeta: MulteiLiveEventMeta = {
    cidade: String(existingData.cidade || incMeta.cidade || ''),
    estado: String(existingData.estado || incMeta.estado || ''),
    bairro: String(existingData.bairro || incMeta.bairro || ''),
    rua: String(existingData.rua || incMeta.rua || ''),
    natureza: 'urbana',
    ocorrenciaId,
    action: 'nova_resolucao'
  };

  if (!alreadyCountedInStats) {
    adjustCachedStats({
      totalGeralDelta: 0,
      infracoesTransitoDelta: 0,
      mobilidadeUrbanaDelta: 0,
      resolvidosDelta: 1
    });
    void notifyMulteiLiveDelta('resolvidos', 1, resolutionMeta);
    try {
      const statsRef = doc(db, ESTATISTICAS_COLLECTION, ESTATISTICAS_DOC_ID);
      await setDoc(
        statsRef,
        {
          resolvidos: increment(1),
          updatedAt: dataResolucao
        },
        { merge: true }
      );
    } catch {}
  } else {
    void notifyMulteiLiveDelta('denunciasPainel', 1, resolutionMeta);
  }

  // 4. Atualiza os caches locais e regionais para que o mapa exiba imediatamente o pino verde com check e Antes/Depois
  if (typeof window !== 'undefined') {
    const applyPatch = (item: ReportedIncident): ReportedIncident =>
      item.id === ocorrenciaId
        ? {
            ...item,
            resolvido: true,
            status_resolucao: 'resolvido',
            resolvido_em_validacao: false,
            foto_resolucao: fotoResolucaoUrl,
            descricao_resolucao: descricaoResolucao,
            data_resolucao: dataResolucao,
            resolvido_por: resolvidoPor
          }
        : item;

    try {
      const cached = loadIncidentsFromLocalCache().map(applyPatch);
      localStorage.setItem('multei_cached_incidents', JSON.stringify(cached));
    } catch {}

    try {
      const entries = loadRegionCacheEntries().map((entry) => ({
        ...entry,
        incidents: (entry.incidents || []).map(applyPatch)
      }));
      saveRegionCacheEntries(entries);
    } catch {}
  }

  return {
    success: true,
    ocorrenciaId,
    fotoResolucaoUrl,
    dataResolucao,
    descricaoResolucao
  };
}


