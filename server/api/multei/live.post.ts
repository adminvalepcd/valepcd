import {
  checkMulteiLiveRateLimit,
  isValidMulteiLiveCategory,
  isValidMulteiLiveDelta,
  publishMulteiLiveEvent,
  sanitizeMulteiLiveMeta
} from '../../utils/multeiLiveBus';

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff');
  setResponseHeader(event, 'X-Frame-Options', 'DENY');
  setResponseHeader(event, 'Cache-Control', 'no-store');

  // TODO(security): Multei operates 100% anonymously by design (no user accounts or session cookies).
  // To protect this public endpoint without user authentication, we enforce same-site origin checks,
  // per-IP rate limiting, and strict schema allow-listing on category and delta.
  const secFetchSite = getRequestHeader(event, 'sec-fetch-site');
  if (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'same-site' && secFetchSite !== 'none') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Origem não autorizada.'
    });
  }

  const clientIp = getRequestIP(event, { xForwardedFor: true }) || 'anonymous';
  if (!checkMulteiLiveRateLimit(clientIp)) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Muitas solicitações. Tente novamente em instantes.'
    });
  }

  const body = await readBody<Record<string, unknown>>(event).catch(() => null);
  const category = body?.category;
  const rawDelta = body?.delta !== undefined ? Number(body.delta) : 1;

  if (!isValidMulteiLiveCategory(category) || !isValidMulteiLiveDelta(rawDelta)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Parâmetros de evento inválidos.'
    });
  }

  const meta = sanitizeMulteiLiveMeta(body);
  const published = publishMulteiLiveEvent(category, rawDelta, meta);

  return {
    ok: true,
    event: published
  };
});
