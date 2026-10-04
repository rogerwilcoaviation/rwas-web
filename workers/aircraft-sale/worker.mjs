import {
  listingFields as fields,
  cleanListing as clean,
} from './listing-fields.mjs';
import {
  deliverCode,
  authorizeReviewer,
  authorizeOperator,
} from './adapters.mjs';
import {
  identityConfig,
  randomProof,
  authorizationUrl,
  exchangeIdentity,
  digest,
  logoutUrl,
} from './identity.mjs';
import { securityOperation, securityProposal } from './security.mjs';
import { hasProductSnippetEligibility } from '../../lib/product-snippet-eligibility.mjs';
// Versioned seller API. Requires explicitly provisioned Durable Object + private R2.
// No legacy KV fallback: migration/import is a separately reviewed operation.
const HOUR = 3600000,
  DAY = 86400000,
  MAX = 50 * 1024 * 1024;
const categories = [
  'photos',
  'videos',
  'airframe',
  'powerplant',
  'propeller',
  'adSbCompliance',
  'misc',
];
const empty = () => ({
  version: 2,
  profiles: {},
  identities: {},
  identitySecurity: {},
  authTransactions: {},
  authEvents: {},
  securityOperations: {},
  sessions: {},
  codes: {},
  rates: {},
  listings: {},
  drafts: {},
  files: {},
  idempotency: {},
  audit: [],
  outbox: {},
});
const reply = (data, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const hash = async (s) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)),
    ),
    (x) => x.toString(16).padStart(2, '0'),
  ).join('');
const token = () => crypto.randomUUID() + crypto.randomUUID();
const email = (s) => {
  if (
    typeof s !== 'string' ||
    !/^\S+@[^\s@]+\.[^\s@]+$/.test(s.trim()) ||
    s.length > 254
  )
    fail(400, 'Enter a valid email address.');
  return s.trim().toLowerCase();
};
const code = () => {
  const n = new Uint32Array(1);
  do {
    crypto.getRandomValues(n);
  } while (n[0] >= 4294000000);
  return String(n[0] % 1000000).padStart(6, '0');
};
function publicListing(l) {
  const {
    ownerId,
    fields,
    revision,
    approvedRevision,
    archiveFrom,
    deleteFrom,
    deletedAt,
    ...p
  } = l;
  return {
    ...p,
    logbooks: Object.fromEntries(
      Object.entries(p.logbooks || {}).map(([k, v]) => [
        k,
        { count: v.length },
      ]),
    ),
  };
}
const escape = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
export function aircraftProductSchema(listing) {
  if (!['active', 'sold'].includes(listing.status)) return null;
  const canonical =
    'https://www.rogerwilcoaviation.com/aircraft-for-sale/' +
    encodeURIComponent(listing.id);
  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: [listing.year, listing.make, listing.model].filter(Boolean).join(' '),
    url: canonical,
  };
  if (
    listing.price &&
    Number.isFinite(Number(listing.price)) &&
    Number(listing.price) > 0
  )
    product.offers = {
      '@type': 'Offer',
      url: canonical,
      price: Number(listing.price),
      priceCurrency: 'USD',
      availability:
        listing.status === 'sold'
          ? 'https://schema.org/OutOfStock'
          : 'https://schema.org/InStock',
    };
  return hasProductSnippetEligibility(product) ? product : null;
}
function publicPage(l) {
  const schema = aircraftProductSchema(l);
  const canonical =
    'https://www.rogerwilcoaviation.com/aircraft-for-sale/' +
    encodeURIComponent(l.id);
  const title = [l.year, l.make, l.model].filter(Boolean).join(' '),
    media =
      l.photos
        .map(
          (f) =>
            '<img src="/api/aircraft-sale/files/' +
            encodeURIComponent(f.key) +
            '" alt="' +
            escape(f.name) +
            '" loading="lazy">',
        )
        .join('') +
      l.videos
        .map(
          (f) =>
            '<video controls preload="metadata" src="/api/aircraft-sale/files/' +
            encodeURIComponent(f.key) +
            '"></video>',
        )
        .join('');
  const records = Object.values(l.logbooks || {}).reduce(
    (n, v) => n + v.count,
    0,
  );
  return new Response(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
      escape(title) +
      ' — RWAS Aircraft Marketplace</title><link rel="canonical" href="' +
      escape(canonical) +
      '">' +
      (schema
        ? '<script type="application/ld+json">' +
          JSON.stringify(schema).replace(/</g, '\\u003c') +
          '</script>'
        : '') +
      '<style>body{background:#f7f4ef;color:#222;max-width:1000px;margin:auto;padding:24px;font:18px Georgia,serif}h1{font-size:40px}a{color:inherit}img,video{width:100%;max-height:600px;object-fit:contain}main{display:grid;gap:20px}dl{display:grid;grid-template-columns:1fr 2fr}dd{margin:8px}dt{margin:8px}section{border-top:1px solid #aaa;padding:20px 0}</style></head><body><nav><a href="/aircraft-for-sale">← Aircraft for sale</a> · <a href="/">Roger Wilco Aviation</a></nav><main><header><p>RWAS Marketplace · ' +
      escape(l.status) +
      '</p><h1>' +
      escape(title) +
      '</h1><p>Asking price: $' +
      escape(Number(l.price).toLocaleString('en-US')) +
      '</p></header><section>' +
      media +
      '</section><section><h2>Aircraft details</h2><dl>' +
      [
        'nNumber',
        'serialNumber',
        'totalTime',
        'engineTime',
        'engineModel',
        'propTime',
        'annualDue',
        'usefulLoad',
      ]
        .filter((k) => l[k])
        .map((k) => '<dt>' + escape(k) + '</dt><dd>' + escape(l[k]) + '</dd>')
        .join('') +
      '</dl><p>' +
      escape(l.description) +
      '</p><h3>Avionics</h3><p>' +
      escape(l.avionics) +
      '</p><h3>Equipment</h3><p>' +
      escape(l.equipmentList) +
      '</p><h3>Damage history</h3><p>' +
      escape(l.damageHistory || 'Ask seller') +
      '</p></section><section><h2>Aircraft records</h2><p>' +
      records +
      ' private records held by the seller. Contact the seller to request records.</p></section><section><h2>Seller</h2><p>' +
      escape(l.sellerName) +
      ' · ' +
      escape(l.sellerLocation) +
      '</p><p>' +
      escape(l.sellerPhone) +
      '</p><a href="/contact?topic=aircraft-sales">Contact RWAS about this aircraft</a></section></main></body></html>',
    {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy':
          "default-src 'self'; style-src 'unsafe-inline'; img-src 'self'; media-src 'self'; frame-ancestors 'none'",
      },
    },
  );
}
const worker = {
  async fetch(request, env) {
    if (!env.SELLER_STORE)
      return reply({ error: 'Seller service is not configured.' }, 503);
    const id = env.SELLER_STORE.idFromName('seller-v2');
    return env.SELLER_STORE.get(id).fetch(request);
  },
};
export default worker;

