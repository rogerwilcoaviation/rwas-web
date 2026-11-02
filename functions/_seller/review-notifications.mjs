const PATH = '/api/aircraft-sale/review-notifications';
const json = (body, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

// Public HTTP carries only an expiring one-use capability. The private RPC
// supplies canonical text and consumes the capability before any Teams send.
// No caller can select a recipient, URL, channel or message body.
export async function reviewNotification(request, env) {
  if (new URL(request.url).pathname !== PATH) return null;
  if (request.method !== 'POST')
    return json({ error: 'Method not allowed.' }, 405);
  if (
    new URL(request.url).origin !== 'https://www.rogerwilcoaviation.com' ||
    env.INTAKE_STAGING_MODE === 'true'
  )
    return json({ error: 'Production destination required.' }, 503);
  if (!env.TEAMS_RELAY_TOKEN || !env.SELLER_API?.claimReviewNotification)
    return json({ error: 'Notification service unavailable.' }, 503);
  if (
    !(request.headers.get('Content-Type') || '').startsWith(
      'application/json',
    ) ||
    Number(request.headers.get('Content-Length') || 0) > 512
  )
    return json({ error: 'Invalid notification.' }, 400);
  let body;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 512) throw Error();
    body = JSON.parse(raw);
    if (
      !body ||
      Object.keys(body).join(',') !== 'ticket' ||
      typeof body.ticket !== 'string' ||
      body.ticket.length > 100
    )
      throw Error();
  } catch {
    return json({ error: 'Invalid notification.' }, 400);
  }
  let claimed;
  try {
    claimed = await env.SELLER_API.claimReviewNotification({
      ticket: body.ticket,
    });
  } catch {
    return json({ error: 'Notification service unavailable.' }, 503);
  }
  if (
    claimed.status !== 200 ||
    claimed.target !== 'Shop Talk' ||
    typeof claimed.text !== 'string' ||
    claimed.text.length > 3000 ||
    !/^aviation-review\/[a-f0-9-]{36}:\d{1,10}$/.test(
      claimed.notificationId || '',
    )
  )
    return json({ error: 'Notification ticket unavailable.' }, 409);
  try {
    const response = await (
      env.LISTING_TEAMS_FETCH?.fetch?.bind(env.LISTING_TEAMS_FETCH) || fetch
    )('https://teamsbot.rwas.team/post', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + env.TEAMS_RELAY_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: 'Shop Talk',
        text: claimed.text,
        requestId: claimed.notificationId + '/teams',
        idempotencyKey: claimed.notificationId + '/teams',
      }),
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      return json(
        { delivered: false, notificationId: claimed.notificationId },
        502,
      );
    return json({ delivered: true, notificationId: claimed.notificationId });
  } catch {
    return json(
      { delivered: false, notificationId: claimed.notificationId },
      502,
    );
  }
}
