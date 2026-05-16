/*
 * Cloudflare Pages Function — /api/track
 *
 * Receives anonymous RWAS analytics beacons from public/rwas-analytics.js.
 * This intentionally stores nothing by itself; events are emitted as
 * structured logs so Cloudflare runtime logs can be used as the first RUM
 * source without adding a database or exposing visitor PII.
 */

type TrackPayload = {
  sessionId?: string;
  event?: string;
  feature?: string;
  path?: string;
  referrer?: string;
  device?: string;
  metric?: string;
  value?: number;
  rating?: string;
  visibilityState?: string;
  navigationType?: string;
  transferSize?: number;
  element?: string;
  url?: string;
  size?: number;
};

type Ctx = { request: Request };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function cleanString(value: unknown, max = 240): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function cleanNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalize(payload: TrackPayload, request: Request) {
  const url = new URL(request.url);
  const event = cleanString(payload.event || 'event', 40);
  return {
    kind: 'rwas_analytics',
    ts: new Date().toISOString(),
    event,
    sessionId: /^rwas_[a-z0-9_-]{12,80}$/i.test(payload.sessionId || '')
      ? payload.sessionId
      : '',
    feature: cleanString(payload.feature, 80),
    path: cleanString(payload.path || url.pathname, 240),
    referrer: cleanString(payload.referrer, 500),
    device: cleanString(payload.device, 30),
    metric: cleanString(payload.metric, 20),
    value: cleanNumber(payload.value),
    rating: cleanString(payload.rating, 30),
    visibilityState: cleanString(payload.visibilityState, 30),
    navigationType: cleanString(payload.navigationType, 30),
    transferSize: cleanNumber(payload.transferSize),
    element: cleanString(payload.element, 40),
    lcpUrl: cleanString(payload.url, 500),
    size: cleanNumber(payload.size),
    userAgent: cleanString(request.headers.get('user-agent') || '', 300),
    country: cleanString(request.headers.get('cf-ipcountry') || '', 8),
  };
}

export const onRequestPost = async ({ request }: Ctx) => {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return jsonResponse({ error: 'expected application/json' }, 415);
  }

  let payload: TrackPayload;
  try {
    payload = (await request.json()) as TrackPayload;
  } catch {
    return jsonResponse({ error: 'invalid json' }, 400);
  }

  const event = normalize(payload, request);
  if (!event.event || event.event.length > 40) {
    return jsonResponse({ error: 'invalid event' }, 400);
  }

  console.log(JSON.stringify(event));
  return new Response(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  });
};

export const onRequestOptions = async () =>
  new Response(null, {
    status: 204,
    headers: {
      Allow: 'POST, OPTIONS',
      'Cache-Control': 'no-store',
    },
  });