export class SellerStore {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.queue = Promise.resolve();
    if (ctx.storage.sql)
      ctx.storage.sql.exec(
        'CREATE TABLE IF NOT EXISTS seller_records (bucket TEXT NOT NULL, record_key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(bucket, record_key))',
      );
  }
  fetch(req) {
    const operation = this.queue.then(() => this.run(req));
    this.queue = operation.catch(() => {});
    return operation;
  }
  async loadState() {
    if (!this.ctx.storage.sql)
      return (await this.ctx.storage.get('state')) || empty(); // memory fixture only
    const state = empty();
    for (const row of this.ctx.storage.sql
      .exec(
        "SELECT bucket, record_key, value FROM seller_records ORDER BY bucket, CASE WHEN bucket='audit' THEN CAST(record_key AS INTEGER) END, record_key",
      )
      .toArray()) {
      if (row.bucket === 'audit') state.audit.push(JSON.parse(row.value));
      else if (state[row.bucket] && typeof state[row.bucket] === 'object')
        state[row.bucket][row.record_key] = JSON.parse(row.value);
    }
    return state;
  }
  async saveState(state) {
    if (!this.ctx.storage.sql) return this.ctx.storage.put('state', state);
    const desired = new Map();
    for (const [bucket, values] of Object.entries(state)) {
      if (bucket === 'version') continue;
      for (const [key, value] of Object.entries(values))
        desired.set(bucket + ':' + key, {
          bucket,
          key,
          value: JSON.stringify(value),
        });
    }
    this.ctx.storage.transactionSync(() => {
      const existing = this.ctx.storage.sql
        .exec('SELECT bucket, record_key, value FROM seller_records')
        .toArray();
      for (const row of existing) {
        const id = row.bucket + ':' + row.record_key,
          next = desired.get(id);
        if (!next)
          this.ctx.storage.sql.exec(
            'DELETE FROM seller_records WHERE bucket=? AND record_key=?',
            row.bucket,
            row.record_key,
          );
        else if (next.value === row.value) desired.delete(id);
      }
      for (const row of desired.values())
        this.ctx.storage.sql.exec(
          'INSERT INTO seller_records(bucket,record_key,value) VALUES (?,?,?) ON CONFLICT(bucket,record_key) DO UPDATE SET value=excluded.value',
          row.bucket,
          row.key,
          row.value,
        );
    });
  }
  async run(req) {
    this.state = await this.loadState();
    this.rollbackState = structuredClone(this.state);
    try {
      const result = await this.route(req);
      await this.saveState(this.state);
      return result;
    } catch (e) {
      // Persist failed OTP attempts/rate counters, but roll back other partial writes.
      if (!e.persist) {
        for (const k of Object.keys(this.state.files))
          if (!this.rollbackState.files[k]) {
            try {
              await this.env.MEDIA.delete(k);
            } catch {}
          }
        this.state = this.rollbackState;
      }
      try {
        await this.saveState(this.state);
      } catch {}
      return reply(
        {
          error: e.status
            ? e.message
            : 'The request could not be saved. Please retry.',
        },
        e.status || 503,
      );
    }
  }
  async json(req) {
    if (Number(req.headers.get('content-length') || 0) > 64000)
      fail(413, 'Request too large.');
    const reader = req.body?.getReader();
    if (!reader) fail(400, 'Invalid JSON.');
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 64000) {
        await reader.cancel();
        fail(413, 'Request too large.');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const text = new TextDecoder().decode(bytes);
    try {
      return JSON.parse(text);
    } catch {
      fail(400, 'Invalid JSON.');
    }
  }
  audit(action, actor, details = {}) {
    this.state.audit.push({ at: Date.now(), action, actor, ...details });
  }
  async user(req, recent = false) {
    const raw = (req.headers.get('Authorization') || '').replace(
      /^Bearer /,
      '',
    );
    if (!raw) fail(401, 'Please sign in.');
    const key = await hash(raw),
      s = this.state.sessions[key];
    if (
      !s ||
      s.expiresAt <= Date.now() ||
      !this.state.profiles[s.userId] ||
      this.state.profiles[s.userId].disabled ||
      this.state.profiles[s.userId].identityBlocked
    )
      fail(401, 'Your session expired. Please sign in again.');
    if (recent && Date.now() - s.createdAt > 600000)
      fail(
        401,
        'Sign in again before changing your email or deleting your account.',
      );
    return { ...this.state.profiles[s.userId], sessionKey: key };
  }
  async admin(req) {
    const authorization = this.env.ADMIN_AUTH || {
      fetch: (request) => authorizeReviewer(request, this.env),
    };
    const result = await authorization.fetch(
      new Request('https://internal.invalid/authorize', {
        headers: {
          Authorization: req.headers.get('Authorization') || '',
          'Cf-Access-Jwt-Assertion':
            req.headers.get('Cf-Access-Jwt-Assertion') || '',
        },
      }),
    );
    if (!result.ok)
      fail(
        result.status === 503 ? 503 : 403,
        result.status === 503
          ? 'Administrative review is not configured.'
          : 'Administrative review required.',
      );
    return (await result.json()).actor || 'admin';
  }
  async operator(req) {
    const authorization = this.env.OPERATOR_AUTH || {
      fetch: (request) => authorizeOperator(request, this.env),
    };
    const result = await authorization.fetch(
      new Request('https://internal.invalid/authorize-security', {
        headers: {
          Authorization: req.headers.get('Authorization') || '',
          'Cf-Access-Jwt-Assertion':
            req.headers.get('Cf-Access-Jwt-Assertion') || '',
        },
      }),
    );
    if (!result.ok)
      fail(
        result.status === 503 ? 503 : 403,
        'Security operator authorization required.',
      );
    const identity = await result.json();
    if (
      identity.scope !== 'seller-security' ||
      typeof identity.actor !== 'string' ||
      !identity.actor ||
      identity.actor.length > 254 ||
      !Number.isFinite(identity.authenticatedAt) ||
      identity.authenticatedAt < Date.now() - 600000 ||
      identity.authenticatedAt > Date.now() + 30000
    )
      fail(403, 'Recent security operator authorization required.');
    return identity.actor;
  }
  owned(id, u) {
    const l = this.state.listings[id];
    if (!l || l.ownerId !== u.id) fail(404, 'Listing not found.');
    return l;
  }
  rate(key, limit) {
    const r = this.state.rates[key] || { start: Date.now(), count: 0 };
    if (Date.now() - r.start >= HOUR) {
      r.start = Date.now();
      r.count = 0;
    }
    if (r.count >= limit)
      fail(429, 'Too many attempts. Please wait and try again.');
    r.count++;
    this.state.rates[key] = r;
  }
  async sendCode(req, body, purpose = 'login', u) {
    const address = email(body.email);
    if (
      purpose === 'email-change' &&
      Object.values(this.state.profiles).some(
        (p) => p.email === address && p.id !== u.id,
      )
    )
      fail(409, 'This address cannot be used.');
    this.rate('global-email', 100);
    this.rate('email:' + address, 5);
    this.rate(
      'ip:' + (await hash(req.headers.get('CF-Connecting-IP') || 'local')),
      20,
    );
    // Commit throttling before external delivery: a storage outage must not send mail.
    await this.saveState(this.state);
    this.rollbackState = structuredClone(this.state);
    const value = code(),
      salt = token(),
      key = purpose + ':' + address;
    const pendingCode = {
      digest: await hash(salt + value),
      salt,
      createdAt: Date.now(),
      attempts: 0,
      userId: u?.id,
      purpose,
    };
    const delivery = this.env.MAILER || {
      fetch: async (request) => deliverCode(this.env, await request.json()),
    };
    let result;
    try {
      result = await delivery.fetch(
        new Request('https://internal.invalid/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: address,
            code: value,
            purpose,
            expiresMinutes: 15,
          }),
        }),
      );
    } catch {
      throw Object.assign(
        new Error('We could not send a code. Please try again later.'),
        { status: 503, persist: true },
      );
    }
    if (!result.ok)
      throw Object.assign(
        new Error('We could not send a code. Please try again later.'),
        { status: 503, persist: true },
      );
    this.state.codes[key] = pendingCode;
    return reply({ ok: true, sent: true });
  }
  async verify(address, value, purpose = 'login', u) {
    const key = purpose + ':' + address,
      e = this.state.codes[key];
    if (
      !e ||
      Date.now() - e.createdAt > 900000 ||
      e.attempts >= 5 ||
      (u && e.userId !== u.id)
    )
      fail(400, 'Code expired or unavailable. Request a new code.');
    e.attempts++;
    if (
      !/^\d{6}$/.test(String(value)) ||
      e.digest !== (await hash(e.salt + value))
    ) {
      const error = Object.assign(new Error('Incorrect code.'), {
        status: 400,
        persist: true,
      });
      throw error;
    }
    delete this.state.codes[key];
  }
  media(l) {
    return Object.values(this.state.files)
      .filter((f) => f.listingId === l.id)
      .map(({ ownerId, ...f }) => f);
  }
  hydrate(l) {
    const media = this.media(l);
    return {
      ...l,
      ...l.fields,
      photos: media
        .filter((f) => f.category === 'photos')
        .sort((a, b) => a.order - b.order),
      videos: media.filter((f) => f.category === 'videos'),
      logbooks: Object.fromEntries(
        categories
          .slice(2)
          .map((c) => [c, media.filter((f) => f.category === c)]),
      ),
    };
  }
  async sessionReply(profile, method = 'email-code') {
    const raw = token();
    this.state.sessions[await hash(raw)] = {
      userId: profile.id,
      createdAt: Date.now(),
      expiresAt: Date.now() + DAY,
      method,
    };
    return reply({
      ok: true,
      session: raw,
      name: profile.name,
      email: profile.email,
    });
  }
  async purge(l) {
    if (!this.env.MEDIA) fail(503, 'Media storage is unavailable.');
    if (!l.purging) {
      l.purging = true;
      for (const f of Object.values(this.state.files))
        if (f.listingId === l.id) f.deleting = true;
      await this.saveState(this.state);
      this.rollbackState = structuredClone(this.state);
    }
    let cursor;
    do {
      const page = await this.env.MEDIA.list({
        prefix: 'listings/' + l.id + '/',
        cursor,
      });
      for (const o of page.objects) await this.env.MEDIA.delete(o.key);
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    for (const [k, f] of Object.entries(this.state.files))
      if (f.listingId === l.id) delete this.state.files[k];
  }
  async route(req) {
    const url = new URL(req.url),
      path = url.pathname.replace(/^\/api\/aircraft-sale/, '') || '/',
      method = req.method;
    if (method === 'OPTIONS') return new Response(null, { status: 204 }); // Same-origin service; no wildcard CORS.
    if (path === '/health') return reply({ service: 'seller-v2', schema: 2 });
    if (path === '/auth/methods' && method === 'GET') {
      const config = identityConfig(this.env);
      return reply({ methods: config ? Object.keys(config.methods) : [] });
    }
    if (path === '/auth/start' && method === 'POST') {
      const config = identityConfig(this.env),
        body = await this.json(req);
      if (!config || !config.methods[body.method])
        fail(
          503,
          'This sign-in method is not available yet. Use an email code.',
        );
      if (
        url.origin !== config.origin ||
        (req.headers.get('Origin') &&
          req.headers.get('Origin') !== config.origin)
      )
        fail(403, 'Sign-in destination not allowed.');
      if (
        typeof body.proof !== 'string' ||
        !/^[A-Za-z0-9_-]{43,128}$/.test(body.proof)
      )
        fail(400, 'Invalid sign-in request.');
      const linkUser = body.link === true ? await this.user(req, true) : null;
      this.rate(
        'identity-ip:' +
          (await hash(req.headers.get('CF-Connecting-IP') || 'local')),
        20,
      );
      for (const [key, value] of Object.entries(this.state.authTransactions))
        if (Date.now() - value.createdAt > 600000)
          delete this.state.authTransactions[key];
      const tx = {
        state: randomProof(),
        nonce: randomProof(),
        verifier: randomProof(),
        browserProof: await digest(body.proof),
        method: body.method,
        createdAt: Date.now(),
        linkUserId: linkUser?.id || null,
        linkSessionKey: linkUser?.sessionKey || null,
      };
      this.state.authTransactions[await digest(tx.state)] = tx;
      return reply({
        state: tx.state,
        authorizationUrl: await authorizationUrl(config, tx),
      });
    }
    if (path === '/auth/finish' && method === 'POST') {
      const config = identityConfig(this.env),
        body = await this.json(req);
      if (
        !config ||
        url.origin !== config.origin ||
        (req.headers.get('Origin') &&
          req.headers.get('Origin') !== config.origin)
      )
        fail(403, 'Sign-in destination not allowed.');
      if (typeof body.state !== 'string' || typeof body.proof !== 'string')
        fail(400, 'Invalid sign-in response.');
      const key = await digest(body.state),
        tx = this.state.authTransactions[key];
      if (
        !tx ||
        Date.now() - tx.createdAt > 600000 ||
        tx.browserProof !== (await digest(body.proof))
      )
        fail(
          400,
          'Sign-in expired or was started in another tab. Please try again.',
        );
      delete this.state.authTransactions[key];
      await this.saveState(this.state);
      this.rollbackState = structuredClone(this.state); // One-use transaction before contacting the provider.
      if (body.error)
        fail(400, 'Sign-in was cancelled. Your account was not changed.');
      const external = await exchangeIdentity(this.env, config, tx, body.code);
      const identityKey = await digest(
        external.issuer + '|' + external.subject,
      );
      const security = this.state.identitySecurity[identityKey];
      if (security?.blocked)
        fail(403, 'This account is unavailable. Contact RWAS.');
      if (
        security?.credentialsChangedAt &&
        tx.createdAt <= security.credentialsChangedAt
      )
        fail(401, 'Credentials changed during sign-in. Please start again.');
      const existing = this.state.identities[identityKey];
      let profile;
      if (tx.linkUserId) {
        profile = this.state.profiles[tx.linkUserId];
        const linkedSession = this.state.sessions[tx.linkSessionKey];
        if (
          !linkedSession ||
          linkedSession.userId !== tx.linkUserId ||
          linkedSession.expiresAt <= Date.now()
        )
          fail(401, 'Sign in again before connecting a login.');
        if (!profile) fail(401, 'Your account is no longer available.');
        if (existing && existing.userId !== profile.id)
          fail(409, 'That login already belongs to another RWAS account.');
      } else if (existing) profile = this.state.profiles[existing.userId];
      else {
        if (
          Object.values(this.state.profiles).some(
            (p) => p.email === external.email,
          )
        )
          fail(
            409,
            'This email already has a RWAS account. Sign in with an email code, then connect this login in Account.',
          );
        profile = {
          id: crypto.randomUUID(),
          email: external.email,
          name: external.name,
          phone: '',
          location: '',
          createdAt: Date.now(),
        };
        this.state.profiles[profile.id] = profile;
      }
      if (!profile) fail(401, 'Your account is no longer available.');
      if (profile.disabled || profile.identityBlocked)
        fail(403, 'This account is unavailable. Contact RWAS.');
      if (
        tx.createdAt <=
        Math.max(
          existing?.credentialsChangedAt || 0,
          profile.sessionRevokedAt || 0,
        )
      )
        fail(401, 'Credentials changed during sign-in. Please start again.');
      this.state.identities[identityKey] = {
        userId: profile.id,
        subject: external.subject,
        issuer: external.issuer,
        method: tx.method,
        createdAt: existing?.createdAt || Date.now(),
        credentialsChangedAt: existing?.credentialsChangedAt || 0,
      };
      this.audit(
        tx.linkUserId ? 'identity-link' : 'identity-login',
        profile.id,
        { method: tx.method },
      );
      return this.sessionReply(profile, 'identity');
    }
    if (path.startsWith('/ops/security/')) {
      const actor = await this.operator(req);
      const config = identityConfig(this.env);
      if (!config) fail(503, 'Identity service is not configured.');
      if (
        url.origin !== config.origin ||
        (req.headers.get('Origin') &&
          req.headers.get('Origin') !== config.origin)
      )
        fail(403, 'Operator destination not allowed.');
      if (method !== 'POST') fail(405, 'Method not allowed.');
      if (
        ![
          '/ops/security/preview',
          '/ops/security/apply',
          '/ops/security/receipt',
        ].includes(path)
      )
        fail(404, 'Operator action not found.');
      const body = await this.json(req);
      if (path.endsWith('/receipt')) {
        if (
          !body ||
          typeof body.id !== 'string' ||
          !/^[A-Za-z0-9_-]{1,128}$/.test(body.id) ||
          ['__proto__', 'constructor', 'prototype'].includes(body.id) ||
          Object.keys(body).some((key) => key !== 'id')
        )
          fail(400, 'Operation ID required.');
        const receipt = Object.hasOwn(this.state.securityOperations, body.id)
          ? this.state.securityOperations[body.id]
          : null;
        if (!receipt) fail(404, 'Security operation not found.');
        return reply(receipt);
      }
      const operation = securityOperation(body);
      const inputHash = await digest(
        JSON.stringify({ issuer: config.issuer, operation }),
      );
      const previous = Object.hasOwn(
        this.state.securityOperations,
        operation.id,
      )
        ? this.state.securityOperations[operation.id]
        : null;
      if (previous) {
        if (previous.actor !== actor || previous.inputHash !== inputHash)
          fail(409, 'Operation ID already used for another request.');
        return reply({ ...previous.result, replayed: true });
      }
      const proposal = await securityProposal(
        this.state,
        config.issuer,
        operation,
      );
      if (path.endsWith('/preview')) return reply(proposal.public);
      if (body.confirmation !== proposal.public.confirmation)
        fail(
          409,
          'Security state changed or confirmation missing. Preview again.',
        );
      const fence = Date.now();
      const before = this.state.identitySecurity[proposal.identityKey] || {};
      this.state.identitySecurity[proposal.identityKey] = {
        ...before,
        revision: (before.revision || 0) + 1,
        credentialsChangedAt: Math.max(before.credentialsChangedAt || 0, fence),
        blocked:
          operation.kind === 'account-unblocked'
            ? false
            : operation.kind === 'account-blocked' || !!before.blocked,
        blockedAt:
          operation.kind === 'account-blocked'
            ? Math.max(before.blockedAt || 0, operation.occurredAt)
            : before.blockedAt || 0,
        unblockedThrough:
          operation.kind === 'account-unblocked'
            ? operation.occurredAt
            : before.unblockedThrough || 0,
      };
      let revokedSessions = 0;
      const profile = this.state.profiles[proposal.profileId];
      if (profile) {
        profile.sessionRevokedAt = Math.max(
          profile.sessionRevokedAt || 0,
          fence,
        );
        profile.identityBlocked = Object.entries(this.state.identities).some(
          ([key, value]) =>
            value.userId === profile.id &&
            this.state.identitySecurity[key]?.blocked,
        );
        for (const [key, session] of Object.entries(this.state.sessions))
          if (session.userId === profile.id) {
            delete this.state.sessions[key];
            revokedSessions++;
          }
      }
      const result = {
        ok: true,
        operationId: operation.id,
        affectedProfileId: profile?.id || null,
        revokedSessions,
        subjectBlocked:
          this.state.identitySecurity[proposal.identityKey].blocked,
        profileBlocked: !!(profile?.disabled || profile?.identityBlocked),
        appliedAt: fence,
      };
      this.audit('operator-security-reconcile', actor, {
        ...operation,
        issuer: config.issuer,
        affectedProfileId: profile?.id || null,
        subject: proposal.identityKey,
        revokedSessions,
        subjectBlocked: result.subjectBlocked,
        profileBlocked: result.profileBlocked,
      });
      this.state.securityOperations[operation.id] = {
        actor,
        inputHash,
        result,
        audit: this.state.audit.at(-1),
      };
      return reply(result);
    }
    if (path === '/auth/events' && method === 'POST') {
      const config = identityConfig(this.env),
        secret = this.env.AUTH_EVENT_SECRET;
      const supplied = (req.headers.get('Authorization') || '').replace(
        /^Bearer /,
        '',
      );
      if (
        !config ||
        typeof secret !== 'string' ||
        secret.length < 32 ||
        (await digest(supplied)) !== (await digest(secret))
      )
        fail(403, 'Provider event not authorized.');
      const body = await this.json(req);
      if (
        !['password-reset', 'account-blocked'].includes(body.kind) ||
        typeof body.subject !== 'string' ||
        !body.subject ||
        body.subject.length > 500 ||
        typeof body.id !== 'string' ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(body.id) ||
        ['__proto__', 'constructor', 'prototype'].includes(body.id) ||
        !Number.isFinite(body.issuedAt) ||
        Math.abs(Date.now() - body.issuedAt) > 300000
      )
        fail(400, 'Invalid provider event.');
      for (const [key, value] of Object.entries(this.state.authEvents))
        if (Date.now() - value > DAY) delete this.state.authEvents[key];
      if (Object.hasOwn(this.state.authEvents, body.id))
        return reply({ ok: true });
      const identityKey = await digest(config.issuer + '|' + body.subject);
      const previous = this.state.identitySecurity[identityKey];
      if (body.issuedAt <= (previous?.unblockedThrough || 0)) {
        this.state.authEvents[body.id] = Date.now();
        this.audit('provider-event-already-reconciled', identityKey, {
          eventId: body.id,
          kind: body.kind,
        });
        return reply({ ok: true, reconciled: true });
      }
      this.state.identitySecurity[identityKey] = {
        ...previous,
        revision: (previous?.revision || 0) + 1,
        blockedAt:
          body.kind === 'account-blocked'
            ? Math.max(previous?.blockedAt || 0, body.issuedAt)
            : previous?.blockedAt || 0,
        credentialsChangedAt: Math.max(
          previous?.credentialsChangedAt || 0,
          body.issuedAt,
        ),
        blocked: previous?.blocked || body.kind === 'account-blocked',
      };
      const identity = this.state.identities[identityKey];
      if (identity) {
        const profile = this.state.profiles[identity.userId];
        if (profile)
          profile.sessionRevokedAt = Math.max(
            profile.sessionRevokedAt || 0,
            body.issuedAt,
          );
        identity.credentialsChangedAt = Math.max(
          identity.credentialsChangedAt || 0,
          body.issuedAt,
        );
        if (
          body.kind === 'account-blocked' &&
          this.state.profiles[identity.userId]
        )
          this.state.profiles[identity.userId].identityBlocked = true;
        for (const [key, session] of Object.entries(this.state.sessions))
          if (session.userId === identity.userId)
            delete this.state.sessions[key];
        this.audit('provider-session-revoke', identity.userId, {
          kind: body.kind,
        });
      }
      this.state.authEvents[body.id] = Date.now();
      return reply({ ok: true });
    }
    if (path === '/send-code' && method === 'POST') {
      const b = await this.json(req);
      return this.sendCode(req, b);
    }
    if (path === '/check-code' && method === 'POST') {
      const b = await this.json(req),
        address = email(b.email);
      await this.verify(address, b.code);
      let p = Object.values(this.state.profiles).find(
        (p) => p.email === address,
      );
      if (!p) {
        p = {
          id: crypto.randomUUID(),
          email: address,
          name: '',
          phone: '',
          location: '',
          createdAt: Date.now(),
        };
        this.state.profiles[p.id] = p;
      }
      if (p.disabled || p.identityBlocked)
        fail(403, 'This account is unavailable. Contact RWAS.');
      return this.sessionReply(p);
    }
    if (path === '/browse' && method === 'GET') {
      const sold = url.searchParams.get('include') === 'sold';
      return reply({
        listings: Object.values(this.state.listings)
          .filter((l) => l.status === 'active' || (sold && l.status === 'sold'))
          .map((l) => publicListing(this.hydrate(l))),
      });
    }
    if (path.startsWith('/admin/files/') && method === 'GET') {
      await this.admin(req);
      const key = decodeURIComponent(path.slice(13)),
        f = this.state.files[key];
      if (
        !f ||
        f.deleting ||
        this.state.listings[f.listingId]?.status === 'deleted'
      )
        fail(404, 'File not found.');
      const obj = await this.env.MEDIA.get(key);
      if (!obj) fail(404, 'File not found.');
      return new Response(obj.body, {
        headers: {
          'Content-Type': f.type,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'Content-Disposition':
            f.type === 'application/pdf' ? 'attachment' : 'inline',
          'Content-Security-Policy': "sandbox; default-src 'none'",
        },
      });
    }
    if (path.startsWith('/files/') && method === 'GET') {
      const key = decodeURIComponent(path.slice(7)),
        f = this.state.files[key];
      if (!f || f.deleting) fail(404, 'File not found.');
      const l = this.state.listings[f.listingId];
      const published =
        l &&
        ['active', 'sold'].includes(l.status) &&
        ['photos', 'videos'].includes(f.category);
      if (!published) {
        const u = await this.user(req);

        if (f.ownerId !== u.id || !l || l.status === 'deleted')
          fail(404, 'File not found.');
      }
      const range = req.headers.get('Range');
      let offset = 0,
        length = f.size;
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match || (!match[1] && !match[2]))
          fail(416, 'Invalid byte range.');
        if (!match[1]) {
          length = Math.min(Number(match[2]), f.size);
          offset = f.size - length;
        } else {
          offset = Number(match[1]);
          const end = match[2]
            ? Math.min(Number(match[2]), f.size - 1)
            : f.size - 1;
          length = end - offset + 1;
        }
        if (offset < 0 || offset >= f.size || length <= 0)
          fail(416, 'Invalid byte range.');
      }
      const obj = await this.env.MEDIA.get(
        key,
        range ? { range: { offset, length } } : undefined,
      );
      if (!obj) fail(404, 'File not found.');
      return new Response(obj.body, {
        status: range ? 206 : 200,
        headers: {
          'Accept-Ranges': 'bytes',
          ...(range
            ? {
                'Content-Range':
                  'bytes ' +
                  offset +
                  '-' +
                  (offset + length - 1) +
                  '/' +
                  f.size,
                'Content-Length': String(length),
              }
            : {}),
          'Content-Type': f.type,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'Content-Disposition':
            (f.category === 'photos' || f.category === 'videos'
              ? 'inline'
              : 'attachment') +
            '; filename="' +
            f.name.replace(/[^a-zA-Z0-9._-]/g, '_') +
            '"',
          'Content-Security-Policy': "sandbox; default-src 'none'",
        },
      });
    }
    if (path.startsWith('/listing/') && method === 'GET') {
      const l = this.state.listings[path.slice(9)];
      if (!l) fail(404, 'Listing not found.');
      if (!['active', 'sold'].includes(l.status)) {
        const u = await this.user(req);
        if (l.ownerId !== u.id) fail(404, 'Listing not found.');
      }
      if ((req.headers.get('Accept') || '').includes('text/html')) {
        if (!['active', 'sold'].includes(l.status))
          fail(404, 'Listing not found.');
        return publicPage(publicListing(this.hydrate(l)));
      }
      return reply({
        listing: ['active', 'sold'].includes(l.status)
          ? publicListing(this.hydrate(l))
          : this.hydrate(l),
      });
    }
    if (path === '/admin/listings' && method === 'GET') {
      await this.admin(req);
      return reply({
        listings: Object.values(this.state.listings).map((l) =>
          this.hydrate(l),
        ),
      });
    }
    if (path === '/admin/review' && method === 'POST') {
      const actor = await this.admin(req),
        b = await this.json(req),
        l = this.state.listings[b.listingId];
      if (!l || l.status !== 'pending')
        fail(409, 'Listing is not awaiting review.');
      if (b.revision !== l.revision)
        fail(409, 'Listing changed. Review the latest revision.');
      if (!['approve', 'reject'].includes(b.decision))
        fail(400, 'Invalid review decision.');
      if (b.decision === 'approve') {
        clean(l.fields, true);
        l.approvedRevision = l.revision;
        l.status = 'active';
      } else {
        l.status = 'rejected';
        l.reviewNote = String(b.note || 'Please update your listing.').slice(
          0,
          1000,
        );
      }
      delete this.state.outbox[l.id + ':' + l.revision];
      l.updatedAt = Date.now();
      this.audit('review', actor, {
        listingId: l.id,
        decision: b.decision,
        revision: l.revision,
      });
      return reply({ ok: true, listing: this.hydrate(l) });
    }
    const u = await this.user(req);
    if (path === '/intake' && method === 'POST') {
      const body = await this.json(req),
        last = body.messages?.filter((m) => m.role === 'user').at(-1);
      if (
        !last ||
        typeof last.content !== 'string' ||
        last.content.length > 2000
      )
        fail(400, 'A short seller message is required.');
      const text = last.content.split('\n\n[System context:')[0].trim();
      const steps = [
        ['nNumber', 'What is your aircraft N-number?'],
        ['make', 'Aircraft make?'],
        ['model', 'Aircraft model?'],
        ['year', 'Aircraft year?'],
        ['price', 'Asking price in USD?'],
        ['description', 'Describe the condition and history, or say skip.'],
        ['avionics', 'Avionics and equipment, or say skip.'],
      ];
      if (/^(cancel|stop|never mind)$/i.test(text))
        return reply({
          reply: 'Your progress is saved privately. You can continue later.',
          state: { cancelled: true },
        });
      let progress = this.state.drafts[u.id];
      if (!progress?.intake) {
        progress = { intake: true, step: 0, fields: { sellerName: u.name } };
        this.state.drafts[u.id] = progress;
        return reply({ reply: steps[0][1], state: { step: 0 } });
      }
      if (/\b(list|sell) my|want to list/i.test(text))
        return reply({
          reply:
            'Continuing your saved draft. ' +
            steps[Math.min(progress.step, steps.length - 1)][1],
          state: { step: progress.step },
        });
      const [field] = steps[progress.step] || steps[0];
      if (text.toLowerCase() === 'skip' && progress.step < 5)
        fail(400, 'This field is required before submitting a listing.');
      if (text.toLowerCase() !== 'skip')
        Object.assign(progress.fields, clean({ [field]: text }));
      progress.step++;
      progress.updatedAt = Date.now();
      if (progress.step < steps.length)
        return reply({
          reply: steps[progress.step][1],
          state: { step: progress.step },
        });
      const draft = clean(progress.fields, true);
      this.state.drafts[u.id] = { ...draft, updatedAt: Date.now() };
      return reply({
        reply:
          'Review your details in the seller panel. Save the draft, add media, then submit for review.',
        action: { type: 'listing_draft', draft },
        state: { completed: true },
      });
    }
    if (path === '/account' && method === 'GET')
      return reply({
        profile: this.state.profiles[u.id],
        loginMethods: [
          ...new Set(
            Object.values(this.state.identities)
              .filter((i) => i.userId === u.id)
              .map((i) => i.method),
          ),
        ],
        sessions: Object.entries(this.state.sessions)
          .filter(([, s]) => s.userId === u.id && s.expiresAt > Date.now())
          .map(([id, s]) => ({
            id,
            createdAt: s.createdAt,
            expiresAt: s.expiresAt,
            current: id === u.sessionKey,
          })),
      });
    if (path === '/account' && method === 'PATCH') {
      const b = await this.json(req);
      for (const k of Object.keys(b))
        if (
          !['name', 'phone', 'location'].includes(k) ||
          typeof b[k] !== 'string' ||
          b[k].length > 200
        )
          fail(400, 'Invalid profile field.');
      Object.assign(this.state.profiles[u.id], b);
      this.audit('profile', u.id);
      return reply({ ok: true, profile: this.state.profiles[u.id] });
    }
    if (path === '/account/email-code' && method === 'POST') {
      await this.user(req, true);
      return this.sendCode(req, await this.json(req), 'email-change', u);
    }
    if (path === '/account/email' && method === 'PUT') {
      await this.user(req, true);
      const b = await this.json(req),
        address = email(b.email);
      await this.verify(address, b.code, 'email-change', u);
      if (
        Object.values(this.state.profiles).some(
          (p) => p.email === address && p.id !== u.id,
        )
      )
        fail(409, 'This address cannot be used.');
      this.state.profiles[u.id].email = address;
      for (const [k, s] of Object.entries(this.state.sessions))
        if (s.userId === u.id && k !== u.sessionKey)
          delete this.state.sessions[k];
      this.audit('email-change', u.id);
      return reply({ ok: true, email: address });
    }
    if (path === '/logout' && method === 'POST') {
      if (req.body) await this.json(req);
      const external = this.state.sessions[u.sessionKey].method === 'identity';
      delete this.state.sessions[u.sessionKey];
      const config = identityConfig(this.env);
      return reply({
        ok: true,
        ...(external && config ? { logoutUrl: logoutUrl(config) } : {}),
      });
    }
    if (path === '/account/sessions' && method === 'DELETE') {
      const b = await this.json(req);
      for (const [k, s] of Object.entries(this.state.sessions))
        if (
          s.userId === u.id &&
          (b.id === k || (b.all === true && k !== u.sessionKey))
        )
          delete this.state.sessions[k];
      return reply({ ok: true });
    }
    if (path === '/account' && method === 'DELETE') {
      await this.user(req, true);
      const b = await this.json(req);
      if (b.confirm !== u.email)
        fail(400, 'Type your current email to confirm.');
      if (Object.values(this.state.listings).some((l) => l.ownerId === u.id))
        fail(409, 'Permanently delete your listings first.');
      delete this.state.drafts[u.id];
      for (const [k, s] of Object.entries(this.state.sessions))
        if (s.userId === u.id) delete this.state.sessions[k];
      for (const [key, identity] of Object.entries(this.state.identities))
        if (identity.userId === u.id) delete this.state.identities[key];
      for (const [key, transaction] of Object.entries(
        this.state.authTransactions,
      ))
        if (transaction.linkUserId === u.id)
          delete this.state.authTransactions[key];
      delete this.state.profiles[u.id];
      this.audit('account-delete', u.id);
      return reply({ ok: true });
    }
    if (path === '/draft') {
      if (method === 'GET')
        return reply({ draft: this.state.drafts[u.id] || null });
      if (method === 'PUT') {
        const b = clean(await this.json(req));
        this.state.drafts[u.id] = { ...b, updatedAt: Date.now() };
        return reply({ ok: true });
      }
      if (method === 'DELETE') {
        delete this.state.drafts[u.id];
        return reply({ ok: true });
      }
    }
    if (path === '/my-listings' && method === 'GET')
      return reply({
        listings: Object.values(this.state.listings)
          .filter((l) => l.ownerId === u.id)
          .map((l) => ({ ...this.hydrate(l), ...l.fields }))
          .sort((a, b) => b.updatedAt - a.updatedAt),
      });
    if (path === '/listings' && method === 'POST') {
      const b = clean(await this.json(req)),
        idem = req.headers.get('Idempotency-Key');
      if (!idem || idem.length > 100)
        fail(400, 'A submission identifier is required.');
      const key = u.id + ':' + idem,
        digest = await hash(JSON.stringify(b)),
        old = this.state.idempotency[key];
      if (old) {
        if (old.digest !== digest)
          fail(
            409,
            'Submission identifier already used for different details.',
          );
        if (!this.state.listings[old.id])
          fail(410, 'This submission was deleted.');
        return reply({
          ok: true,
          listing: {
            ...this.hydrate(this.state.listings[old.id]),
            ...this.state.listings[old.id].fields,
          },
        });
      }
      const id = crypto.randomUUID(),
        l = {
          id,
          ownerId: u.id,
          status: 'draft',
          revision: 1,
          approvedRevision: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          fields: b,
        };
      this.state.listings[id] = l;
      const saved = this.state.drafts[u.id];
      if (
        saved &&
        !saved.intake &&
        ['make', 'model', 'year', 'price'].every(
          (k) => String(saved[k]) === String(b[k]),
        )
      )
        delete this.state.drafts[u.id];
      this.state.idempotency[key] = { digest, id };
      this.audit('create', u.id, { listingId: id });
      return reply(
        { ok: true, listing: { ...this.hydrate(l), ...l.fields } },
        201,
      );
    }
    const order = path.match(/^\/listings\/([^/]+)\/photos\/order$/);
    if (order && method === 'PUT') {
      const l = this.owned(order[1], u),
        b = await this.json(req),
        photos = this.media(l).filter((f) => f.category === 'photos');
      if (['deleted', 'archived'].includes(l.status))
        fail(409, 'Restore the listing before reordering.');
      if (
        !Array.isArray(b.order) ||
        b.order.length !== photos.length ||
        new Set(b.order).size !== photos.length ||
        b.order.some((k) => !photos.some((f) => f.key === k))
      )
        fail(400, 'Photo order must contain each owned photo exactly once.');
      b.order.forEach((k, i) => (this.state.files[k].order = i));
      l.revision++;
      l.status = 'draft';
      l.updatedAt = Date.now();
      return reply({
        ok: true,
        photos: this.media(l)
          .filter((f) => f.category === 'photos')
          .sort((a, b) => a.order - b.order),
      });
    }
    const listingPath = path.match(/^\/listings\/([^/]+)$/);
    if (listingPath) {
      const l = this.owned(listingPath[1], u);
      if (method === 'PUT') {
        if (['deleted', 'archived'].includes(l.status))
          fail(409, 'Restore the listing before editing.');
        const b = clean(await this.json(req));
        l.fields = { ...l.fields, ...b };
        l.revision++;
        l.status = 'draft';
        l.updatedAt = Date.now();
        this.audit('edit', u.id, { listingId: l.id });
        return reply({
          ok: true,
          listing: { ...this.hydrate(l), ...l.fields },
        });
      }
      if (method === 'DELETE') {
        const b = await this.json(req);
        if (b.confirm !== l.id || l.status !== 'deleted')
          fail(
            409,
            'Move the listing to trash, then confirm permanent deletion.',
          );
        await this.purge(l);
        delete this.state.listings[l.id];
        this.audit('purge', u.id, { listingId: l.id });
        return reply({ ok: true });
      }
    }
    const statusPath = path.match(/^\/listing\/([^/]+)\/status$/);
    if (statusPath && method === 'POST') {
      const l = this.owned(statusPath[1], u),
        b = await this.json(req),
        next = b.status;
      if (l.purging)
        fail(409, 'Permanent deletion is in progress. Retry deletion.');
      if (next === 'pending' && this.media(l).some((f) => f.deleting))
        fail(409, 'Finish pending file deletion before review.');
      if (next === 'pending' && ['draft', 'rejected'].includes(l.status)) {
        clean(l.fields, true);
        l.status = 'pending';
        this.state.outbox[l.id + ':' + l.revision] = {
          listingId: l.id,
          revision: l.revision,
          createdAt: Date.now(),
          status: 'awaiting-review',
        };
      } else if (next === 'paused' && l.status === 'active')
        l.status = 'paused';
      else if (
        next === 'active' &&
        l.status === 'paused' &&
        l.approvedRevision === l.revision
      )
        l.status = 'active';
      else if (next === 'sold' && ['active', 'paused'].includes(l.status))
        l.status = 'sold';
      else if (
        next === 'archived' &&
        !['archived', 'deleted'].includes(l.status)
      ) {
        l.archiveFrom = l.status;
        l.status = 'archived';
      } else if (next === 'deleted' && l.status !== 'deleted') {
        l.deleteFrom = l.status;
        l.status = 'deleted';
        l.deletedAt = Date.now();
      } else if (
        next === 'restore' &&
        ['archived', 'deleted'].includes(l.status)
      ) {
        l.status = 'draft';
        delete l.deletedAt;
      } else fail(409, 'That status change is not allowed.');
      l.updatedAt = Date.now();
      this.audit('status', u.id, { listingId: l.id, status: l.status });
      return reply({ ok: true, listing: { ...this.hydrate(l), ...l.fields } });
    }
    if (path === '/upload' && method === 'POST') {
      if (!this.env.MEDIA) fail(503, 'Media storage is unavailable.');
      const l = this.owned(url.searchParams.get('listingId'), u),
        category = url.searchParams.get('category'),
        name = String(url.searchParams.get('filename') || '')
          .replace(/[^a-zA-Z0-9._-]/g, '_')
          .slice(0, 200);
      if (!categories.includes(category) || !name)
        fail(400, 'Invalid media category or filename.');
      if (['deleted', 'archived'].includes(l.status))
        fail(409, 'Restore the listing before uploading.');
      if (Number(req.headers.get('content-length') || 0) > MAX)
        fail(413, '50 MB limit.');
      const reader = req.body?.getReader();
      if (!reader) fail(400, 'Empty file.');
      const parts = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX) {
          await reader.cancel();
          fail(413, '50 MB limit.');
        }
        parts.push(value);
      }
      if (!size) fail(400, 'Empty file.');
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const p of parts) {
        bytes.set(p, offset);
        offset += p.length;
      }
      const ext = name.split('.').pop().toLowerCase(),
        ascii = new TextDecoder().decode(bytes.slice(0, 12));
      let type;
      if (category === 'photos') {
        if (
          ['jpg', 'jpeg'].includes(ext) &&
          bytes[0] === 255 &&
          bytes[1] === 216 &&
          bytes[2] === 255
        )
          type = 'image/jpeg';
        if (
          ext === 'png' &&
          [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)
        )
          type = 'image/png';
        if (ext === 'gif' && /^GIF8[79]a/.test(ascii)) type = 'image/gif';
        if (
          ext === 'webp' &&
          ascii.startsWith('RIFF') &&
          ascii.slice(8) === 'WEBP'
        )
          type = 'image/webp';
      } else if (category === 'videos') {
        if (ext === 'mp4' && ascii.slice(4, 8) === 'ftyp') type = 'video/mp4';
        if (
          ext === 'webm' &&
          [26, 69, 223, 163].every((n, i) => bytes[i] === n)
        )
          type = 'video/webm';
      } else if (ext === 'pdf' && ascii.startsWith('%PDF-'))
        type = 'application/pdf';
      if (!type)
        fail(
          400,
          'Use a valid JPG, PNG, GIF, WebP photo, MP4/WebM video, or PDF document.',
        );
      if (this.media(l).filter((f) => f.category === category).length >= 40)
        fail(400, '40 files per category limit.');
      const key =
        'listings/' +
        l.id +
        '/' +
        category +
        '/' +
        crypto.randomUUID() +
        '/' +
        name;
      await this.env.MEDIA.put(key, bytes, {
        httpMetadata: { contentType: type },
      });
      this.state.files[key] = {
        key,
        name,
        size,
        type,
        category,
        listingId: l.id,
        ownerId: u.id,
        uploadedAt: Date.now(),
        order: this.media(l).length,
      };
      l.revision++;
      l.status = 'draft';
      l.updatedAt = Date.now();
      return reply({ ok: true, file: this.state.files[key] });
    }
    if (path === '/delete-file' && method === 'POST') {
      const b = await this.json(req),
        l = this.owned(b.listingId, u),
        f = this.state.files[b.fileKey];
      if (
        !f ||
        f.listingId !== l.id ||
        f.ownerId !== u.id ||
        f.category !== b.category
      )
        fail(404, 'File not found.');
      if (['deleted', 'archived'].includes(l.status))
        fail(409, 'Restore the listing first.');
      if (!f.deleting) {
        f.deleting = true;
        l.revision++;
        l.status = 'draft';
        l.updatedAt = Date.now();
        this.audit('delete-file-intent', u.id, {
          listingId: l.id,
          fileKey: f.key,
        });
        await this.saveState(this.state);
        this.rollbackState = structuredClone(this.state);
      }
      await this.env.MEDIA.delete(f.key);
      delete this.state.files[f.key];
      return reply({ ok: true });
    }
    fail(404, 'Route not found.');
  }
}
