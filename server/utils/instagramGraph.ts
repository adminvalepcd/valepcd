const IG_HANDLE_REGEX = /^[a-zA-Z0-9._]{1,30}$/;
const GRAPH_VERSION_REGEX = /^v\d{1,2}\.\d$/;
const IG_NUMERIC_ID_REGEX = /^\d{8,30}$/;

export interface InstagramUserTagInput {
  username: string;
  x?: number;
  y?: number;
}

export interface InstagramDiscoveredProfile {
  verified: boolean;
  username: string;
  name?: string;
  biography?: string;
  followersCount?: number;
  profilePictureUrl?: string;
  reason?: string;
  metaTokenExpired?: boolean;
  verificationSource?: 'meta_graph' | 'instagram_public';
}

export interface InstagramPublishInput {
  imageUrls: string[];
  caption: string;
  userTags?: InstagramUserTagInput[];
}

export interface InstagramPublishResult {
  mediaId: string;
  permalink: string;
  tagsApplied: boolean;
}

export interface InstagramServerConfig {
  igUserId: string;
  igAccessToken: string;
  igGraphVersion: string;
  firebaseStorageBucket: string;
  allowLocalMockUrls?: boolean;
}

export function sanitizeInstagramHandle(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const cleaned = raw.trim().replace(/^@+/, '').trim();
  if (!IG_HANDLE_REGEX.test(cleaned)) return '';
  return cleaned.toLowerCase();
}

export function sanitizeInstagramCaption(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const cleaned = raw.replace(/\u0000/g, '').trim();
  if (!cleaned) return '';
  return cleaned.length > 2200 ? cleaned.slice(0, 2200) : cleaned;
}

export function validateStagingImageUrls(
  rawUrls: unknown,
  allowedBucket: string,
  allowLocalMockUrls = false
): string[] {
  if (!Array.isArray(rawUrls) || rawUrls.length < 1 || rawUrls.length > 9) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A publicação deve conter entre 1 e 9 imagens.'
    });
  }

  const cleanBucket = String(allowedBucket || '').trim();
  if (!cleanBucket && !allowLocalMockUrls) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Bucket do Firebase Storage não configurado no servidor.'
    });
  }

  const expectedPrimaryPrefix = `/v0/b/${encodeURIComponent(cleanBucket)}/o/instagram_staging%2F`;
  const expectedFallbackPrefix = `/v0/b/${encodeURIComponent(cleanBucket)}/o/ocorrencias%2Fig_temp_`;
  const validated: string[] = [];

  for (const item of rawUrls) {
    if (typeof item !== 'string' || item.length > 2048) {
      throw createError({
        statusCode: 400,
        statusMessage: 'URL de imagem inválida para publicação.'
      });
    }

    let parsed: URL;
    try {
      parsed = new URL(item);
    } catch {
      throw createError({
        statusCode: 400,
        statusMessage: 'Formato de URL de imagem inválido.'
      });
    }

    if (parsed.protocol !== 'https:') {
      throw createError({
        statusCode: 400,
        statusMessage: 'A Meta Graph API exige URLs públicas com protocolo HTTPS.'
      });
    }

    const isAllowedFirebaseStaging =
      parsed.hostname === 'firebasestorage.googleapis.com' &&
      (parsed.pathname.startsWith(expectedPrimaryPrefix) ||
        parsed.pathname.startsWith(expectedFallbackPrefix));

    if (!isAllowedFirebaseStaging) {
      throw createError({
        statusCode: 400,
        statusMessage: 'URL de imagem fora do repositório temporário autorizado do Multei.'
      });
    }

    validated.push(parsed.toString());
  }

  return validated;
}

function resolveGraphBaseUrl(config: InstagramServerConfig): {
  baseUrl: string;
  igUserId: string;
  accessToken: string;
} {
  const igUserId = String(config.igUserId || '').trim();
  const accessToken = String(config.igAccessToken || '').trim();
  const rawVersion = String(config.igGraphVersion || 'v27.0').trim();
  const version = GRAPH_VERSION_REGEX.test(rawVersion) ? rawVersion : 'v27.0';

  if (!IG_NUMERIC_ID_REGEX.test(igUserId) || !accessToken) {
    throw createError({
      statusCode: 500,
      statusMessage:
        'Credenciais da API do Instagram (NUXT_IG_USER_ID / NUXT_IG_ACCESS_TOKEN) não configuradas no servidor.'
    });
  }

  return {
    baseUrl: `https://graph.facebook.com/${version}`,
    igUserId,
    accessToken
  };
}

