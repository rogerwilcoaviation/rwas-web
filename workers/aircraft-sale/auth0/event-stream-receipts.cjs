// LOCAL REVIEW CANDIDATE ONLY. No default subject, stream, endpoint or credential.
// Auth0 Event Stream Action (Node 22), not a Post Change Password Action.
const { createHash } = require('node:crypto');
const endpoint =
  'https://repair-aircraft-seller-workf.rwas-web.pages.dev/api/aircraft-sale/auth/auth0-events';
const windowMs = 300000;
const failure = () =>
  new Error('RWAS QA event delivery failed; scoped reconciliation required.');

function configuration(secrets) {
  const subject = secrets?.QA_AUTH0_SUBJECT;
  if (
    typeof subject !== 'string' ||
    !/^auth0\|[A-Za-z0-9._:-]{1,494}$/.test(subject) ||
    /replace|placeholder/i.test(subject) ||
    secrets.RWAS_SECURITY_EVENT_URL !== endpoint ||
    secrets.AUTH_EVENT_TENANT !== 'dev-enkgj0dnenb3r4f8' ||
    typeof secrets.AUTH_EVENT_SOURCE !== 'string' ||
    !/^urn:auth0:[A-Za-z0-9.:_-]{1,200}$/.test(secrets.AUTH_EVENT_SOURCE) ||
    typeof secrets.AUTH_EVENT_STREAM_ID !== 'string' ||
    !/^est_[A-Za-z0-9]{22}$/.test(secrets.AUTH_EVENT_STREAM_ID) ||
    typeof secrets.AUTH_STREAM_SECRET !== 'string' ||
    secrets.AUTH_STREAM_SECRET.length < 32 ||
    secrets.AUTH_STREAM_SECRET.length > 4096 ||
    /[\r\n]/.test(secrets.AUTH_STREAM_SECRET)
  )
    throw failure();
  return {
    subject,
    tenant: secrets.AUTH_EVENT_TENANT,
    source: secrets.AUTH_EVENT_SOURCE,
    stream: secrets.AUTH_EVENT_STREAM_ID,
    secret: secrets.AUTH_STREAM_SECRET,
  };
}

function eventTime(value) {
  if (typeof value !== 'string') return NaN;
  const parts =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!parts) return NaN;
  const [, year, month, day, hour, minute, second, zone] = parts;
  const calendar = new Date(Date.UTC(+year, +month - 1, +day));
  if (
    +year < 2000 ||
    calendar.getUTCFullYear() !== +year ||
    calendar.getUTCMonth() !== +month - 1 ||
    calendar.getUTCDate() !== +day ||
    +hour > 23 ||
    +minute > 59 ||
    +second > 59 ||
    (zone !== 'Z' && (+zone.slice(1, 3) > 23 || +zone.slice(4) > 59))
  )
    return NaN;
  return Date.parse(value);
}

async function acknowledgement(response) {
  if (!response.body) return false;
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 4096) return false;
      chunks.push(value);
    }
    const buffer = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const body = JSON.parse(new TextDecoder().decode(buffer));
    return body !== null && !Array.isArray(body) && body.ok === true;
  } finally {
    try {
      await reader.cancel();
    } catch {}
    reader.releaseLock();
  }
}

// Injected dependencies are for offline tests only. Installed handler uses natives.
function createHandler({
  fetch = globalThis.fetch,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = (entry) => console.info(JSON.stringify(entry)),
} = {}) {
  const emit = (
    eventId,
    attempt,
    httpStatus,
    acknowledged,
    outcome,
    terminal,
  ) => {
    try {
      // Values originate only from fixed outcomes/numbers and a provider-event hash.
      log({
        event: 'rwas-qa-event-delivery',
        eventId,
        attempt,
        httpStatus,
        acknowledged,
        outcome,
        terminal,
      });
    } catch {}
  };
  return async function onExecuteEventStream(event) {
    const config = configuration(event?.secrets);
    const message = event?.message;
    if (!message || typeof message !== 'object' || Array.isArray(message))
      throw failure();
    if (message.type !== 'user.updated') return;
    const user = message.data?.object;
    if (!user || typeof user.user_id !== 'string') throw failure();
    // Never inspect previous snapshots, log, hash or send another subject's event.
    if (user.user_id !== config.subject) return;
    const issuedAt = eventTime(message.time);
    if (
      message.specversion !== '1.0' ||
      message.source !== config.source ||
      message.a0tenant !== config.tenant ||
      message.a0stream !== config.stream ||
      typeof message.id !== 'string' ||
      !/^evt_[A-Za-z0-9]{22}$/.test(message.id) ||
      !Number.isFinite(issuedAt) ||
      (message.data.previous_object?.user_id !== undefined &&
        message.data.previous_object.user_id !== config.subject) ||
      (user.blocked !== undefined && typeof user.blocked !== 'boolean')
    )
      throw failure();
    // Missing/false remain observational only; the receiver alone applies explicit true.
    const blockedPresent = Object.hasOwn(user, 'blocked');
    const eventId =
      'a0_' +
      createHash('sha256')
        .update(JSON.stringify([config.tenant, config.stream, message.id]))
        .digest('hex');
    // Explicit projection: never spread input or serialize any provider snapshot.
    const projectedUser = { user_id: config.subject, blockedPresent };
    if (blockedPresent) projectedUser.blocked = user.blocked;
    const body = JSON.stringify({
      specversion: '1.0',
      type: 'user.updated',
      source: config.source,
      a0tenant: config.tenant,
      a0stream: config.stream,
      id: message.id,
      time: message.time,
      data: { object: projectedUser },
    });
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (Math.abs(now() - issuedAt) > windowMs) {
        emit(eventId, attempt, null, false, 'event-expired', true);
        throw failure();
      }
      let httpStatus = null,
        outcome = 'transport-failure',
        terminal = false;
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          redirect: 'error',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          headers: {
            'Content-Type': 'application/cloudevents+json',
            Authorization: 'Bearer ' + config.secret,
          },
          body,
          signal: AbortSignal.timeout(3000),
        });
        if (
          !Number.isInteger(response.status) ||
          response.status < 100 ||
          response.status > 599
        )
          throw failure();
        httpStatus = response.status;
        if (response.ok) {
          outcome = 'bad-acknowledgement';
          if (await acknowledgement(response)) {
            emit(eventId, attempt, httpStatus, true, 'acknowledged', true);
            return;
          }
        } else {
          terminal = httpStatus < 500 && ![408, 429].includes(httpStatus);
          outcome = terminal ? 'http-terminal' : 'http-transient';
          try {
            await response.body?.cancel();
          } catch {}
        }
      } catch {
        // No response body, headers, URL, input fields or exception text in logs.
      }
      emit(
        eventId,
        attempt,
        httpStatus,
        false,
        outcome,
        terminal || attempt === 3,
      );
      if (terminal || attempt === 3) throw failure();
      await sleep(attempt * 250);
    }
  };
}
exports.onExecuteEventStream = createHandler();
exports.createHandler = createHandler;
