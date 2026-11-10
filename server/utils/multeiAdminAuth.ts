import { createPublicKey, verify as cryptoVerify, type JsonWebKey } from 'node:crypto';
import type { H3Event } from 'h3';

interface GoogleJwkResponse {
  keys?: Array<JsonWebKey & { kid?: string; alg?: string; kty?: string; use?: string }>;
}

interface FirestoreFieldValue {
  stringValue?: string;
  booleanValue?: boolean;
  integerValue?: string;
  doubleValue?: number;
}

interface FirestoreDocument {
  name?: string;
  fields?: Record<string, FirestoreFieldValue>;
}

interface FirestoreListResponse {
  documents?: FirestoreDocument[];
}

export interface VerifiedMulteiAdmin {
  uid: string;
  email: string;
}

const GOOGLE_SECURETOKEN_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const JWKS_CACHE_TTL_MS = 55 * 60 * 1000;

let cachedJwks: Map<string, JsonWebKey> | null = null;
let cachedJwksExpiresAt = 0;

const adminRateBuckets = new Map<string, number[]>();

export function applyAdminApiSecurityHeaders(event: H3Event): void {
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff');
  setResponseHeader(event, 'X-Frame-Options', 'DENY');
  setResponseHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate');
}

export function enforceSameOriginPostRequest(event: H3Event): void {
  const secFetchSite = getRequestHeader(event, 'sec-fetch-site');
  if (
    secFetchSite &&
    secFetchSite !== 'same-origin' &&
    secFetchSite !== 'same-site' &&
    secFetchSite !== 'none'
  ) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Origem da requisição não autorizada.'
    });
  }

  const origin = getRequestHeader(event, 'origin');
  const host = getRequestHeader(event, 'x-forwarded-host') || getRequestHeader(event, 'host');
  if (origin && host) {
    try {
      const originUrl = new URL(origin);
      const normalizedHost = host.split(',')[0].trim().toLowerCase();
      if (originUrl.host.toLowerCase() !== normalizedHost) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Origem cruzada bloqueada.'
        });
      }
    } catch (err: any) {
      if (err?.statusCode === 403) throw err;
      throw createError({
        statusCode: 403,
        statusMessage: 'Cabeçalho Origin inválido.'
      });
    }
  }
}

export function enforceAdminRateLimit(
  event: H3Event,
  scopeKey: string,
  maxRequests = 25,
  windowMs = 60_000
): void {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown';
  const bucketKey = `${scopeKey}:${ip}`;
  const now = Date.now();
  const cutoff = now - windowMs;

  const prev = adminRateBuckets.get(bucketKey) || [];
  const active = prev.filter((ts) => ts > cutoff);
  if (active.length >= maxRequests) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Muitas solicitações seguidas. Aguarde alguns segundos e tente novamente.'
    });
  }

  active.push(now);
  adminRateBuckets.set(bucketKey, active);

  if (adminRateBuckets.size > 500) {
    for (const [k, timestamps] of adminRateBuckets.entries()) {
      if (timestamps.every((t) => t <= cutoff)) {
        adminRateBuckets.delete(k);
      }
    }
  }
}

function decodeBase64UrlToBuffer(segment: string): Buffer {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + '='.repeat(padLen), 'base64');
}

async function getGooglePublicJwks(forceRefresh = false): Promise<Map<string, JsonWebKey>> {
  const now = Date.now();
  if (!forceRefresh && cachedJwks && now < cachedJwksExpiresAt) {
    return cachedJwks;
  }

  const res = await fetch(GOOGLE_SECURETOKEN_JWKS_URL, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  });
  if (!res.ok) {
    throw new Error('Não foi possível consultar as chaves públicas de autenticação.');
  }

  const data = (await res.json()) as GoogleJwkResponse;
  const map = new Map<string, JsonWebKey>();
  for (const key of data.keys || []) {
    if (key.kid && key.kty === 'RSA') {
      map.set(key.kid, key);
    }
  }

  if (map.size === 0) {
    throw new Error('Nenhuma chave pública RSA disponível para verificação.');
  }

  cachedJwks = map;
  cachedJwksExpiresAt = now + JWKS_CACHE_TTL_MS;
  return map;
}

