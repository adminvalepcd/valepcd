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

/**
 * Busca ocorrências no Firestore dentro da área visível do mapa usando `geohashQueryBounds` (geofire-common).
 */
export async function fetchIncidentsByVisibleArea(options: {
  bounds?: MapVisibleBounds | null;
  center?: { latitude: number; longitude: number } | null;
  radiusKm?: number;
}): Promise<ReportedIncident[]> {
  try {
    const { db } = getFirebaseServices();
    const colRef = collection(db, OCORRENCIAS_COLLECTION);

    let centerLat: number;
    let centerLng: number;
    let radiusMeters: number;
    const bounds = options.bounds;

    if (
      bounds &&
      Number.isFinite(bounds.north) &&
      Number.isFinite(bounds.south) &&
      Number.isFinite(bounds.east) &&
      Number.isFinite(bounds.west)
    ) {
      centerLat = bounds.center?.latitude ?? (bounds.north + bounds.south) / 2;
      centerLng = bounds.center?.longitude ?? (bounds.east + bounds.west) / 2;

      // Calcula a distância do centro até o canto nordeste da área visível do mapa (em km -> metros)
      const cornerDistanceKm = distanceBetween([centerLat, centerLng], [bounds.north, bounds.east]);
      // Margem de 15% para cobrir bordas da tela, com mínimo de 1km e teto de 80km por consulta geohash
      radiusMeters = Math.min(Math.max(cornerDistanceKm * 1000 * 1.15, 1000), 80000);
    } else if (
      options.center &&
      Number.isFinite(options.center.latitude) &&
      Number.isFinite(options.center.longitude)
    ) {
      centerLat = options.center.latitude;
      centerLng = options.center.longitude;
      radiusMeters = (options.radiusKm ?? 30) * 1000;
    } else {
      // Fallback: busca geral na coleção caso ainda não haja centro ou bounds definidos
      const snap = await getDocs(colRef);
      const all: ReportedIncident[] = [];
      snap.forEach((docSnap) => {
        const mapped = mapDocToIncident(docSnap.id, docSnap.data());
        if (mapped) all.push(mapped);
      });
      return all;
    }

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

        // Se temos os limites exatos da tela (bounds), filtra pelos limites visíveis (com pequena folga)
        if (
          bounds &&
          Number.isFinite(bounds.north) &&
          Number.isFinite(bounds.south) &&
          Number.isFinite(bounds.east) &&
          Number.isFinite(bounds.west)
        ) {
          const latPad = Math.abs(bounds.north - bounds.south) * 0.05;
          const lngPad = Math.abs(bounds.east - bounds.west) * 0.05;
          const inLat =
            incident.latitude >= bounds.south - latPad &&
            incident.latitude <= bounds.north + latPad;
          const inLng =
            bounds.west <= bounds.east
              ? incident.longitude >= bounds.west - lngPad && incident.longitude <= bounds.east + lngPad
              : incident.longitude >= bounds.west - lngPad || incident.longitude <= bounds.east + lngPad;

          if (!inLat || !inLng) return;
        } else {
          // Filtro por raio em relação ao centro
          const distKm = distanceBetween(
            [centerLat, centerLng],
            [incident.latitude, incident.longitude]
          );
          if (distKm * 1000 > radiusMeters) return;
        }

        results.push(incident);
      });
    }

    results.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime() || 0;
      const timeB = new Date(b.timestamp).getTime() || 0;
      return timeB - timeA;
    });

    if (typeof window !== 'undefined' && results.length > 0) {
      try {
        localStorage.setItem('multei_cached_incidents', JSON.stringify(results));
      } catch {}
    }

    return results;
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
 * 4. Grava o documento em `ocorrencias/{id}` com `geohash` e `natureza: 'infracao_veicular'`
 */
export async function saveIncidentToFirebase(
  incident: SaveFirebaseIncidentPayload
): Promise<{
  success: boolean;
  id: string;
  fotoUrl: string;
  geohash: string;
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

  if (typeof window !== 'undefined') {
    try {
      const cached = loadIncidentsFromLocalCache();
      const updated = cached.filter((inc) => inc.id !== cleanId);
      localStorage.setItem('multei_cached_incidents', JSON.stringify(updated));
    } catch (e) {
      console.warn('[firebaseService] Erro ao atualizar cache local na denúncia:', e);
    }
  }

  const { db } = getFirebaseServices();
  const docRef = doc(db, OCORRENCIAS_COLLECTION, cleanId);

  await updateDoc(docRef, {
    ativo: false,
    motivo_denuncia: (reason || '').trim()
  });

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

  // Atualiza também o cache local para refletir o status imediatamente
  if (typeof window !== 'undefined') {
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
  }

  return {
    success: true,
    id,
    fotoUrl
  };
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
    const list = loadIncidentsFromLocalCache();
    list.unshift(inc);
    localStorage.setItem('multei_cached_incidents', JSON.stringify(list));
  } catch {}
}
