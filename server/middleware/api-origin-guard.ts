import { createError, defineEventHandler, getRequestHeader, getRequestURL, setResponseHeaders } from 'h3';

const PROD_ALLOWED_HOSTS = new Set([
  'www.valepcd.com.br',
  'valepcd.com.br'
]);

const DEV_ALLOWED_HOSTS = new Set([
  'localhost',
  '127.0.0.1'
]);

function extractHostname(rawUrlOrOrigin?: string | null): string {
  if (!rawUrlOrOrigin) return '';
  try {
    return new URL(rawUrlOrOrigin).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isAllowedHost(hostname: string, isDev: boolean): boolean {
  if (!hostname) return false;
  if (PROD_ALLOWED_HOSTS.has(hostname)) return true;
  if (isDev && DEV_ALLOWED_HOSTS.has(hostname)) return true;
  return false;
}

/**
 * Middleware global que protege todas as rotas `/api/**` do site para aceitar
 * exclusivamente requisições originadas do domínio oficial `www.valepcd.com.br`
 * (e `localhost` apenas em ambiente de desenvolvimento).
 */
export default defineEventHandler((event) => {
  const url = getRequestURL(event);
  if (!url.pathname.startsWith('/api/')) {
    return;
  }

  const isDev = process.env.NODE_ENV === 'development';
  const originHeader = getRequestHeader(event, 'origin') || '';
  const refererHeader = getRequestHeader(event, 'referer') || '';
  const secFetchSite = (getRequestHeader(event, 'sec-fetch-site') || '').toLowerCase();
  const hostHeader = (getRequestHeader(event, 'x-forwarded-host') || getRequestHeader(event, 'host') || '')
    .split(':')[0]
    .trim()
    .toLowerCase();

  const originHost = extractHostname(originHeader);
  const refererHost = extractHostname(refererHeader);

  // Cabeçalhos de segurança padrão para todas as respostas da API
  const allowedOriginHeader =
    originHeader && isAllowedHost(originHost, isDev)
      ? originHeader
      : 'https://www.valepcd.com.br';

  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': allowedOriginHeader,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  });

  if (event.method === 'OPTIONS') {
    if (!originHost || !isAllowedHost(originHost, isDev)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Acesso negado: origem não autorizada.'
      });
    }
    return '';
  }

  // 1. Se o navegador informou Sec-Fetch-Site como cross-site, bloqueia imediatamente
  if (secFetchSite === 'cross-site') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Acesso negado: requisição entre origens não permitida.'
    });
  }

  // 2. Se o cabeçalho Origin estiver presente, exige que seja de www.valepcd.com.br
  if (originHeader && !isAllowedHost(originHost, isDev)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Acesso negado: origem não autorizada.'
    });
  }

  // 3. Se o cabeçalho Referer estiver presente, exige que seja de www.valepcd.com.br
  if (refererHeader && !isAllowedHost(refererHost, isDev)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Acesso negado: referência não autorizada.'
    });
  }

  // 4. Verifica se é uma chamada interna SSR do próprio Nuxt (unenv localFetch) num host autorizado
  const rawReq = event.node?.req as any;
  const remoteAddr = rawReq?.socket?.remoteAddress || '';
  const isInternalSsrSubrequest =
    Boolean(rawReq?.__unenv__) ||
    !remoteAddr ||
    remoteAddr === '127.0.0.1' ||
    remoteAddr === '::1';

  const hasValidOriginOrReferer =
    isAllowedHost(originHost, isDev) || isAllowedHost(refererHost, isDev);

  const hasValidSameOriginSecFetch =
    (secFetchSite === 'same-origin' || secFetchSite === 'same-site') &&
    isAllowedHost(hostHeader, isDev);

  const hasValidInternalSsr =
    isInternalSsrSubrequest && isAllowedHost(hostHeader, isDev);

  if (!hasValidOriginOrReferer && !hasValidSameOriginSecFetch && !hasValidInternalSsr) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Acesso restrito exclusivamente ao site www.valepcd.com.br.'
    });
  }
});
