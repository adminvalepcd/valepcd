import {
  enforceAdminRateLimit,
  enforceSameOriginPostRequest,
  requireMulteiAdminAuth
} from '../../../utils/multeiAdminAuth';
import {
  publishToInstagramGraph,
  type InstagramServerConfig,
  type InstagramUserTagInput
} from '../../../utils/instagramGraph';

export default defineEventHandler(async (event) => {
  enforceSameOriginPostRequest(event);
  enforceAdminRateLimit(event, 'ig_publish', 10, 60_000);
  await requireMulteiAdminAuth(event);

  const body = (await readBody<Record<string, unknown>>(event).catch(() => null)) || {};
  const runtimeConfig = useRuntimeConfig(event);

  const igConfig: InstagramServerConfig = {
    igUserId: String(runtimeConfig.igUserId || ''),
    igAccessToken: String(runtimeConfig.igAccessToken || ''),
    igGraphVersion: String(runtimeConfig.igGraphVersion || 'v27.0'),
    firebaseStorageBucket: String(
      runtimeConfig.public?.firebaseStorageBucket || process.env.FIREBASE_STORAGE_BUCKET || ''
    ),
    allowLocalMockUrls: false
  };

  const rawTags = Array.isArray(body.userTags) ? (body.userTags as InstagramUserTagInput[]) : [];

  const result = await publishToInstagramGraph(
    {
      imageUrls: Array.isArray(body.imageUrls) ? (body.imageUrls as string[]) : [],
      caption: typeof body.caption === 'string' ? body.caption : '',
      userTags: rawTags
    },
    igConfig
  );

  return {
    ok: true,
    mediaId: result.mediaId,
    permalink: result.permalink,
    tagsApplied: result.tagsApplied
  };
});
