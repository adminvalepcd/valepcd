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
  type FirebaseStorage
} from 'firebase/storage';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
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
import { getAddressDetailsFromCoords, extractCityAndStateFromText, normalizeState } from './geoService';

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
  resultado_revisao?: 'procedente' | 'improcedente' | '';
  data_revisao?: string;
  revisado_por?: string;
  observacao_admin?: string;
  legacyDocIds?: string[];
}

export type MulteiLiveCategory = 'infracoesTransito' | 'mobilidadeUrbana' | 'resolvidos';

export interface MulteiLiveDeltaEvent {
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
    resolvido_por: data.resolvido_por ? String(data.resolvido_por).trim() : ''
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

/**
 * Salva uma nova ocorrência no Firebase:
 * 1. Gera um ID único do Firestore para a coleção `ocorrencias`
 * 2. Faz upload da foto anonimizada para `/ocorrencias/{id}.webp` no Firebase Storage
 * 3. Obtém a `downloadURL`
 * 4. Grava o documento em `ocorrencias/{id}` com `geohash` e `natureza`
 * 5. Atualiza o documento agregador `estatisticas/resumo`
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
}> {
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
    } catch {}
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
  }

  // 3. Calcula o geohash das coordenadas
  const latitude = Number(incident.latitude);
  const longitude = Number(incident.longitude);
  const geohash = geohashForLocation([latitude, longitude]);
  const dataIso = incident.data || new Date().toISOString();

  const resolvedDescricao = (incident.descricao || '').trim().slice(0, 300);

  // 4. Monta e salva o documento na coleção "ocorrencias"
  const docData = {
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
    verificacao: resolvedVerificacao
  };

  await setDoc(newDocRef, docData);

  // 5. Atualiza contadores em `estatisticas/resumo` (Option B - 1 documento único) e emite +1 ao vivo no backend Nuxt
  if (docData.ativo) {
    const isUrbana = docData.natureza === 'urbana';
    void notifyMulteiLiveDelta(isUrbana ? 'mobilidadeUrbana' : 'infracoesTransito', 1);
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
    motivo_denuncia: docData.motivo_denuncia
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
    verificacao: resolvedVerificacao
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
    ativo: shouldStayActiveOnMap,
    motivo_denuncia: cleanReason,
    motivo_report: cleanReason,
    data_report: existingReportData.data_report || reportedAtIso,
    ultima_data_report: reportedAtIso,
    total_reports: totalReports,
    outras_revisoes_solicitadas: outrasRevisoesSolicitadas,
    historico_reports: previousHistory,
    revisada: existingReportData.revisada === true ? true : false,
    resultado_revisao: existingReportData.resultado_revisao || ''
  };

  await setDoc(targetReportDocRef, reportDocData, { merge: true });

  if (!shouldStayActiveOnMap) {
    removeIncidentFromLocalCache(cleanId);

    await updateDoc(docRef, {
      ativo: false,
      motivo_denuncia: cleanReason
    });

    if (wasActive) {
      adjustCachedStats({
        totalGeralDelta: -1,
        infracoesTransitoDelta: wasUrbana ? 0 : -1,
        mobilidadeUrbanaDelta: wasUrbana ? -1 : 0,
        resolvidosDelta: 0
      });
      void notifyMulteiLiveDelta(wasUrbana ? 'mobilidadeUrbana' : 'infracoesTransito', -1);
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
  void notifyMulteiLiveDelta('resolvidos', 1);
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
  delta: 1 | -1 = 1
): Promise<void> {
  if (typeof window === 'undefined') return;

  let dispatchedEvent: MulteiLiveDeltaEvent | null = null;

  try {
    const res = await fetch('/api/multei/live', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ category, delta })
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
      timestamp: Date.now()
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

function loadCachedStatsEntry(): { stats: MulteiStats; fetchedAt: number } | null {
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
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      STATS_CACHE_STORAGE_KEY,
      JSON.stringify({
        stats,
        fetchedAt: Date.now()
      })
    );
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
 * Realiza UMA ÚNICA busca no Firebase ao carregar ou atualizar (F5) a página `/multei/sobre`,
 * sem manter conexão `onSnapshot` aberta no Firestore.
 */
export async function fetchMulteiStatsOnce(
  onCached?: (stats: MulteiStats) => void
): Promise<MulteiStats> {
  const cachedEntry = loadCachedStatsEntry();
  if (cachedEntry?.stats && onCached) {
    onCached(cachedEntry.stats);
  }

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
        const totalGeral = Math.max(infracoesTransito + mobilidadeUrbana, Number(d.totalGeral || 0));
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
        category !== 'resolvidos')
    ) {
      return;
    }

    if (seenEventIds.has(id)) return;
    seenEventIds.add(id);
    if (id > lastSeenId) {
      lastSeenId = id;
    }

    adjustCachedStats({
      totalGeralDelta: category === 'resolvidos' ? 0 : delta,
      infracoesTransitoDelta: category === 'infracoesTransito' ? delta : 0,
      mobilidadeUrbanaDelta: category === 'mobilidadeUrbana' ? delta : 0,
      resolvidosDelta: category === 'resolvidos' ? delta : 0
    });

    onDelta({
      id,
      category,
      delta,
      timestamp: Number(evt.timestamp) || Date.now()
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

  const isUrbana = inc.natureza === 'urbana';
  adjustCachedStats({
    totalGeralDelta: 1,
    infracoesTransitoDelta: isUrbana ? 0 : 1,
    mobilidadeUrbanaDelta: isUrbana ? 1 : 0,
    resolvidosDelta: 0
  });
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

export async function refreshCurrentMulteiPanelProfile(): Promise<MulteiPanelUserProfile | null> {
  if (typeof window === 'undefined') return null;
  try {
    const { auth } = getFirebaseServices();
    if (!auth.currentUser) return null;
    return await resolveMulteiPanelUserProfile(auth.currentUser);
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
  const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
  return await resolveMulteiPanelUserProfile(cred.user);
}

export async function signOutMulteiPanel(): Promise<void> {
  const { auth } = getFirebaseServices();
  await signOut(auth);
}

export function subscribeToMulteiPanelAuth(
  onChange: (profile: MulteiPanelUserProfile | null) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  try {
    const { auth } = getFirebaseServices();
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        onChange(null);
        return;
      }
      try {
        const profile = await resolveMulteiPanelUserProfile(user);
        onChange(profile);
      } catch {
        onChange(null);
      }
    });
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
 * Busca todas as ocorrências reportadas na coleção `reportadas`, consolidando múltiplos reports
 * da mesma `ocorrenciaId` para exibir o histórico completo e o selo de 2ª/3ª vez reportada.
 */
export async function fetchReportedIncidentsForPanel(): Promise<ReportedIncidentPanelItem[]> {
  const { db } = getFirebaseServices();
  const snap = await getDocs(collection(db, REPORTADAS_COLLECTION));

  const groupedByOcorrencia = new Map<string, ReportedIncidentPanelItem>();

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
    const isRevisada =
      d.revisada === true ||
      String(d.revisada).toLowerCase() === 'true' ||
      d.status_revisao === 'revisada';

    const resultadoRevisao: 'procedente' | 'improcedente' | '' =
      d.resultado_revisao === 'procedente' || d.resultado_revisao === 'improcedente'
        ? d.resultado_revisao
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
        legacyDocIds: [docSnap.id]
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

  const list = Array.from(groupedByOcorrencia.values());

  // Se houver documentos duplicados da mesma ocorrenciaId (ex: um ID legado aleatório + outro com ocorrenciaId),
  // consolida todos os dados em `item.id` e remove os documentos duplicados extras.
  await Promise.all(
    list.map(async (item) => {
      const extraDocIds = (item.legacyDocIds || []).filter((docId) => docId && docId !== item.id);
      if (extraDocIds.length === 0) return;
      try {
        const canonicalRef = doc(db, REPORTADAS_COLLECTION, item.id);
        const { legacyDocIds, ...cleanItemData } = item;
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
 * Aplica a validação do administrador sobre uma ocorrência reportada:
 * - `decision === 'procedente'`: A denúncia procede (a foto é imprópria). Mantém `ativo: false` em `ocorrencias` e marca como `revisada: true` em `reportadas`.
 * - `decision === 'improcedente'`: A denúncia não procede (a foto é legítima). Volta `ativo: true` em `ocorrencias`, marca como `revisada: true` em `reportadas` e devolve `+1` às estatísticas caso estivesse inativa.
 */
export async function reviewReportedIncidentInFirebase(params: {
  item: ReportedIncidentPanelItem;
  decision: 'procedente' | 'improcedente';
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

  let wasActiveInOcorrencias = false;
  let isUrbana = item.natureza === 'urbana';

  try {
    const ocorrenciaSnap = await getDoc(ocorrenciaRef);
    if (ocorrenciaSnap.exists()) {
      const d = ocorrenciaSnap.data() || {};
      wasActiveInOcorrencias =
        d.ativo !== undefined && d.ativo !== ''
          ? d.ativo === true || String(d.ativo).toLowerCase() === 'true'
          : true;
      isUrbana = d.natureza === 'urbana';
    }
  } catch {}

  const nowIso = new Date().toISOString();
  const targetAtivo = decision === 'improcedente';

  // 1. Atualiza o documento na coleção `ocorrencias`
  await setDoc(
    ocorrenciaRef,
    {
      ativo: targetAtivo,
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

  // 3. Ajusta as estatísticas e emite o evento ao vivo caso o status `ativo` da ocorrência tenha mudado
  const category: MulteiLiveCategory = isUrbana ? 'mobilidadeUrbana' : 'infracoesTransito';

  if (decision === 'improcedente' && !wasActiveInOcorrencias) {
    // A ocorrência estava inativa (ativo: false) e voltou a ficar ativa (ativo: true) -> soma +1
    adjustCachedStats({
      totalGeralDelta: 1,
      infracoesTransitoDelta: isUrbana ? 0 : 1,
      mobilidadeUrbanaDelta: isUrbana ? 1 : 0,
      resolvidosDelta: 0
    });
    void notifyMulteiLiveDelta(category, 1);
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
      console.warn('[firebaseService] Aviso ao incrementar estatísticas após improcedente:', err);
    }
  } else if (decision === 'procedente' && wasActiveInOcorrencias) {
    // A ocorrência estava ativa (ativo: true) e passou a ficar inativa (ativo: false) -> subtrai -1 silenciosamente
    removeIncidentFromLocalCache(ocorrenciaId);
    adjustCachedStats({
      totalGeralDelta: -1,
      infracoesTransitoDelta: isUrbana ? 0 : -1,
      mobilidadeUrbanaDelta: isUrbana ? -1 : 0,
      resolvidosDelta: 0
    });
    void notifyMulteiLiveDelta(category, -1);
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
      console.warn('[firebaseService] Aviso ao decrementar estatísticas após procedente:', err);
    }
  }

  return {
    ...item,
    ativo: targetAtivo,
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
    snap.forEach((docSnap) => {
      docsList.push({ id: docSnap.id, data: docSnap.data() || {} });
    });
  }

  const results: ReportedIncident[] = [];

  for (const item of docsList) {
    const incident = mapDocToIncident(item.id, item.data);
    if (!incident) continue;

    if (targetCityKey) {
      const incCityKey = normalizeCityKey(incident.cidade);
      // Exige que pertença à cidade cadastrada (ou, se estiver no modo GPS 5km e um registro antigo não tiver cidade preenchida, permite pelo raio físico)
      if (incCityKey && incCityKey !== targetCityKey) {
        continue;
      }
      if (!incCityKey && !options.center) {
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
  if (!alreadyCountedInStats) {
    adjustCachedStats({
      totalGeralDelta: 0,
      infracoesTransitoDelta: 0,
      mobilidadeUrbanaDelta: 0,
      resolvidosDelta: 1
    });
    void notifyMulteiLiveDelta('resolvidos', 1);
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


