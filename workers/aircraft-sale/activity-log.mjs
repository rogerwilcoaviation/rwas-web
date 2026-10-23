// Separate from business state and moderation audit. No request/response bodies,
// query strings, cookies, tokens, IP addresses or arbitrary client text enter here.
export const ACTIVITY_RETENTION_DAYS = 90;
export const ACTIVITY_MAX_ROWS = 100000;
const DAY = 86400000;
const id = (v) =>
  typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v) ? v : '';
const uuid = (v) =>
  typeof v === 'string' && /^[a-f0-9-]{36}$/i.test(v) ? v : '';
const fail = (status, message) => {
  throw Object.assign(Error(message), { status });
};
export function activityPage(path) {
  if (typeof path !== 'string' || path.includes('?') || path.includes('#'))
    return null;
  if (
    ['/aircraft-for-sale', '/aircraft-for-sale/', '/aircraft4sale'].includes(
      path,
    )
  )
    return '/aircraft-for-sale';
  return /^\/aircraft-for-sale\/[A-Za-z0-9_-]{1,128}\/?$/.test(path)
    ? path.replace(/\/$/, '')
    : null;
}
export function activityRoute(request) {
  const path = new URL(request.url).pathname
    .replace(/^\/api\/aircraft-sale/, '')
    .replace(/^\/staff\//, '/admin/');
  if (/^\/(?:_|health$|activity(?:\/|$))/.test(path)) return null;
  const parts = path.split('/').filter(Boolean).slice(0, 8);
  const staticParts = new Set([
    'auth',
    'methods',
    'start',
    'finish',
    'link',
    'owner',
    'logout',
    'better-auth',
    'clerk-production',
    'auth0-events',
    'events',
    'send-code',
    'check-code',
    'browse',
    'listing',
    'listings',
    'status',
    'contact',
    'buyer',
    'photos',
    'order',
    'upload',
    'delete-file',
    'files',
    'file',
    'draft',
    'autosave',
    'intake',
    'my-listings',
    'account',
    'access',
    'sessions',
    'email',
    'email-code',
    'admin',
    'activity',
    'current',
    'review',
    'accounts',
    'preview',
    'apply',
    'research',
    'administrators',
    'removals',
    'support',
    'auth0-event-receipts',
  ]);
  let resourceId = '';
  const route =
    '/' +
    parts
      .map((part, index) => {
        if (staticParts.has(part)) return part;
        if (
          index > 0 &&
          [
            'listing',
            'listings',
            'accounts',
            'support',
            'contact',
            'activity',
          ].includes(parts[index - 1]) &&
          id(part)
        ) {
          resourceId = part;
          return ':id';
        }
        return ':value';
      })
      .join('/');
  const names = {
    'GET /browse': 'Browse listings',
    'GET /listing/:id': 'View listing',
    'POST /listings': 'Create listing',
    'PUT /listings/:id': 'Edit listing',
    'DELETE /listings/:id': 'Permanently delete listing',
    'POST /listing/:id/status': 'Change listing status',
    'GET /listing/:id/contact': 'Contact seller',
    'GET /buyer/contact/:id': 'Request seller contact information',
    'GET /draft': 'Open saved draft',
    'PUT /draft': 'Save draft',
    'PUT /draft/autosave': 'Autosave draft',
    'POST /intake': 'Jerry listing conversation',
    'GET /my-listings': 'Open user listings',
    'POST /upload': 'Upload listing file',
    'POST /delete-file': 'Delete listing file',
    'GET /account': 'Open account',
    'PATCH /account': 'Edit account',
    'DELETE /account': 'Delete own account',
    'POST /logout': 'Sign out',
    'POST /auth/better-auth': 'Connect verified sign-in',
    'POST /admin/review': 'Review listing',
    'GET /admin/activity': 'Read activity log',
    'GET /admin/activity/current': 'Read saved Jerry reports',
    'GET /admin/activity/:id': 'Read activity details',
    'GET /admin/accounts': 'Search user accounts',
    'GET /admin/accounts/:id': 'Open user account',
    'POST /admin/accounts/:id/apply': 'Manage user account',
    'POST /admin/removals/apply': 'Permanently delete account',
  };
  return {
    route,
    resourceId,
    action:
      names[request.method + ' ' + route] ||
      request.method.toLowerCase() + ' ' + route,
  };
}
export function activityActor(profile) {
  if (!profile) return { type: 'anonymous', id: '', email: '' };
  return {
    type: 'account',
    id: id(profile.id || profile.subject),
    email:
      typeof profile.email === 'string' && profile.email.length <= 254
        ? profile.email
        : '',
  };
}
export function activityOutcome(status) {
  return status >= 400 ? 'failure' : status >= 300 ? 'redirect' : 'success';
}
export function safeAuditDetails(details = {}) {
  const out = {};
  for (const key of [
    'listingId',
    'accountId',
    'targetId',
    'ticketId',
    'status',
    'decision',
    'recommendation',
    'kind',
    'operationId',
    'subject',
    'operation',
    'role',
    'reasonCode',
  ])
    if (id(details[key])) out[key] = details[key];
  for (const key of ['revision', 'count', 'deletedListings', 'identityCount'])
    if (Number.isSafeInteger(details[key]) && details[key] >= 0)
      out[key] = details[key];
  return out;
}
const actions = new Set([
  'page.view',
  'page.leave',
  'control.click',
  'field.change',
  'form.submit',
  'draft.step',
  'chat.request',
  'client.error',
  'request.network-error',
]);
const controls = new Set([
  'create-listing',
  'resume-draft',
  'manual',
  'jerry',
  'sign-in',
  'sign-out',
  'create-account',
  'forgot-password',
  'save-draft',
  'continue',
  'back',
  'review-draft',
  'submit-listing',
  'contact-seller',
  'refresh',
  'filter',
  'tab',
  'link',
  'button',
  'field',
  'form',
  'photo',
  'upload',
  'delete',
  'approve',
  'reject',
  'close',
  'chat-send',
]);
const contexts = new Set([
  'marketplace',
  'listing',
  'account',
  'admin',
  'login',
  'signup',
  'draft',
  'jerry',
]);
export function browserActivity(body, now = Date.now()) {
  if (
    !body ||
    !Array.isArray(body.events) ||
    !body.events.length ||
    body.events.length > 20 ||
    Object.keys(body).some((k) => k !== 'events')
  )
    fail(400, 'Invalid activity batch.');
  return body.events.map((event) => {
    if (
      !event ||
      !actions.has(event.action) ||
      !activityPage(event.page) ||
      Object.keys(event).some(
        (k) =>
          ![
            'action',
            'page',
            'control',
            'context',
            'step',
            'clientAt',
            'requestId',
            'status',
            'durationMs',
            'errorKind',
            'viewport',
            'accountRef',
          ].includes(k),
      )
    )
      fail(400, 'Invalid marketplace activity.');
    if (event.control !== undefined && !controls.has(event.control))
      fail(400, 'Invalid activity control.');
    if (event.context !== undefined && !contexts.has(event.context))
      fail(400, 'Invalid activity context.');
    if (
      event.accountRef !== undefined &&
      event.accountRef !== '' &&
      !id(event.accountRef)
    )
      fail(400, 'Invalid activity account reference.');
    const details = {};
    for (const key of ['control', 'context'])
      if (event[key]) details[key] = event[key];
    if (Number.isInteger(event.step) && event.step >= 0 && event.step <= 300)
      details.step = event.step;
    if (
      [
        'network-error',
        'unhandled-error',
        'unhandled-rejection',
        'resource-error',
      ].includes(event.errorKind)
    )
      details.errorKind = event.errorKind;
    if (['small', 'medium', 'large'].includes(event.viewport))
      details.viewport = event.viewport;
    return {
      accountRef: event.accountRef,
      at: now,
      clientAt:
        Number.isFinite(event.clientAt) && Math.abs(now - event.clientAt) <= DAY
          ? event.clientAt
          : null,
      action: event.action,
      route: activityPage(event.page),
      source: 'browser',
      result: event.action.includes('error')
        ? 'failure'
        : event.action === 'chat.request' && Number.isInteger(event.status)
          ? activityOutcome(event.status)
          : 'observed',
      status:
        Number.isInteger(event.status) &&
        event.status >= 100 &&
        event.status <= 599
          ? event.status
          : null,
      durationMs: Number.isFinite(event.durationMs)
        ? Math.max(0, Math.min(3600000, Math.round(event.durationMs)))
        : null,
      relatedRequestId: uuid(event.requestId),
      details,
    };
  });
}
export class ActivityLog {
  constructor(storage) {
    this.storage = storage;
  }
  init() {
    if (!this.storage.sql || this.ready) return;
    this.storage.sql.exec(
      'CREATE TABLE IF NOT EXISTS exchange_activity (seq INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, value TEXT NOT NULL)',
    );
    this.storage.sql.exec(
      'CREATE INDEX IF NOT EXISTS exchange_activity_at ON exchange_activity(at)',
    );
    this.storage.sql.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS exchange_activity_id ON exchange_activity(json_extract(value,'$.id'))",
    );
    this.storage.sql.exec(
      "CREATE INDEX IF NOT EXISTS exchange_activity_conversation ON exchange_activity(json_extract(value,'$.details.conversation.id'), json_extract(value,'$.actor.id'))",
    );
    this.ready = true;
  }
  async append(events, now = Date.now()) {
    const rows = events.map((event) => ({
      id: crypto.randomUUID(),
      ...event,
      at: event.at || now,
    }));
    this.init();
    if (this.storage.sql) {
      for (const row of rows)
        this.storage.sql.exec(
          'INSERT INTO exchange_activity(at,value) VALUES (?,?)',
          row.at,
          JSON.stringify(row),
        );
      // Bounded and indexed; independent of the business-state snapshot writer.
      this.storage.sql.exec(
        'DELETE FROM exchange_activity WHERE at < ?',
        now - ACTIVITY_RETENTION_DAYS * DAY,
      );
      this.storage.sql.exec(
        'DELETE FROM exchange_activity WHERE seq <= (SELECT max(seq) FROM exchange_activity) - ?',
        ACTIVITY_MAX_ROWS,
      );
    } else {
      const old = (await this.storage.get('exchange-activity')) || [];
      await this.storage.put(
        'exchange-activity',
        [...old, ...rows]
          .filter((row) => row.at >= now - ACTIVITY_RETENTION_DAYS * DAY)
          .slice(-ACTIVITY_MAX_ROWS),
      );
    }
  }
  async get(eventId, now = Date.now()) {
    if (!uuid(eventId)) fail(400, 'Invalid activity event.');
    this.init();
    const event = this.storage.sql
      ? this.storage.sql
          .exec(
            "SELECT value FROM exchange_activity WHERE json_extract(value,'$.id') = ? AND at >= ? LIMIT 1",
            eventId,
            now - ACTIVITY_RETENTION_DAYS * DAY,
          )
          .toArray()
          .map((row) => JSON.parse(row.value))[0]
      : ((await this.storage.get('exchange-activity')) || []).find(
          (row) =>
            row.id === eventId && row.at >= now - ACTIVITY_RETENTION_DAYS * DAY,
        );
    if (!event) fail(404, 'This activity event is no longer retained.');
    return event;
  }
  async conversation(conversationId, actorId, now = Date.now()) {
    this.init();
    const rows = this.storage.sql
      ? this.storage.sql
          .exec(
            "SELECT value FROM exchange_activity WHERE json_extract(value,'$.details.conversation.id') = ? AND json_extract(value,'$.actor.id') = ? AND at >= ? ORDER BY seq DESC LIMIT 100",
            conversationId,
            actorId,
            now - ACTIVITY_RETENTION_DAYS * DAY,
          )
          .toArray()
          .map((row) => JSON.parse(row.value))
          .reverse()
      : ((await this.storage.get('exchange-activity')) || [])
          .filter(
            (row) =>
              row.details?.conversation?.id === conversationId &&
              row.actor.id === actorId &&
              row.at >= now - ACTIVITY_RETENTION_DAYS * DAY,
          )
          .slice(-100);
    return rows.map((row) => ({
      id: row.id,
      at: row.at,
      requestId: row.requestId,
      source: row.source,
      result: row.result,
      ...row.details.conversation,
    }));
  }
  async query(url, now = Date.now()) {
    const allowed = [
      'q',
      'result',
      'source',
      'from',
      'to',
      'cursor',
      'limit',
      'type',
    ];
    if ([...url.searchParams.keys()].some((k) => !allowed.includes(k)))
      fail(400, 'Invalid activity filter.');
    const p = url.searchParams,
      q = (p.get('q') || '').trim().toLowerCase(),
      result = p.get('result') || 'all',
      source = p.get('source') || 'all',
      type = p.get('type') || 'all';
    const limit = Number(p.get('limit') || 50),
      cursor = Number(p.get('cursor') || Number.MAX_SAFE_INTEGER);
    const date = (key, fallback) =>
      p.has(key) ? Date.parse(p.get(key)) : fallback;
    const from = date('from', now - ACTIVITY_RETENTION_DAYS * DAY),
      to = date('to', now);
    if (
      q.length > 100 ||
      !['all', 'success', 'failure', 'redirect', 'observed'].includes(result) ||
      !['all', 'server', 'browser', 'system'].includes(source) ||
      !['all', 'conversation', 'review'].includes(type) ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      !Number.isSafeInteger(cursor) ||
      cursor < 1 ||
      !Number.isFinite(from) ||
      !Number.isFinite(to) ||
      from > to
    )
      fail(400, 'Invalid activity filter.');
    this.init();
    let rows;
    if (this.storage.sql) {
      const where = ['seq < ?', 'at >= ?', 'at <= ?'],
        args = [
          cursor,
          Math.max(from, now - ACTIVITY_RETENTION_DAYS * DAY),
          to,
        ];
      if (result !== 'all') {
        where.push("json_extract(value,'$.result') = ?");
        args.push(result);
      }
      if (source !== 'all') {
        where.push("json_extract(value,'$.source') = ?");
        args.push(source);
      }
      if (type === 'conversation')
        where.push("json_type(value,'$.details.conversation') = 'object'");
      if (type === 'review')
        where.push(
          "(json_type(value,'$.details.review') = 'object' OR json_extract(value,'$.action') = 'jerry.research')",
        );
      if (q) {
        where.push(
          "instr(lower(json_extract(value,'$.action') || ' ' || json_extract(value,'$.actor.id') || ' ' || json_extract(value,'$.actor.email') || ' ' || json_extract(value,'$.requestId') || ' ' || coalesce(json_extract(value,'$.resourceId'),'') || ' ' || json_extract(value,'$.details')), ?) > 0",
        );
        args.push(q);
      }
      rows = this.storage.sql
        .exec(
          'SELECT seq,value FROM exchange_activity WHERE ' +
            where.join(' AND ') +
            ' ORDER BY seq DESC LIMIT ?',
          ...args,
          limit + 1,
        )
        .toArray()
        .map((row) => ({ seq: row.seq, ...JSON.parse(row.value) }));
    } else {
      rows = ((await this.storage.get('exchange-activity')) || [])
        .map((row, i) => ({ seq: i + 1, ...row }))
        .reverse()
        .filter(
          (row) =>
            row.seq < cursor &&
            row.at >= Math.max(from, now - ACTIVITY_RETENTION_DAYS * DAY) &&
            row.at <= to &&
            (result === 'all' || row.result === result) &&
            (source === 'all' || row.source === source) &&
            (type === 'all' ||
              (type === 'conversation' && !!row.details?.conversation) ||
              (type === 'review' &&
                (!!row.details?.review || row.action === 'jerry.research'))) &&
            (!q ||
              [
                row.action,
                row.actor?.id,
                row.actor?.email,
                row.requestId,
                row.resourceId,
                JSON.stringify(row.details),
              ]
                .join(' ')
                .toLowerCase()
                .includes(q)),
        )
        .slice(0, limit + 1);
    }
    return {
      events: rows.slice(0, limit).map(({ seq, ...row }) => {
        const { conversation, review, ...details } = row.details || {};
        return {
          ...row,
          details,
          hasConversation: !!conversation,
          hasReview: !!review || row.action === 'jerry.research',
        };
      }),
      nextCursor: rows.length > limit ? String(rows[limit - 1].seq) : null,
      retentionDays: ACTIVITY_RETENTION_DAYS,
      maxRows: ACTIVITY_MAX_ROWS,
      recordedSince: 'deployment',
      serverTime: now,
    };
  }
}
