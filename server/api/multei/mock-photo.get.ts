import { createError, defineEventHandler, getQuery, setResponseHeaders } from 'h3';
import { MOCK_BH_SCENES, renderMockBhSceneSvg } from '../../../app/mocks/firebase/mockPhotos.bh';

const SCENE_KEY_PATTERN = /^[a-z0-9-]{2,60}$/;

export default defineEventHandler((event) => {
  if (!import.meta.dev && process.env.NODE_ENV !== 'development') {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found'
    });
  }

  const query = getQuery(event);
  const rawScene = typeof query.scene === 'string' ? query.scene.trim().toLowerCase() : '';

  if (!rawScene || !SCENE_KEY_PATTERN.test(rawScene) || !Object.prototype.hasOwnProperty.call(MOCK_BH_SCENES, rawScene)) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Mock scene not found'
    });
  }

  const svg = renderMockBhSceneSvg(rawScene);

  setResponseHeaders(event, {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'"
  });

  return svg;
});
