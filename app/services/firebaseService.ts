import { useNuxtApp } from '#app';
import { getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  onSnapshot,
  increment,
  query,
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
  geohashForLocation,
  geohashQueryBounds,
  distanceBetween
} from 'geofire-common';
import type { ReportedIncident } from '../types';
import { getAddressDetailsFromCoords, extractCityAndStateFromText, normalizeState } from './geoService';

export const OCORRENCIAS_COLLECTION = 'ocorrencias';
export const RESOLVIDOS_COLLECTION = 'resolvidos';
export const ESTATISTICAS_COLLECTION = 'estatisticas';
export const ESTATISTICAS_DOC_ID = 'resumo';

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
 * Obtém as instâncias do Firestore ($db) e Storage ($storage) do plugin Nuxt
 * ou diretamente do app Firebase inicializado (seguro após chamadas await).
 */
function getFirebaseServices(): { db: Firestore; storage: FirebaseStorage } {
  try {
    const nuxtApp = useNuxtApp();
    if (nuxtApp?.$db && nuxtApp?.$storage) {
      return {
        db: nuxtApp.$db as Firestore,
        storage: nuxtApp.$storage as FirebaseStorage
      };
    }
  } catch {
    // Caso chamado fora do contexto síncrono do Nuxt composable, usa getApp()
  }

  if (getApps().length > 0) {
    const app = getApp();
    return {
      db: getFirestore(app),
      storage: getStorage(app)
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
    resolvido_em_validacao: Boolean(
      data.resolvido_em_validacao === true ||
      String(data.resolvido_em_validacao).toLowerCase() === 'true' ||
      data.status_resolucao === 'em_validacao'
    ),
    status_resolucao: data.status_resolucao
      ? String(data.status_resolucao)
      : (data.resolvido_em_validacao ? 'em_validacao' : '')
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

  // 5. Atualiza contadores em `estatisticas/resumo` (Option B - 1 documento único)
  if (docData.ativo) {
    try {
      const isUrbana = docData.natureza === 'urbana';
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
 * Reporta / desativa uma ocorrência no Firestore marcando `ativo: false` e preenchendo `motivo_denuncia`.
 */
export async function reportIncidentInFirebase(id: string, reason: string): Promise<boolean> {
  const cleanId = (id || '').trim();
  if (!cleanId) {
    throw new Error('ID da ocorrência ausente para denúncia.');
  }

  removeIncidentFromLocalCache(cleanId);

  const { db } = getFirebaseServices();
  const docRef = doc(db, OCORRENCIAS_COLLECTION, cleanId);

  let wasActive = true;
  let wasUrbana = false;
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const d = snap.data() || {};
      wasActive = d.ativo !== false && String(d.ativo).toLowerCase() !== 'false';
      wasUrbana = d.natureza === 'urbana';
    }
  } catch {}

  await updateDoc(docRef, {
    ativo: false,
    motivo_denuncia: (reason || '').trim()
  });

  if (wasActive) {
    adjustCachedStats({
      totalGeralDelta: -1,
      infracoesTransitoDelta: wasUrbana ? 0 : -1,
      mobilidadeUrbanaDelta: wasUrbana ? -1 : 0,
      resolvidosDelta: 0
    });
    try {
      const statsRef = doc(db, ESTATISTICAS_COLLECTION, ESTATISTICAS_DOC_ID);
      await setDoc(
        statsRef,
        {
          totalGeral: increment(-1),
          [wasUrbana ? 'mobilidadeUrbana' : 'infracoesTransito']: increment(-1),
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
    } catch (statsErr) {
      console.warn('[firebaseService] Aviso ao decrementar estatísticas:', statsErr);
    }
  }

  return true;
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

  // Atualiza contador de resolvidos em `estatisticas/resumo`
  adjustCachedStats({
    totalGeralDelta: 0,
    infracoesTransitoDelta: 0,
    mobilidadeUrbanaDelta: 0,
    resolvidosDelta: 1
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
 * e grava o documento único `estatisticas/resumo` (executado apenas na primeira inicialização).
 */
export async function recalculateAndSyncMulteiStats(): Promise<MulteiStats> {
  const cached = loadCachedStatsEntry();
  if (cached && Date.now() - cached.fetchedAt < STATS_CACHE_TTL_MS) {
    return cached.stats;
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
 * Escuta em tempo real o documento único `estatisticas/resumo` (consome apenas 1 leitura).
 * Utiliza cache local imediato e evita varreduras repetidas caso o documento agregador ainda não exista.
 */
export function subscribeToMulteiStats(
  onUpdate: (stats: MulteiStats) => void,
  onError?: (err: unknown) => void
): () => void {
  const cachedEntry = loadCachedStatsEntry();
  if (cachedEntry?.stats) {
    onUpdate(cachedEntry.stats);
  }

  try {
    const { db } = getFirebaseServices();
    const statsRef = doc(db, ESTATISTICAS_COLLECTION, ESTATISTICAS_DOC_ID);
    let isSeeding = false;

    const unsubscribe = onSnapshot(
      statsRef,
      async (snap) => {
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
            onUpdate(nextStats);
            return;
          }
        }

        if (!isSeeding) {
          isSeeding = true;
          try {
            const seeded = await recalculateAndSyncMulteiStats();
            onUpdate(seeded);
          } catch (seedErr) {
            if (onError) onError(seedErr);
          }
        }
      },
      (err) => {
        console.warn('[firebaseService] Erro ao escutar estatisticas/resumo:', err);
        if (onError && !cachedEntry?.stats) onError(err);
      }
    );

    return unsubscribe;
  } catch (err) {
    if (onError && !cachedEntry?.stats) onError(err);
    return () => {};
  }
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