function decodeBasicHtmlEntities(raw: string): string {
  return String(raw || '')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function parseInstagramFollowersText(rawText: string): number | undefined {
  const match = rawText.match(/([\d.,]+)\s*(K|M|mil|mi)?\s*(?:seguidores|followers)/i);
  if (!match) return undefined;
  const numPart = match[1].trim();
  const suffix = String(match[2] || '').toLowerCase();

  if (suffix === 'k' || suffix === 'mil') {
    const val = parseFloat(numPart.replace(',', '.'));
    return Number.isFinite(val) ? Math.round(val * 1_000) : undefined;
  }
  if (suffix === 'm' || suffix === 'mi') {
    const val = parseFloat(numPart.replace(',', '.'));
    return Number.isFinite(val) ? Math.round(val * 1_000_000) : undefined;
  }

  const digitsOnly = numPart.replace(/[^\d]/g, '');
  const exact = Number(digitsOnly);
  return Number.isFinite(exact) && exact > 0 ? exact : undefined;
}

async function verifyInstagramPublicOpenGraph(
  username: string
): Promise<InstagramDiscoveredProfile | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);

  try {
    const res = await fetch(`https://www.instagram.com/${encodeURIComponent(username)}/`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
      },
      signal: controller.signal
    });

    if (!res.ok) return null;
    const html = await res.text();

    const rawTitle =
      (html.match(/property="og:title"\s+content="([^"]+)"/i) ||
        html.match(/content="([^"]+)"\s+property="og:title"/i) ||
        [])[1] || '';
    if (!rawTitle) return null;

    const title = decodeBasicHtmlEntities(rawTitle).trim();
    const lowerTitle = title.toLowerCase();
    if (!lowerTitle.includes(`@${username.toLowerCase()}`) && !lowerTitle.includes('instagram')) {
      return null;
    }

    const rawDesc =
      (html.match(/property="og:description"\s+content="([^"]+)"/i) ||
        html.match(/content="([^"]+)"\s+property="og:description"/i) ||
        [])[1] || '';
    const desc = decodeBasicHtmlEntities(rawDesc).trim();

    const rawImg =
      (html.match(/property="og:image"\s+content="([^"]+)"/i) ||
        html.match(/content="([^"]+)"\s+property="og:image"/i) ||
        [])[1] || '';
    const imgUrl = decodeBasicHtmlEntities(rawImg).trim();

    const nameMatch = title.match(/^(.*?)\s*\(@/);
    const cleanName = nameMatch ? nameMatch[1].trim() : title.split('•')[0].trim();
    const followersCount = parseInstagramFollowersText(desc);

    return {
      verified: true,
      username,
      name: cleanName || undefined,
      biography: desc ? desc.slice(0, 240) : undefined,
      followersCount,
      profilePictureUrl: imgUrl.startsWith('https://') ? imgUrl : undefined,
      verificationSource: 'instagram_public'
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function discoverInstagramBusinessProfile(
  rawUsername: string,
  config: InstagramServerConfig
): Promise<InstagramDiscoveredProfile> {
  const username = sanitizeInstagramHandle(rawUsername);
  if (!username) {
    return {
      verified: false,
      username: '',
      reason: 'Informe um @ de Instagram válido.'
    };
  }

  let metaTokenExpired = false;

  try {
    const { baseUrl, igUserId, accessToken } = resolveGraphBaseUrl(config);
    const fieldsParam = `business_discovery.username(${username}){id,username,name,biography,followers_count,profile_picture_url}`;
    const url = `${baseUrl}/${encodeURIComponent(igUserId)}?fields=${encodeURIComponent(fieldsParam)}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    });

    const payload = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (res.ok && payload?.business_discovery) {
      const bd = payload.business_discovery;
      return {
        verified: true,
        username: sanitizeInstagramHandle(bd.username || username) || username,
        name: bd.name ? String(bd.name).trim() : undefined,
        biography: bd.biography ? String(bd.biography).trim().slice(0, 260) : undefined,
        followersCount: typeof bd.followers_count === 'number' ? bd.followers_count : undefined,
        profilePictureUrl:
          typeof bd.profile_picture_url === 'string' &&
          bd.profile_picture_url.startsWith('https://')
            ? bd.profile_picture_url
            : undefined,
        verificationSource: 'meta_graph'
      };
    }

    if (Number(payload?.error?.code) === 190) {
      metaTokenExpired = true;
    }
  } catch {}

  // Camada 2: Validação direta nos metadados públicos oficiais do Instagram
  // (funciona mesmo com App da Meta em Modo de Desenvolvimento ou antes da renovação do token)
  const publicProfile = await verifyInstagramPublicOpenGraph(username);
  if (publicProfile) {
    return {
      ...publicProfile,
      metaTokenExpired
    };
  }

  return {
    verified: false,
    username,
    metaTokenExpired,
    reason: `O perfil @${username} não foi encontrado como conta pública ativa no Instagram (verifique a grafia do @).`
  };
}

function normalizeUserTags(rawTags?: InstagramUserTagInput[]): Array<{ username: string; x: number; y: number }> {
  if (!Array.isArray(rawTags) || rawTags.length === 0) return [];
  const seen = new Set<string>();
  const normalized: Array<{ username: string; x: number; y: number }> = [];

  for (const tag of rawTags) {
    const handle = sanitizeInstagramHandle(tag?.username);
    if (!handle || seen.has(handle)) continue;
    seen.add(handle);

    const idx = normalized.length;
    const x =
      typeof tag?.x === 'number' && tag.x >= 0.05 && tag.x <= 0.95
        ? Number(tag.x.toFixed(2))
        : idx === 0
          ? 0.35
          : 0.65;
    const y =
      typeof tag?.y === 'number' && tag.y >= 0.05 && tag.y <= 0.95
        ? Number(tag.y.toFixed(2))
        : 0.88;

    normalized.push({ username: handle, x, y });
    if (normalized.length >= 3) break;
  }

  return normalized;
}

async function sleepMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForContainerReady(
  baseUrl: string,
  containerId: string,
  accessToken: string,
  maxAttempts = 18
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const url = `${baseUrl}/${encodeURIComponent(containerId)}?fields=status_code,status`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    });

    if (!res.ok) {
      await sleepMs(1200);
      continue;
    }

    const data = (await res.json().catch(() => ({}))) as Record<string, any>;
    const statusCode = String(data?.status_code || '').toUpperCase();

    if (!statusCode || statusCode === 'FINISHED' || statusCode === 'PUBLISHED') {
      return;
    }

    if (statusCode === 'ERROR' || statusCode === 'EXPIRED') {
      throw createError({
        statusCode: 502,
        statusMessage: 'A Meta recusou o processamento de uma das imagens do post.'
      });
    }

    await sleepMs(1500);
  }

  throw createError({
    statusCode: 504,
    statusMessage: 'Tempo limite excedido aguardando o processamento da mídia no Instagram.'
  });
}

async function createMediaContainerRequest(
  baseUrl: string,
  igUserId: string,
  accessToken: string,
  bodyParams: Record<string, string | boolean>
): Promise<{ ok: boolean; id?: string; errorMessage?: string }> {
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(bodyParams)) {
    form.set(k, String(v));
  }

  const res = await fetch(`${baseUrl}/${encodeURIComponent(igUserId)}/media`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body: form.toString()
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok || !data?.id) {
    if (Number(data?.error?.code) === 190) {
      return {
        ok: false,
        errorMessage:
          'O Token de Acesso da Meta (NUXT_IG_ACCESS_TOKEN) expirou. Gere o token estendido (60 dias) no Meta Developers e atualize no .env / Vercel.'
      };
    }
    const metaMsg = String(data?.error?.error_user_msg || data?.error?.message || '').slice(0, 180);
    return { ok: false, errorMessage: metaMsg || 'Falha ao criar container de mídia na Meta.' };
  }

  return { ok: true, id: String(data.id) };
}

export async function publishToInstagramGraph(
  input: InstagramPublishInput,
  config: InstagramServerConfig
): Promise<InstagramPublishResult> {
  const imageUrls = validateStagingImageUrls(
    input.imageUrls,
    config.firebaseStorageBucket,
    Boolean(config.allowLocalMockUrls)
  );
  const caption = sanitizeInstagramCaption(input.caption);
  if (!caption) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A legenda da publicação não pode estar vazia.'
    });
  }

  const { baseUrl, igUserId, accessToken } = resolveGraphBaseUrl(config);
  const userTags = normalizeUserTags(input.userTags);
  let tagsApplied = userTags.length > 0;

  let publishableContainerId = '';

  if (imageUrls.length === 1) {
    // Publicação de imagem única (IMAGE)
    const singleParams: Record<string, string | boolean> = {
      image_url: imageUrls[0],
      caption
    };
    if (userTags.length > 0) {
      singleParams.user_tags = JSON.stringify(userTags);
    }

    let created = await createMediaContainerRequest(baseUrl, igUserId, accessToken, singleParams);
    if (!created.ok && userTags.length > 0) {
      // Fallback automático caso o perfil público marcado tenha restringido marcações em fotos
      tagsApplied = false;
      delete singleParams.user_tags;
      created = await createMediaContainerRequest(baseUrl, igUserId, accessToken, singleParams);
    }

    if (!created.ok || !created.id) {
      throw createError({
        statusCode: 502,
        statusMessage: created.errorMessage || 'Não foi possível preparar a imagem no Instagram.'
      });
    }

    publishableContainerId = created.id;
    await waitForContainerReady(baseUrl, publishableContainerId, accessToken);
  } else {
    // Publicação de Carrossel (2 a 9 imagens — CAROUSEL)
    const childIds: string[] = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const childParams: Record<string, string | boolean> = {
        image_url: imageUrls[i],
        is_carousel_item: true
      };
      if (tagsApplied && userTags.length > 0) {
        childParams.user_tags = JSON.stringify(userTags);
      }

      let childCreated = await createMediaContainerRequest(baseUrl, igUserId, accessToken, childParams);
      if (!childCreated.ok && tagsApplied && userTags.length > 0) {
        tagsApplied = false;
        delete childParams.user_tags;
        childCreated = await createMediaContainerRequest(baseUrl, igUserId, accessToken, childParams);
      }

      if (!childCreated.ok || !childCreated.id) {
        throw createError({
          statusCode: 502,
          statusMessage:
            childCreated.errorMessage || `Falha ao enviar o slide ${i + 1} para o Instagram.`
        });
      }

      childIds.push(childCreated.id);
    }

    for (const childId of childIds) {
      await waitForContainerReady(baseUrl, childId, accessToken);
    }

    const carouselCreated = await createMediaContainerRequest(baseUrl, igUserId, accessToken, {
      media_type: 'CAROUSEL',
      children: childIds.join(','),
      caption
    });

    if (!carouselCreated.ok || !carouselCreated.id) {
      throw createError({
        statusCode: 502,
        statusMessage:
          carouselCreated.errorMessage || 'Falha ao agrupar o carrossel no Instagram.'
      });
    }

    publishableContainerId = carouselCreated.id;
    await waitForContainerReady(baseUrl, publishableContainerId, accessToken);
  }

  // Dispara `media_publish`
  const publishForm = new URLSearchParams();
  publishForm.set('creation_id', publishableContainerId);

  const publishRes = await fetch(`${baseUrl}/${encodeURIComponent(igUserId)}/media_publish`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body: publishForm.toString()
  });

  const publishData = (await publishRes.json().catch(() => ({}))) as Record<string, any>;
  if (!publishRes.ok || !publishData?.id) {
    const metaErr = String(
      publishData?.error?.error_user_msg || publishData?.error?.message || ''
    ).slice(0, 180);
    throw createError({
      statusCode: 502,
      statusMessage: metaErr || 'Não foi possível concluir a publicação no Instagram.'
    });
  }

  const mediaId = String(publishData.id);
  let permalink = 'https://www.instagram.com/pcdvale/';

  try {
    const permalinkRes = await fetch(
      `${baseUrl}/${encodeURIComponent(mediaId)}?fields=id,permalink`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json'
        }
      }
    );
    if (permalinkRes.ok) {
      const permalinkJson = (await permalinkRes.json().catch(() => ({}))) as Record<string, any>;
      if (
        typeof permalinkJson?.permalink === 'string' &&
        permalinkJson.permalink.startsWith('https://')
      ) {
        permalink = permalinkJson.permalink;
      }
    }
  } catch {}

  return {
    mediaId,
    permalink,
    tagsApplied
  };
}