async function verifyFirebaseIdTokenJwt(
  idToken: string,
  expectedProjectId: string
): Promise<{ uid: string; email: string }> {
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw createError({ statusCode: 401, statusMessage: 'Token de autenticação malformado.' });
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;

  try {
    header = JSON.parse(decodeBase64UrlToBuffer(headerB64).toString('utf8'));
    payload = JSON.parse(decodeBase64UrlToBuffer(payloadB64).toString('utf8'));
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Falha ao decodificar token de autenticação.' });
  }

  // Algoritmo estritamente fixado em RS256 (rejeita 'none' ou qualquer algoritmo simétrico)
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid.trim()) {
    throw createError({ statusCode: 401, statusMessage: 'Algoritmo de token não permitido.' });
  }

  let jwks = await getGooglePublicJwks(false);
  let jwk = jwks.get(header.kid);
  if (!jwk) {
    jwks = await getGooglePublicJwks(true);
    jwk = jwks.get(header.kid);
  }
  if (!jwk) {
    throw createError({ statusCode: 401, statusMessage: 'Chave de assinatura do token inválida.' });
  }

  const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
  const signingInput = Buffer.from(`${headerB64}.${payloadB64}`, 'utf8');
  const signature = decodeBase64UrlToBuffer(signatureB64);

  const isSignatureValid = cryptoVerify('RSA-SHA256', signingInput, publicKey, signature);
  if (!isSignatureValid) {
    throw createError({ statusCode: 401, statusMessage: 'Assinatura do token inválida.' });
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const exp = Number(payload.exp || 0);
  const iat = Number(payload.iat || 0);
  const iss = String(payload.iss || '');
  const aud = String(payload.aud || '');
  const sub = String(payload.sub || '').trim();
  const email = String(payload.email || '').trim().toLowerCase();

  const expectedIssuer = `https://securetoken.google.com/${expectedProjectId}`;
  if (iss !== expectedIssuer || aud !== expectedProjectId || !sub) {
    throw createError({ statusCode: 401, statusMessage: 'Emissor ou audiência do token inválidos.' });
  }

  if (!exp || exp <= nowSec - 5) {
    throw createError({ statusCode: 401, statusMessage: 'Sessão expirada. Faça login novamente no painel.' });
  }

  if (!iat || iat > nowSec + 60) {
    throw createError({ statusCode: 401, statusMessage: 'Horário de emissão do token inválido.' });
  }

  return { uid: sub, email };
}

function parseFirestoreDocFields(doc?: FirestoreDocument | null): Record<string, string | boolean | number> {
  const result: Record<string, string | boolean | number> = {};
  const fields = doc?.fields || {};
  for (const [rawKey, val] of Object.entries(fields)) {
    const k = rawKey.trim().toLowerCase();
    if (val.booleanValue !== undefined) {
      result[k] = Boolean(val.booleanValue);
    } else if (val.stringValue !== undefined) {
      result[k] = String(val.stringValue);
    } else if (val.integerValue !== undefined) {
      result[k] = Number(val.integerValue);
    } else if (val.doubleValue !== undefined) {
      result[k] = Number(val.doubleValue);
    }
  }
  return result;
}

function evaluateIsActiveAdminDoc(fields: Record<string, string | boolean | number>): {
  active: boolean;
  isAdmin: boolean;
} {
  const active =
    fields.ativo === false || String(fields.ativo ?? 'true').trim().toLowerCase() === 'false'
      ? false
      : true;
  const rawRole = String(
    fields.role || fields.tipo || fields.cargo || fields.perfil || 'admin'
  )
    .trim()
    .toLowerCase();
  const isAdmin = rawRole !== 'parceria' && rawRole !== 'parceiro';
  return { active, isAdmin };
}

