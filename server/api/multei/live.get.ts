import {
  getMulteiLiveEventsSince,
  subscribeMulteiLiveEvents,
  type MulteiLiveEvent
} from '../../utils/multeiLiveBus';

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff');
  setResponseHeader(event, 'X-Frame-Options', 'DENY');

  const query = getQuery(event);
  const lastEventIdHeader = getRequestHeader(event, 'last-event-id');
  const rawSince = query.since ?? lastEventIdHeader ?? '0';
  const sinceId = Number.parseInt(String(rawSince), 10);
  const safeSinceId = Number.isFinite(sinceId) && sinceId > 0 ? sinceId : 0;

  const acceptHeader = getRequestHeader(event, 'accept') || '';
  const isPollMode = String(query.mode || '') === 'poll' || !acceptHeader.includes('text/event-stream');

  // Modo Poll leve (JSON) para fallback ou reconciliação rápida em ambientes Serverless
  if (isPollMode) {
    setResponseHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate');
    const { latestId, events } = getMulteiLiveEventsSince(safeSinceId);
    return {
      ok: true,
      latestId,
      events
    };
  }

  // Modo SSE (Server-Sent Events) em tempo real
  setResponseHeader(event, 'Content-Type', 'text/event-stream; charset=utf-8');
  setResponseHeader(event, 'Cache-Control', 'no-cache, no-transform');
  setResponseHeader(event, 'Connection', 'keep-alive');
  setResponseHeader(event, 'X-Accel-Buffering', 'no');

  const res = event.node.res;
  const req = event.node.req;

  res.writeHead(200);

  const writeSseEvent = (eventName: string, data: unknown, id?: number) => {
    if (res.writableEnded || res.destroyed) return;
    if (typeof id === 'number') {
      res.write(`id: ${id}\n`);
    }
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const { latestId, events: missedEvents } = getMulteiLiveEventsSince(safeSinceId);

  // Confirma conexão e informa o ID atual do servidor
  writeSseEvent('connected', { latestId }, latestId);

  // Caso o cliente tenha reconectado com Last-Event-ID / ?since, entrega os deltas pendentes
  for (const missed of missedEvents) {
    writeSseEvent('multei-delta', missed, missed.id);
  }

  const unsubscribe = subscribeMulteiLiveEvents((liveEvt: MulteiLiveEvent) => {
    writeSseEvent('multei-delta', liveEvt, liveEvt.id);
  });

  const heartbeatTimer = setInterval(() => {
    if (res.writableEnded || res.destroyed) return;
    res.write(': keep-alive\n\n');
  }, 15_000);

  await new Promise<void>((resolve) => {
    const cleanup = () => {
      clearInterval(heartbeatTimer);
      unsubscribe();
      resolve();
    };

    req.on('close', cleanup);
    req.on('error', cleanup);
    res.on('close', cleanup);
  });
});