async function verifyAdminRoleInFirestore(
  projectId: string,
  idToken: string,
  uid: string,
  email: string
): Promise<void> {
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;
  const authHeaders = {
    Authorization: `Bearer ${idToken}`,
    Accept: 'application/json'
  };

  // 1. Consulta direta `usuarios/{uid}`
  const directRes = await fetch(`${baseUrl}/usuarios/${encodeURIComponent(uid)}`, {
    method: 'GET',
    headers: authHeaders
  });

  if (directRes.status === 401) {
    throw createError({ statusCode: 401, statusMessage: 'Sessão inválida ou revogada.' });
  }

  if (directRes.ok) {
    const directDoc = (await directRes.json()) as FirestoreDocument;
    const parsed = parseFirestoreDocFields(directDoc);
    const { active, isAdmin } = evaluateIsActiveAdminDoc(parsed);
    if (!active) {
      throw createError({ statusCode: 403, statusMessage: 'Conta administrativa desativada.' });
    }
    if (!isAdmin) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Acesso restrito exclusivamente a administradores.'
      });
    }
    return;
  }

  // 2. Fallback para coleções legadas/documentos indexados por e-mail
  const candidateCollections = ['usuarios', 'usarios'];
  for (const colName of candidateCollections) {
    const listRes = await fetch(`${baseUrl}/${encodeURIComponent(colName)}?pageSize=200`, {
      method: 'GET',
      headers: authHeaders
    });
    if (!listRes.ok) continue;

    const listJson = (await listRes.json()) as FirestoreListResponse;
    const docs = listJson.documents || [];
    for (const d of docs) {
      const docId = String(d.name || '').split('/').pop() || '';
      const parsed = parseFirestoreDocFields(d);
      const docEmail = String(parsed.email || parsed['e-mail'] || '').trim().toLowerCase();
      const docUid = String(parsed.uid || parsed.id || '').trim();

      const matches =
        docId === uid ||
        (email && docId.toLowerCase() === email) ||
        (email && docEmail === email) ||
        (docUid && docUid === uid);

      if (matches) {
        const { active, isAdmin } = evaluateIsActiveAdminDoc(parsed);
        if (!active) {
          throw createError({ statusCode: 403, statusMessage: 'Conta administrativa desativada.' });
        }
        if (!isAdmin) {
          throw createError({
            statusCode: 403,
            statusMessage: 'Acesso restrito exclusivamente a administradores.'
          });
        }
        return;
      }
    }
  }

  throw createError({
    statusCode: 403,
    statusMessage: 'Perfil administrativo não localizado ou sem permissão.'
  });
}

export async function requireMulteiAdminAuth(event: H3Event): Promise<VerifiedMulteiAdmin> {
  applyAdminApiSecurityHeaders(event);

  const authHeader = getRequestHeader(event, 'authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Autenticação administrativa obrigatória.'
    });
  }

  const token = authHeader.slice(7).trim();
  if (!token || token.length > 8192) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Token de autenticação inválido.'
    });
  }

  const config = useRuntimeConfig(event);
  const rawMockFlag = String(config.public?.useFirebaseMock || '').trim().toLowerCase();
  const reqHost = String(getRequestHeader(event, 'host') || '')
    .split(':')[0]
    .trim()
    .toLowerCase();
  const isLocalDevHost =
    reqHost === 'localhost' || reqHost === '127.0.0.1' || reqHost === '[::1]';
  const useMock =
    process.env.NODE_ENV !== 'production' &&
    rawMockFlag !== 'false' &&
    rawMockFlag !== '0' &&
    (rawMockFlag === 'true' || rawMockFlag === '1' || isLocalDevHost);

  if (useMock && token === 'mock-admin-token') {
    return { uid: 'mock-admin', email: 'admin@valepcd.com.br' };
  }

  const projectId = String(config.public?.firebaseProjectId || process.env.FIREBASE_PROJECT_ID || '').trim();
  if (!projectId) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Configuração do projeto Firebase ausente no servidor.'
    });
  }

  const verifiedUser = await verifyFirebaseIdTokenJwt(token, projectId);
  await verifyAdminRoleInFirestore(projectId, token, verifiedUser.uid, verifiedUser.email);

  return verifiedUser;
}
