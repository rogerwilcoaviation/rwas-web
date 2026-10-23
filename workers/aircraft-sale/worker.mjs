import {
  CLERK_QA_COHORT,
  clerkQaEmail,
  clerkQaOnlyEnabled as configuredClerkQaOnlyEnabled,
  clerkProductionConfig,
  clerkProductionIdentity,
  sellerPublicListingsEnabled as configuredClerkPublicListingsEnabled,
} from './clerk-production.mjs';
import { mailAuthenticationRequest } from './mail-context.mjs';
import {
  betterAuthEnabled,
  betterAuthLegacyLinkEnabled,
  assertBetterAuthOrigin,
  validateBetterAuthIdentity,
  completedBetterAuthBusinessDeletion,
} from './better-auth-bridge.mjs';
import {
  readBetterAuthIdentity,
  sellerAuthConfig,
} from './better-auth-service.mjs';
import {
  BETTER_AUTH_QA_COHORT,
  betterAuthQaEnabled,
  assertBetterAuthQaEmail,
} from './better-auth-qa.mjs';
import {
  clerkLinkOwner,
  clerkLinkInput,
  clerkLinkIdentity,
  clerkLinkTransaction,
  clerkLinkFinishProof,
  clerkLinkProviderProof,
  clerkLinkOwnerProviderProof,
} from './clerk-existing-account.mjs';
import {
  CLERK_OWNER_PURPOSE,
  CLERK_OWNER_METHOD,
  clerkOwnerConfig,
  clerkOwnerInput,
  clerkOwnerProviderBinding,
  clerkOwnerProviderProof,
  clerkOwnerFinishProof,
  clerkOwnerAccount,
} from './clerk-owner-reauth.mjs';
import {
  listingFields as fields,
  cleanListing as clean,
} from './listing-fields.mjs';
import {
  deliverCode,
  authorizeReviewer,
  authorizeOperator,
  authorizeAccountAdministrator,
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
import { auth0EventConfig, auth0BlockNotification } from './auth0-events.mjs';
import {
  accountHeld,
  assertAccountOrigin,
  accountDirectory,
  accountDetail,
  accountOperation,
  accountProposal,
  applyAccountOperation,
} from './account-admin.mjs';
import { hasProductSnippetEligibility } from '../../lib/product-snippet-eligibility.mjs';
import {
  listingTitle,
  listingPrice,
  categoryFields,
  categoryFor,
  newListingFields,
} from '../../lib/marketplace/schema.mjs';
import {
  ConservationCapture,
  ConservationError,
  isConservationRequest,
  loadConservationRows,
} from './conservation.mjs';
// Versioned seller API. Requires explicitly provisioned Durable Object + private R2.
// No legacy KV fallback: migration/import is a separately reviewed operation.
const HOUR = 3600000,
  DAY = 86400000,
  MAX = 50 * 1024 * 1024;
const clerkQaOnlyEnabled = (env) =>
  !betterAuthEnabled(env) && configuredClerkQaOnlyEnabled(env);
const sellerPublicListingsEnabled = (env) =>
  betterAuthEnabled(env)
    ? env.PUBLIC_LISTINGS_ENABLED === 'true'
    : configuredClerkPublicListingsEnabled(env);
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
  auth0EventReceipts: {},
  securityOperations: {},
  accountAdminOperations: {},
  sessions: {},
  codes: {},
  mailRequests: {},
  mailSequences: {},
  rates: {},
  listings: {},
  drafts: {},
  files: {},
  idempotency: {},
  audit: [],
  outbox: {},
  supportTickets: {},
});
const clerkFailureStages = new Set([
  'runtime-config',
  'request-origin',
  'session-token',
  'jwt-format',
  'jwt-header',
  'jwt-jwks-fetch',
  'jwt-jwks-status',
  'jwt-jwks-json',
  'jwt-jwks-schema',
  'jwt-key-selection',
  'jwt-key-import',
  'jwt-signature',
  'jwt-claims',
  'provider-session',
  'provider-user',
  'provider-account',
  'provider-email',
  'provider-password-state',
  'qa-cohort',
]);
const reply = (data, status = 200, headers = {}) =>
  Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const assertClerkQaProfile = (env, profile, verifiedEmail) => {
  if (
    clerkQaOnlyEnabled(env) &&
    (!profile ||
      profile.clerkQaCohort !== CLERK_QA_COHORT ||
      !clerkQaEmail(verifiedEmail))
  )
    fail(403, 'Existing accounts cannot be adopted by the QA release.');
};
const hash = async (s) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)),
    ),
    (x) => x.toString(16).padStart(2, '0'),
  ).join('');
const token = () => crypto.randomUUID() + crypto.randomUUID();
const sameBetterAuthSession = (left, right) =>
  left?.method === 'better-auth' &&
  right?.method === 'better-auth' &&
  left.identityKey === right.identityKey &&
  left.providerSessionId === right.providerSessionId;
const hasBetterAuthIdentity = (state, profileId) =>
  Object.values(state.identities).some(
    (identity) =>
      identity.userId === profileId && identity.issuer === 'rwas-better-auth',
  );
const UPLOAD_RECEIPT_KIND = 'upload-v1',
  UPLOAD_RECEIPT_LIMIT = 4096,
  UPLOAD_OWNER_RECEIPT_LIMIT = 512,
  UPLOAD_ORPHAN_CLEANUP_BATCH = 8;
const uploadOperation = (req, now = Date.now()) => {
  const value = req.headers.get('Idempotency-Key') || '',
    match = value.match(
      /^rwas-upload-v1\.(\d{13})\.([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i,
    );
  if (!match)
    fail(
      400,
      'Reload this page and refresh saved media before selecting this file again.',
    );
  const issuedAt = Number(match[1]);
  if (issuedAt > now + 5 * 60000 || issuedAt + DAY <= now)
    fail(
      409,
      'This upload request has expired. Refresh saved media before selecting this file again.',
    );
  return {
    id: 'rwas-upload-v1.' + match[1] + '.' + match[2].toLowerCase(),
    expiresAt: issuedAt + DAY,
  };
};
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
    acceptanceApprovedRevision,
    acceptancePublicUntil,
    archiveFrom,
    deleteFrom,
    deletedAt,
    reviewNote,
    ...p
  } = l;
  const specs = { ...p.specifications };
  if (specs['general-display-registration-with-this-listing'] === 'No')
    delete p.nNumber;
  if (specs['general-display-serial-number-with-this-listing'] === 'No') {
    delete p.serialNumber;
    for (const key of Object.keys(specs))
      if (key.includes('serial-number') && !key.includes('display-'))
        delete specs[key];
  }
  if (
    specs['engine-program-display-engine-maint-program-hourly-rates'] === 'No'
  )
    for (const key of Object.keys(specs))
      if (key.includes('hourly-rate')) delete specs[key];
  if (specs['hangars-show-address'] !== 'Yes')
    delete specs['hangars-street-address'];
  return {
    ...p,
    ...(p.specifications ? { specifications: specs } : {}),
    logbooks: Object.fromEntries(
      Object.entries(p.logbooks || {}).map(([k, v]) => [
        k,
        { count: v.length },
      ]),
    ),
  };
}
const acceptanceScope = (listing, env, now = Date.now()) => {
  if (
    env.CLERK_ACCEPTANCE_ENABLED !== 'true' ||
    sellerPublicListingsEnabled(env) ||
    listing?.status !== 'pending' ||
    listing.purging ||
    typeof env.CLERK_ACCEPTANCE_SCOPE !== 'string' ||
    env.CLERK_ACCEPTANCE_SCOPE.length > 2048
  )
    return null;
  try {
    const scope = JSON.parse(env.CLERK_ACCEPTANCE_SCOPE);
    if (
      !scope ||
      Array.isArray(scope) ||
      Object.keys(scope).sort().join(',') !==
        'expiresAt,listingId,ownerId,revision' ||
      typeof scope.listingId !== 'string' ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(scope.listingId) ||
      typeof scope.ownerId !== 'string' ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(scope.ownerId) ||
      !Number.isSafeInteger(scope.revision) ||
      scope.revision < 1 ||
      !Number.isSafeInteger(scope.expiresAt) ||
      scope.expiresAt <= now ||
      scope.expiresAt > now + 10 * 60 * 1000 ||
      scope.listingId !== listing.id ||
      scope.ownerId !== listing.ownerId ||
      scope.revision !== listing.revision
    )
      return null;
    return scope;
  } catch {
    return null;
  }
};
const acceptanceMarker = (listing) =>
  Number.isFinite(listing.acceptancePublicUntil) &&
  Number.isInteger(listing.acceptanceApprovedRevision);
const acceptancePublished = (listing, env, now = Date.now()) => {
  const scope = acceptanceScope(listing, env, now);
  return (
    !!scope &&
    listing.acceptanceApprovedRevision === scope.revision &&
    listing.acceptancePublicUntil === scope.expiresAt
  );
};
const staffReviewActions = (listing, env) => {
  const actions = [];
  if (listing.status === 'pending' && !listing.purging) {
    actions.push('reject');
    if (sellerPublicListingsEnabled(env)) actions.push('approve');
    if (acceptanceScope(listing, env) && !acceptancePublished(listing, env))
      actions.push('acceptance-approve');
  }
  if (acceptanceMarker(listing)) actions.push('acceptance-unpublish');
  if (['active', 'paused', 'sold'].includes(listing.status) && !listing.purging)
    actions.push('unpublish');
  return actions;
};
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
  if (
    listing.listingType === 'hangars' ||
    (listing.transactionType && listing.transactionType !== 'sale')
  )
    return null;
  const canonical =
    'https://www.rogerwilcoaviation.com/aircraft-for-sale/' +
    encodeURIComponent(listing.id);
  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listingTitle(listing),
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
      priceCurrency: listing.currency || 'USD',
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
  const title = listingTitle(l),
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
      '<style>body{background:#f7f4ef;color:#222;max-width:1000px;margin:auto;padding:24px;font:18px Arial,sans-serif}h1{font-size:40px}a{color:inherit}img,video{width:100%;max-height:600px;object-fit:contain}main{display:grid;gap:20px}dl{display:grid;grid-template-columns:1fr 2fr}dd{margin:8px}dt{margin:8px}section{border-top:1px solid #aaa;padding:20px 0}</style></head><body><nav><a href="/aircraft-for-sale">← Marketplace</a> · <a href="/">Roger Wilco Aviation</a></nav><main><header><p>RWAS Marketplace · ' +
      escape(l.status) +
      '</p><h1>' +
      escape(title) +
      '</h1><p>' +
      escape(listingPrice(l)) +
      '</p></header><section>' +
      media +
      '</section><section><h2>Listing details</h2><dl>' +
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
      [
        ['Category', categoryFor(l)?.label || l.category],
        ['Condition', l.condition],
        ['Part number', l.partNumber],
        ['Quantity', l.quantity],
        ['Unit of sale', l.unitOfSale],
        ['Hangar type', l.hangarType],
        ['Airport', l.airport],
        ['Location', l.sellerLocation],
        ['Transaction', l.transactionType],
      ]
        .filter(([, value]) => value)
        .map(
          ([label, value]) =>
            '<dt>' + escape(label) + '</dt><dd>' + escape(value) + '</dd>',
        )
        .join('') +
      categoryFields(l)
        .filter((field) => l.specifications?.[field.name.slice(5)])
        .map(
          (field) =>
            '<dt>' +
            escape(field.group + ': ' + field.label) +
            '</dt><dd>' +
            escape(l.specifications[field.name.slice(5)]) +
            '</dd>',
        )
        .join('') +
      '</dl><p>' +
      escape(l.description) +
      '</p>' +
      (!l.listingType || l.listingType === 'aircraft'
        ? '<h3>Avionics</h3><p>' +
          escape(l.avionics) +
          '</p><h3>Equipment</h3><p>' +
          escape(l.equipmentList) +
          '</p><h3>Damage history</h3><p>' +
          escape(l.damageHistory || 'Ask seller') +
          '</p>'
        : '') +
      '</section><section><h2>Documents and records</h2><p>' +
      records +
      ' private records held by the seller. Contact the seller to request records.</p></section><section><h2>Seller</h2><p>' +
      escape(l.sellerName) +
      ' · ' +
      escape(l.sellerLocation) +
      '</p><p>' +
      escape(l.sellerPhone) +
      '</p><a href="/contact?topic=aircraft-sales">Contact RWAS about this listing</a></section></main></body></html>',
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
    // Mail tickets/codes are available only through private service-binding RPC.
    if (
      /^\/(?:api\/aircraft-sale\/)?_mail(?:\/|$)/.test(
        new URL(request.url).pathname,
      ) ||
      /^\/(?:api\/aircraft-sale\/)?_identity-deletion-intent(?:\/|$)/.test(
        new URL(request.url).pathname,
      )
    )
      return reply({ error: 'Not found.' }, 404);
    if (!env.SELLER_STORE)
      return reply({ error: 'Seller service is not configured.' }, 503);
    const id = env.SELLER_STORE.idFromName('seller-v2');
    return env.SELLER_STORE.get(id).fetch(request);
  },
};
export default worker;

export class SellerStore {
  constructor(ctx, env, dependencies = {}) {
    this.ctx = ctx;
    this.env = env;
    this.queue = Promise.resolve();
    this.schemaReady = false;
    // The optional constructor dependency supports isolated fixtures. Runtime
    // Durable Objects receive only ctx/env and always use the real DB reader.
    this.readBetterAuthIdentity =
      dependencies.readBetterAuthIdentity || readBetterAuthIdentity;
  }
  fetch(req) {
    const operation = this.queue.then(() => this.run(req));
    this.queue = operation.catch(() => {});
    return operation;
  }
  async loadState() {
    if (!this.ctx.storage.sql)
      return (await this.ctx.storage.get('state')) || empty(); // memory fixture only
    // Normal business/mail/alarm processing retains its existing initializer.
    // A conservation read never creates a missing table on a fresh instance.
    if (!this.schemaReady) {
      this.ctx.storage.sql.exec(
        'CREATE TABLE IF NOT EXISTS seller_records (bucket TEXT NOT NULL, record_key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(bucket, record_key))',
      );
      this.schemaReady = true;
    }
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
  purgeAuth0EventReceipts(state, now = Date.now()) {
    state.auth0EventReceipts ||= {};
    for (const [id, receipt] of Object.entries(state.auth0EventReceipts))
      if (
        !receipt ||
        !Number.isFinite(receipt.expiresAt) ||
        receipt.expiresAt <= now
      )
        delete state.auth0EventReceipts[id];
  }
  uploadReceipts(state) {
    return Object.entries(state.idempotency).filter(
      ([, receipt]) => receipt?.kind === UPLOAD_RECEIPT_KIND,
    );
  }
  async expireUploadReceipts(state, now = Date.now()) {
    let deletions = 0;
    for (const [id, receipt] of this.uploadReceipts(state)) {
      if (receipt.expiresAt > now) continue;
      // Completed files retain their ordinary listing lifecycle. Only an
      // unfinished intent can own an R2 object without listing metadata.
      if (receipt.status === 'pending') {
        if (receipt.cleanupAfter > now) continue;
        if (state.files[receipt.file.key]) {
          // Fail closed if inconsistent metadata ever appears: an expiry job
          // must never delete an object referenced by a live listing file.
          receipt.cleanupAfter = now + HOUR;
          continue;
        }
        if (deletions >= UPLOAD_ORPHAN_CLEANUP_BATCH) continue;
        deletions++;
        try {
          if (!this.env.MEDIA) throw Error('Media storage unavailable.');
          await this.env.MEDIA.delete(receipt.file.key);
        } catch {
          // Keep the bounded reservation until deletion succeeds. Expired IDs
          // are rejected independently, so cleanup cannot enable a replay.
          receipt.cleanupAfter = now + HOUR;
          continue;
        }
      }
      delete state.idempotency[id];
    }
  }
  async scheduleAuth0ReceiptExpiry(state) {
    if (typeof this.ctx.storage.setAlarm !== 'function') return;
    const next = Math.min(
      ...Object.values(state.auth0EventReceipts || {})
        .map((receipt) => receipt?.expiresAt)
        .filter(
          (expiresAt) => Number.isFinite(expiresAt) && expiresAt > Date.now(),
        ),
      ...this.uploadReceipts(state).map(([, receipt]) =>
        Math.max(
          Date.now() + 1000,
          receipt.expiresAt,
          receipt.cleanupAfter || 0,
        ),
      ),
    );
    if (Number.isFinite(next)) await this.ctx.storage.setAlarm(next);
  }
  alarm() {
    const operation = this.queue.then(() => this.runAlarm());
    this.queue = operation.catch(() => {});
    return operation;
  }
  async runAlarm() {
    const state = await this.loadState();
    this.purgeAuth0EventReceipts(state);
    await this.expireUploadReceipts(state);
    await this.saveState(state);
    await this.scheduleAuth0ReceiptExpiry(state);
  }
  async run(req) {
    // Wider account/business digests require the separately scoped account-read
    // administrator. Keep this on the queue, outside BOTH persistence paths:
    // normal loadState drops unknown buckets and normal error handling saves.
    if (isConservationRequest(req)) return this.readConservation(req);
    this.state = await this.loadState();
    this.state.auth0EventReceipts ||= {};
    this.rollbackState = structuredClone(this.state);
    try {
      const result = await this.route(req);
      await this.saveState(this.state);
      return result;
    } catch (e) {
      if (
        this.env.CLERK_PRODUCTION_ENABLED === 'true' &&
        req.body &&
        !req.bodyUsed
      ) {
        try {
          await req.arrayBuffer();
        } catch {}
      }
      if (this.env.CLERK_PRODUCTION_ENABLED === 'true' && e.providerIdentity) {
        this.state = structuredClone(this.rollbackState);
        const key = await digest(
          e.providerIdentity.issuer + '|' + e.providerIdentity.subject,
        );
        const id = this.state.identities[key]?.userId;
        // Provider status arrives before adoption checks. An allowed QA email
        // must not fence a protected pre-existing identity/profile collision.
        if (
          !clerkQaOnlyEnabled(this.env) ||
          this.state.profiles[id]?.clerkQaCohort === CLERK_QA_COHORT
        ) {
          this.state.identitySecurity[key] = {
            ...this.state.identitySecurity[key],
            ...(e.providerIdentity.blocked ? { blocked: true } : {}),
            ...(Number.isFinite(e.providerIdentity.credentialsChangedAt)
              ? {
                  credentialsChangedAt: Math.max(
                    this.state.identitySecurity[key]?.credentialsChangedAt || 0,
                    e.providerIdentity.credentialsChangedAt,
                  ),
                }
              : {}),
          };
          if (id)
            for (const [sessionKey, record] of Object.entries(
              this.state.sessions,
            ))
              if (record.userId === id) delete this.state.sessions[sessionKey];
          e.persist = true;
        }
      }
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
      const clerkFailureStage = clerkFailureStages.has(e.authStage)
        ? e.authStage
        : '';
      return reply(
        {
          error: e.status
            ? e.message
            : 'The request could not be saved. Please retry.',
          ...(['TWO_FACTOR_REQUIRED', 'QA_ACCOUNT_REQUIRED'].includes(e.code)
            ? { code: e.code }
            : {}),
        },
        e.status || 503,
        clerkFailureStage
          ? { 'X-RWAS-Clerk-Failure-Stage': clerkFailureStage }
          : {},
      );
    }
  }
  async readConservation(req) {
    if (req.method !== 'GET')
      return reply(
        {
          error: 'Conservation capture is read-only.',
          code: 'READ_ONLY_METHOD',
        },
        405,
        { Allow: 'GET' },
      );
    try {
      assertAccountOrigin(req, this.env, false);
      const identity = await this.accountAdministrator(req, false, false);
      this.conservationCapture ||= new ConservationCapture({
        loadRows: () => loadConservationRows(this.ctx.storage),
        media: this.env.MEDIA,
      });
      return reply(await this.conservationCapture.handle(req, identity.actor));
    } catch (error) {
      // Never expose provider/storage messages, record keys, customer values or
      // any auth payload; never save/rollback/audit after capture failures.
      if (error instanceof ConservationError)
        return reply(
          {
            error: error.message,
            code: error.code,
            ...(error.metadataReason
              ? { metadataReason: error.metadataReason }
              : {}),
          },
          error.status,
        );
      const status = error.status === 403 ? 403 : 503;
      return reply(
        {
          error: 'Conservation account authorization or read unavailable.',
          code:
            status === 403 ? 'ACCOUNT_ADMIN_REQUIRED' : 'CAPTURE_UNAVAILABLE',
        },
        status,
      );
    }
  }
  async json(req, allowEmpty = false) {
    if (Number(req.headers.get('content-length') || 0) > 64000)
      fail(413, 'Request too large.');
    const reader = req.body?.getReader();
    if (!reader) {
      if (allowEmpty) return {};
      fail(400, 'Invalid JSON.');
    }
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
    if (allowEmpty && size === 0) return {};
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
      accountHeld(this.state.profiles[s.userId])
    )
      fail(401, 'Your session expired. Please sign in again.');
    if (s.method === CLERK_OWNER_METHOD || s.scope === 'clerk-link-only')
      fail(
        401,
        'Owner authentication can only connect an existing seller account.',
      );
    if (s.method === 'better-auth') {
      if (!betterAuthEnabled(this.env))
        fail(401, 'Seller sign-in is unavailable.');
      if (req.headers.get('X-RWAS-CSRF') !== s.csrf)
        fail(403, 'Seller session proof rejected.');
      const config = sellerAuthConfig(this.env);
      if (
        new URL(req.url).origin !== config.origin ||
        (!['GET', 'HEAD'].includes(req.method) &&
          req.headers.get('Origin') !== config.origin) ||
        (req.headers.get('Origin') &&
          req.headers.get('Origin') !== config.origin) ||
        req.headers.get('Sec-Fetch-Site') === 'cross-site'
      )
        fail(403, 'Seller session destination rejected.');
      const current = validateBetterAuthIdentity(
        await this.readBetterAuthIdentity(this.env, req, { recent }),
        recent,
      );
      assertBetterAuthQaEmail(this.env, current.email);
      if (
        betterAuthQaEnabled(this.env) &&
        this.state.profiles[s.userId].betterAuthQaCohort !==
          BETTER_AUTH_QA_COHORT
      )
        fail(403, 'Existing accounts cannot be used by the QA login.');
      if (
        current.issuer !== s.issuer ||
        current.subject !== s.subject ||
        current.providerSessionId !== s.providerSessionId ||
        current.createdAt !== s.providerSessionCreatedAt
      )
        fail(401, 'Seller identity changed. Please sign in again.');
      const security = this.state.identitySecurity[s.identityKey];
      if (
        security?.blocked ||
        security?.revokedProviderSessions?.[
          await digest(current.providerSessionId)
        ] ||
        current.createdAt <=
          Math.max(
            security?.credentialsChangedAt || 0,
            this.state.profiles[s.userId].sessionRevokedAt || 0,
          )
      )
        fail(401, 'Seller session was revoked.');
    } else if (
      betterAuthEnabled(this.env) &&
      (hasBetterAuthIdentity(this.state, s.userId) ||
        (!betterAuthQaEnabled(this.env) &&
          (!betterAuthLegacyLinkEnabled(this.env) ||
            s.method !== 'identity' ||
            !Object.values(this.state.identities).some(
              (identity) =>
                identity.userId === s.userId &&
                identity.issuer !== 'rwas-better-auth',
            ))))
    )
      fail(401, 'Sign in using the current seller login.');
    if (
      !betterAuthEnabled(this.env) &&
      clerkQaOnlyEnabled(this.env) &&
      this.state.profiles[s.userId].clerkQaCohort === CLERK_QA_COHORT &&
      s.method !== 'clerk-production'
    )
      fail(403, 'QA accounts require the verified Clerk test login.');
    if (s.method === 'clerk-production') {
      const config = clerkProductionConfig(this.env, req);
      if (!config || req.headers.get('X-RWAS-CSRF') !== s.csrf)
        fail(403, 'Production session proof rejected.');
      const current = await clerkProductionIdentity(this.env, req);
      assertClerkQaProfile(
        this.env,
        this.state.profiles[s.userId],
        current.email,
      );
      if (
        current.issuer !== s.issuer ||
        current.subject !== s.subject ||
        current.providerSessionId !== s.providerSessionId
      )
        fail(401, 'Provider session changed. Please sign in again.');
      if (current.passwordLastUpdatedAt !== s.passwordLastUpdatedAt) {
        const changedAt = Date.now();
        const security = (this.state.identitySecurity[s.identityKey] ||= {});
        security.providerResetHold = true;
        security.providerResetGeneration = current.passwordLastUpdatedAt;
        security.providerResetSessionId = s.providerSessionId;
        security.credentialsChangedAt = Math.max(
          security.credentialsChangedAt || 0,
          changedAt,
        );
        this.state.profiles[s.userId].sessionRevokedAt = Math.max(
          this.state.profiles[s.userId].sessionRevokedAt || 0,
          changedAt,
        );
        for (const [sessionKey, record] of Object.entries(this.state.sessions))
          if (record.userId === s.userId)
            delete this.state.sessions[sessionKey];
        throw Object.assign(new Error('Session was revoked.'), {
          status: 401,
          persist: true,
        });
      }
      const security = this.state.identitySecurity[s.identityKey];
      if (
        security?.blocked ||
        security?.providerResetHold ||
        (security?.credentialsChangedAt || 0) >= s.createdAt ||
        (this.state.profiles[s.userId].sessionRevokedAt || 0) >= s.createdAt
      )
        fail(401, 'Session was revoked.');
    }
    if (
      recent &&
      s.method !== 'better-auth' &&
      Date.now() - s.createdAt > 600000
    )
      fail(
        401,
        'Sign in again before changing your email or deleting your account.',
      );
    const profile = this.state.profiles[s.userId];
    const adminIds = String(this.env.BETTER_AUTH_ADMIN_USER_IDS || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const accountRole =
      s.method === 'better-auth' && adminIds.includes(s.subject)
        ? 'admin'
        : profile.email?.toLowerCase() === 'admin@rwas.team'
          ? 'restricted-admin'
          : 'seller';
    return { ...profile, sessionKey: key, accountRole };
  }
  async businessAdministrator(req, recent = false) {
    if (!this.state?.sessions) return null;
    const raw = (req.headers.get('Authorization') || '').replace(
      /^Bearer /,
      '',
    );
    if (!raw || !this.state.sessions[await hash(raw)]) return null;
    const user = await this.user(req, recent);
    if (user.accountRole !== 'admin')
      fail(403, 'Administrator access required.');
    const session = this.state.sessions[user.sessionKey];
    return {
      actor: user.email,
      scope: 'seller-accounts',
      expiresAt: session.expiresAt,
      authenticatedAt: session.providerSessionCreatedAt,
      canManage: session.providerSessionCreatedAt >= Date.now() - 600000,
      manageUntil: session.providerSessionCreatedAt + 600000,
    };
  }
  async admin(req) {
    const business = await this.businessAdministrator(
      req,
      !['GET', 'HEAD'].includes(req.method),
    );
    if (business) return business.actor;
    // Media elements cannot send a bearer header. A current HttpOnly provider
    // cookie may authorize reads only, after the same immutable-ID/MFA checks.
    const cookieActor = await this.cookieAdministrator(req);
    if (cookieActor) return cookieActor;
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
  async cookieAdministrator(req) {
    if (
      !['GET', 'HEAD'].includes(req.method) ||
      !betterAuthEnabled(this.env) ||
      !req.headers.get('Cookie')
    )
      return null;
    const config = sellerAuthConfig(this.env);
    if (
      new URL(req.url).origin !== config.origin ||
      req.headers.get('Sec-Fetch-Site') === 'cross-site'
    )
      return null;
    const raw = await this.readBetterAuthIdentity(this.env, req);
    if (!raw) return null;
    const identity = validateBetterAuthIdentity(raw);
    const ids = String(this.env.BETTER_AUTH_ADMIN_USER_IDS || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (!ids.includes(identity.subject)) return null;
    const key = await digest(identity.issuer + '|' + identity.subject),
      link = this.state.identities[key],
      security = this.state.identitySecurity[key];
    const profile = link && this.state.profiles[link.userId];
    if (
      accountHeld(profile) ||
      security?.blocked ||
      security?.revokedProviderSessions?.[
        await digest(identity.providerSessionId)
      ] ||
      identity.createdAt <=
        Math.max(
          security?.credentialsChangedAt || 0,
          profile.sessionRevokedAt || 0,
        )
    )
      return null;
    return identity.email;
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
  async accountAdministrator(req, recent = false, allowBusiness = true) {
    const business = allowBusiness
      ? await this.businessAdministrator(req, recent)
      : null;
    if (business) return business;
    const authorization = this.env.ACCOUNT_ADMIN_AUTH || {
      fetch: (request) => authorizeAccountAdministrator(request, this.env),
    };
    const result = await authorization.fetch(
      new Request('https://internal.invalid/authorize-accounts', {
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
          ? 'Account administration is not configured.'
          : 'Account administrator access required.',
      );
    const identity = await result.json();
    if (
      identity.scope !== 'seller-accounts' ||
      typeof identity.actor !== 'string' ||
      !identity.actor ||
      identity.actor.length > 254 ||
      !Number.isFinite(identity.expiresAt) ||
      identity.expiresAt <= Date.now()
    )
      fail(403, 'Account administrator access required.');
    const canManage =
      Number.isFinite(identity.authenticatedAt) &&
      identity.authenticatedAt >= Date.now() - 600000 &&
      identity.authenticatedAt <= Date.now() + 30000;
    if (recent && !canManage)
      fail(403, 'Sign in again before managing an account.');
    return {
      actor: identity.actor,
      canManage,
      expiresAt: identity.expiresAt,
      manageUntil: canManage ? identity.authenticatedAt + 600000 : null,
    };
  }
  owned(id, u) {
    if (u.accountRole && u.accountRole !== 'seller')
      fail(403, 'Administrative accounts cannot use seller listing tools.');
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
  async prepareCode(req, body, purpose = 'login', u) {
    const address = email(body.email);
    if (
      purpose === 'email-change' &&
      betterAuthQaEnabled(this.env) &&
      u?.betterAuthQaCohort === BETTER_AUTH_QA_COHORT
    )
      assertBetterAuthQaEmail(this.env, address);
    if (
      purpose === 'login' &&
      clerkQaOnlyEnabled(this.env) &&
      clerkQaEmail(address)
    )
      fail(403, 'QA accounts require the verified Clerk test login.');
    if (purpose === 'login') {
      const profile = Object.values(this.state.profiles).find(
        (p) => p.email === address,
      );
      if (profile && accountHeld(profile))
        fail(403, 'This account is unavailable. Contact RWAS.');
    }
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
    return { address, key, pendingCode, value };
  }
  async sendCode(req, body, purpose = 'login', u) {
    if (this.env.MAIL_VIA_PAGES === 'true')
      fail(503, 'Email delivery must use the configured site.');
    const { address, key, pendingCode, value } = await this.prepareCode(
      req,
      body,
      purpose,
      u,
    );
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
  async mailRequest(req, path) {
    if (
      this.env.MAIL_VIA_PAGES !== 'true' ||
      new URL(req.url).origin !== 'https://seller-service.internal'
    )
      fail(404, 'Not found.');
    const body = await this.json(req);
    // Only this private service-binding route may reconstruct the canonical
    // auth request. Public origin checks and Clerk verification stay unchanged.
    const mailOwner = async () => {
      if (
        !body.context &&
        (!betterAuthEnabled(this.env) || betterAuthQaEnabled(this.env)) &&
        (this.env.CLERK_PRODUCTION_ENABLED !== 'true' ||
          clerkQaOnlyEnabled(this.env))
      )
        return this.user(req, true);
      const authenticated = mailAuthenticationRequest(
        body.context,
        req.headers.get('Authorization') || '',
      );
      let owner;
      if (betterAuthQaEnabled(this.env)) {
        owner = await this.user(authenticated, true);
        if (this.state.sessions[owner.sessionKey]?.method !== 'better-auth')
          return owner;
      }
      if (betterAuthEnabled(this.env)) {
        if (body.context?.schema !== 2 || !sellerAuthConfig(this.env))
          fail(403, 'Seller authentication proof is required.');
      } else if (!clerkProductionConfig(this.env, authenticated))
        fail(503, 'Production Clerk authentication is unavailable.');
      owner ||= await this.user(authenticated, true);
      const expectedMethod = betterAuthEnabled(this.env)
        ? 'better-auth'
        : 'clerk-production';
      if (this.state.sessions[owner.sessionKey]?.method !== expectedMethod)
        fail(403, 'The selected seller sign-in is required.');
      return owner;
    };
    this.state.mailRequests ||= {};
    this.state.mailSequences ||= {};
    // Expired delivery tickets can never activate or resurrect a consumed code.
    for (const [id, request] of Object.entries(this.state.mailRequests))
      if (Date.now() - request.createdAt > 900000)
        delete this.state.mailRequests[id];
    if (path === '/_mail/start') {
      if (
        body.purpose === 'login' &&
        ((betterAuthEnabled(this.env) && !betterAuthQaEnabled(this.env)) ||
          this.env.EMAIL_CODE_LOGIN_ENABLED !== 'true' ||
          (this.env.CLERK_PRODUCTION_ENABLED === 'true' &&
            !clerkQaOnlyEnabled(this.env)))
      )
        fail(404, 'Email-code sign-in is unavailable.');
      if (!['login', 'email-change'].includes(body.purpose))
        fail(400, 'Invalid verification purpose.');
      const u = body.purpose === 'email-change' ? await mailOwner() : undefined;
      const { address, key, pendingCode, value } = await this.prepareCode(
        req,
        body,
        body.purpose,
        u,
      );
      const sequence = (this.state.mailSequences[key] || 0) + 1;
      this.state.mailSequences[key] = sequence;
      const ticket = token();
      this.state.mailRequests[ticket] = {
        key,
        sequence,
        pendingCode,
        createdAt: Date.now(),
        status: 'pending',
      };
      return reply({
        ticket,
        to: address,
        code: value,
        purpose: body.purpose,
        expiresMinutes: 15,
      });
    }
    const item =
      typeof body.ticket === 'string' &&
      Object.hasOwn(this.state.mailRequests, body.ticket)
        ? this.state.mailRequests[body.ticket]
        : undefined;
    if (!item) fail(400, 'Verification delivery expired or unavailable.');
    if (path === '/_mail/cancel') {
      if (item.status === 'pending') {
        item.status = 'cancelled';
        delete item.pendingCode;
      }
      return reply({ ok: true });
    }
    if (path !== '/_mail/confirm') fail(404, 'Not found.');
    if (item.status === 'complete') return reply({ ok: true });
    if (
      item.status !== 'pending' ||
      this.state.mailSequences[item.key] !== item.sequence
    )
      fail(409, 'A newer verification request exists. Request a new code.');
    // Email-change delivery must not survive logout, block or session expiry.
    if (item.pendingCode.purpose === 'email-change') {
      const u = await mailOwner();
      if (u.id !== item.pendingCode.userId)
        fail(403, 'Verification owner changed.');
    }
    this.state.codes[item.key] = item.pendingCode;
    item.status = 'complete';
    delete item.pendingCode;
    return reply({ ok: true });
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
    if (
      !betterAuthEnabled(this.env) &&
      clerkQaOnlyEnabled(this.env) &&
      (clerkQaEmail(profile.email) || profile.clerkQaCohort === CLERK_QA_COHORT)
    )
      fail(403, 'QA accounts require the verified Clerk test login.');
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
  async revokeBetterAuthBusinessSessions(profileId, selected) {
    for (const [key, session] of Object.entries(this.state.sessions)) {
      if (
        session.userId !== profileId ||
        session.method !== 'better-auth' ||
        !selected(key, session)
      )
        continue;
      const security = (this.state.identitySecurity[session.identityKey] ||=
        {});
      const revoked = (security.revokedProviderSessions ||= {});
      // Provider expiry may roll forward. A local logout tombstone must not
      // expire merely because the originally observed expiry has passed.
      revoked[await digest(session.providerSessionId)] = true;
      if (Object.keys(revoked).length > 512) {
        this.state.profiles[profileId].sessionRevokedAt = Date.now();
        security.revokedProviderSessions = {};
      }
    }
  }
  accountSessionRows(profileId, currentKey) {
    const groups = new Map();
    for (const [id, session] of Object.entries(this.state.sessions)) {
      if (session.userId !== profileId || session.expiresAt <= Date.now())
        continue;
      const group =
        session.method === 'better-auth'
          ? session.identityKey + ':' + session.providerSessionId
          : id;
      const previous = groups.get(group);
      if (previous?.current) continue;
      groups.set(group, {
        id,
        createdAt:
          session.method === 'better-auth'
            ? session.providerSessionCreatedAt
            : session.createdAt,
        expiresAt: session.expiresAt,
        current: id === currentKey,
      });
    }
    return [...groups.values()];
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
  async applyProviderSecurityEvent(body, config) {
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
        if (session.userId === identity.userId) delete this.state.sessions[key];
      for (const [key, code] of Object.entries(this.state.codes))
        if (
          code.userId === identity.userId ||
          (profile && key === 'login:' + profile.email)
        )
          delete this.state.codes[key];
      for (const request of Object.values(this.state.mailRequests || {}))
        if (
          request.status === 'pending' &&
          ((profile && request.key === 'login:' + profile.email) ||
            request.pendingCode?.userId === identity.userId)
        ) {
          request.status = 'cancelled';
          delete request.pendingCode;
        }
      this.audit('provider-session-revoke', identity.userId, {
        kind: body.kind,
      });
    }
    this.state.authEvents[body.id] = Date.now();
    return reply({ ok: true });
  }
  async route(req) {
    const url = new URL(req.url),
      method = req.method;
    let path = url.pathname.replace(/^\/api\/aircraft-sale/, '') || '/';
    // The legacy /admin paths retain their independent Access application.
    // This namespace accepts only the current configured MFA administrator,
    // never an Access reviewer credential or an email-only role claim.
    if (path.startsWith('/staff/')) {
      if (
        !/^\/staff\/(?:listings(?:\/[A-Za-z0-9_-]+)?|review|accounts(?:\/[A-Za-z0-9_-]+(?:\/(?:preview|apply))?)?|support(?:\/[A-Za-z0-9_-]+)?|files\/.+)$/.test(
          path,
        )
      )
        fail(404, 'Staff action not found.');
      const business = await this.businessAdministrator(
        req,
        !['GET', 'HEAD'].includes(method),
      );
      if (
        !business &&
        !(
          path.startsWith('/staff/files/') &&
          (await this.cookieAdministrator(req))
        )
      )
        fail(403, 'Verified administrator sign-in required.');
      path = path.replace(/^\/staff\//, '/admin/');
    }
    if (path.startsWith('/_mail/') && method === 'POST')
      return this.mailRequest(req, path);
    if (method === 'OPTIONS') return new Response(null, { status: 204 }); // Same-origin service; no wildcard CORS.
    if (path === '/health') return reply({ service: 'seller-v2', schema: 2 });
    if (path === '/_identity-deletion-intent') {
      if (new URL(req.url).origin !== 'https://seller-service.internal')
        fail(404, 'Not found.');
      if (method !== 'POST' || !betterAuthEnabled(this.env))
        fail(404, 'Not found.');
      const body = await this.json(req);
      if (
        !body ||
        Object.keys(body).sort().join(',') !== 'issuer,subject' ||
        body.issuer !== 'rwas-better-auth' ||
        typeof body.subject !== 'string' ||
        !body.subject ||
        body.subject.length > 500
      )
        fail(400, 'Invalid identity deletion check.');
      const key = await digest(body.issuer + '|' + body.subject);
      if (this.state.identities[key]) return reply({ allowed: false });
      const history = this.state.identitySecurity[key];
      if (!history) {
        // Reserve this never-adopted subject before D1 deletion. The Durable
        // Object queue commits the fence before any competing bridge request.
        this.state.identitySecurity[key] = {
          blocked: true,
          identityDeletionIntent: true,
          deletedAt: Date.now(),
          deletedProfileId: null,
        };
        return reply({ allowed: true });
      }
      return reply({
        allowed: completedBetterAuthBusinessDeletion(this.state, key),
      });
    }
    if (betterAuthEnabled(this.env)) {
      if (path.startsWith('/auth/clerk-production/')) fail(404, 'Not found.');
      if (
        path === '/auth/methods' &&
        method === 'GET' &&
        (!betterAuthQaEnabled(this.env) ||
          req.headers.get('X-RWAS-Seller-QA') === 'better-auth')
      ) {
        const config = sellerAuthConfig(this.env);
        const legacy =
          !betterAuthQaEnabled(this.env) &&
          betterAuthLegacyLinkEnabled(this.env)
            ? identityConfig(this.env)
            : null;
        return reply({
          methods: ['better-auth'],
          emailCode: false,
          betterAuth: {
            providers: config.methods,
            legacyLink: Boolean(legacy),
          },
          ...(legacy
            ? {
                legacyMethods: Object.keys(legacy.methods).filter(
                  (value) =>
                    this.env.PASSWORD_ONLY_LOGIN !== 'true' ||
                    value === 'password',
                ),
              }
            : {}),
          publicListings: sellerPublicListingsEnabled(this.env),
        });
      }
      if (['/auth/better-auth', '/auth/better-auth/link'].includes(path)) {
        if (method !== 'POST') fail(405, 'Method not allowed.');
        const config = sellerAuthConfig(this.env);
        assertBetterAuthOrigin(req, config);
        const body = await this.json(req, true);
        if (
          !body ||
          typeof body !== 'object' ||
          Array.isArray(body) ||
          (Object.keys(body).length > 0 &&
            (Object.keys(body).sort().join(',') !==
              'expectedSessionId,expectedUserId' ||
              ![body.expectedUserId, body.expectedSessionId].every(
                (value) =>
                  typeof value === 'string' &&
                  value.length > 0 &&
                  value.length <= 500,
              )))
        )
          fail(400, 'Invalid seller authentication request.');
        const linking = path.endsWith('/link');
        if (linking && betterAuthQaEnabled(this.env))
          fail(403, 'Existing accounts cannot be connected by the QA login.');
        const owner = linking ? await this.user(req, true) : null;
        if (
          linking &&
          (!betterAuthLegacyLinkEnabled(this.env) ||
            this.state.sessions[owner.sessionKey]?.method !== 'identity')
        )
          fail(
            403,
            'An existing verified account login is required to connect accounts.',
          );
        const external = validateBetterAuthIdentity(
          await this.readBetterAuthIdentity(this.env, req, { recent: linking }),
          linking,
        );
        assertBetterAuthQaEmail(this.env, external.email);
        if (
          body.expectedUserId !== undefined &&
          (body.expectedUserId !== external.subject ||
            body.expectedSessionId !== external.providerSessionId)
        )
          fail(401, 'Seller identity changed. Start again.');
        const identityKey = await digest(
          external.issuer + '|' + external.subject,
        );
        this.rate('better-auth:' + identityKey, 30);
        const existing = this.state.identities[identityKey];
        const security = this.state.identitySecurity[identityKey];
        if (completedBetterAuthBusinessDeletion(this.state, identityKey))
          return reply(
            {
              error: 'Seller account was removed; finish identity deletion.',
              code: 'ACCOUNT_DELETION_PENDING',
            },
            409,
          );
        if (
          security?.blocked ||
          security?.revokedProviderSessions?.[
            await digest(external.providerSessionId)
          ] ||
          external.createdAt <= (security?.credentialsChangedAt || 0)
        )
          fail(401, 'Seller session was revoked.');
        let profile;
        if (owner) {
          profile = this.state.profiles[owner.id];
          if (existing && existing.userId !== owner.id)
            fail(409, 'That login belongs to another RWAS account.');
        } else if (existing) profile = this.state.profiles[existing.userId];
        else {
          if (
            Object.values(this.state.profiles).some(
              (value) => value.email.toLowerCase() === external.email,
            )
          )
            fail(
              409,
              'This email already has a RWAS account. Use your existing login and connect it in Account.',
            );
          profile = {
            id: crypto.randomUUID(),
            email: external.email,
            name: external.name,
            phone: '',
            location: '',
            createdAt: Date.now(),
            ...(betterAuthQaEnabled(this.env)
              ? { betterAuthQaCohort: BETTER_AUTH_QA_COHORT }
              : {}),
          };
          this.state.profiles[profile.id] = profile;
        }
        if (!profile || accountHeld(profile)) fail(403, 'Account unavailable.');
        if (
          betterAuthQaEnabled(this.env) &&
          profile.betterAuthQaCohort !== BETTER_AUTH_QA_COHORT
        )
          fail(403, 'Existing accounts cannot be used by the QA login.');
        if (
          external.createdAt <=
          Math.max(
            existing?.credentialsChangedAt || 0,
            profile.sessionRevokedAt || 0,
          )
        )
          fail(401, 'Sign in again after the account security change.');
        this.state.identities[identityKey] = {
          userId: profile.id,
          issuer: external.issuer,
          subject: external.subject,
          method: 'better-auth',
          createdAt: existing?.createdAt || Date.now(),
          credentialsChangedAt: existing?.credentialsChangedAt || 0,
        };
        // Retire legacy access atomically with identity adoption. Older login
        // methods must not bypass this identity's MFA/reset/revocation rules.
        for (const [key, session] of Object.entries(this.state.sessions))
          if (session.userId === profile.id && session.method !== 'better-auth')
            delete this.state.sessions[key];
        const raw = token(),
          csrf = token();
        this.state.sessions[await hash(raw)] = {
          userId: profile.id,
          method: 'better-auth',
          csrf,
          identityKey,
          issuer: external.issuer,
          subject: external.subject,
          providerSessionId: external.providerSessionId,
          providerSessionCreatedAt: external.createdAt,
          createdAt: Date.now(),
          expiresAt: Math.min(Date.now() + 2 * DAY, external.expiresAt),
        };
        this.audit(owner ? 'identity-link' : 'identity-login', profile.id, {
          method: 'better-auth',
        });
        return reply({
          ok: true,
          provider: 'better-auth',
          identityUserId: external.subject,
          identitySessionId: external.providerSessionId,
          session: raw,
          csrf,
          email: profile.email,
          name: profile.name,
        });
      }
      if (
        ['/auth/start', '/auth/finish', '/send-code', '/check-code'].includes(
          path,
        ) &&
        !betterAuthQaEnabled(this.env) &&
        (!betterAuthLegacyLinkEnabled(this.env) ||
          ['/send-code', '/check-code'].includes(path))
      )
        fail(404, 'Legacy seller login is unavailable.');
    }
    if (path.startsWith('/auth/clerk-production/')) {
      const config = clerkProductionConfig(this.env, req);
      if (!config) fail(404, 'Not found.');
      if (method !== 'POST') fail(405, 'Method not allowed.');
      if (
        clerkQaOnlyEnabled(this.env) &&
        (path.startsWith('/auth/clerk-production/link/') ||
          path.startsWith('/auth/clerk-production/owner/'))
      )
        fail(403, 'Existing account adoption is disabled for the QA release.');
      const linkFinishing = path === '/auth/clerk-production/link/finish';
      const ownerFinishing = path === '/auth/clerk-production/owner/finish';
      if (
        !linkFinishing &&
        !ownerFinishing &&
        req.headers.get('Origin') !== config.origin
      )
        fail(403, 'Origin rejected.');
      const body = await this.json(req);
      if (path === '/auth/clerk-production/owner/start' || ownerFinishing) {
        const ownerConfig = clerkOwnerConfig(this.env, config.origin);
        let tx;
        if (ownerFinishing) {
          const key = await digest(
            typeof body?.state === 'string' ? body.state : '',
          );
          tx = this.state.authTransactions[key];
          if (!tx || tx.purpose !== CLERK_OWNER_PURPOSE)
            fail(401, 'Owner authentication expired. Start again.');
          delete this.state.authTransactions[key];
          await this.saveState(this.state);
          this.rollbackState = structuredClone(this.state);
          if (!Number.isSafeInteger(tx.expiresAt) || tx.expiresAt <= Date.now())
            fail(401, 'Owner authentication expired. Start again.');
          if (req.headers.get('Origin') !== config.origin)
            fail(403, 'Origin rejected.');
          if (!ownerConfig)
            fail(503, 'Existing-owner authentication is unavailable.');
          await clerkOwnerFinishProof(tx, req, body, ownerConfig);
          if (body.error)
            fail(
              400,
              'Owner authentication was cancelled. Your account was not changed.',
            );
        } else {
          if (!ownerConfig)
            fail(503, 'Existing-owner authentication is unavailable.');
          clerkOwnerInput(req, body);
        }
        const currentClerk = await clerkProductionIdentity(this.env, req);
        if (ownerFinishing) clerkOwnerProviderProof(tx, currentClerk);
        if (!ownerFinishing) {
          const clerkIdentityKey = await digest(
            currentClerk.issuer + '|' + currentClerk.subject,
          );
          const security = this.state.identitySecurity[clerkIdentityKey];
          if (security?.blocked || security?.providerResetHold)
            fail(403, 'Account unavailable.');
          if (this.state.identities[clerkIdentityKey])
            fail(
              409,
              'That secure login is already connected to a seller account.',
            );
          this.rate('clerk-owner-reauth:' + clerkIdentityKey, 10);
          this.rate(
            'clerk-owner-ip:' +
              (await hash(req.headers.get('CF-Connecting-IP') || 'local')),
            20,
          );
          for (const [key, value] of Object.entries(
            this.state.authTransactions,
          ))
            if (value.expiresAt <= Date.now())
              delete this.state.authTransactions[key];
          const csrf = token();
          tx = {
            purpose: CLERK_OWNER_PURPOSE,
            method: 'password',
            state: randomProof(),
            nonce: randomProof(),
            verifier: randomProof(),
            browserProof: await digest(body.proof),
            csrfProof: await digest(csrf),
            origin: config.origin,
            ownerIssuer: ownerConfig.issuer,
            ownerClientId: ownerConfig.clientId,
            ownerCallback: ownerConfig.callback,
            ...clerkOwnerProviderBinding(currentClerk),
            clerkSessionExpiresAt: currentClerk.providerSessionExpiresAt,
            createdAt: Date.now(),
            expiresAt: Date.now() + 300000,
          };
          this.state.authTransactions[await digest(tx.state)] = tx;
          return reply({
            state: tx.state,
            csrf,
            authorizationUrl: await authorizationUrl(ownerConfig, tx),
          });
        }
        const external = await exchangeIdentity(
          this.env,
          ownerConfig,
          tx,
          body.code,
        );
        const owner = await clerkOwnerAccount(this.state, external, tx);
        await clerkLinkIdentity(this.state, owner, currentClerk, tx.createdAt);
        const raw = token(),
          ownerCsrf = token();
        const expiresAt = Math.min(
          Date.now() + 300000,
          owner.authenticatedAt + 600000,
          tx.clerkSessionExpiresAt,
        );
        this.state.sessions[await hash(raw)] = {
          method: CLERK_OWNER_METHOD,
          scope: 'clerk-link-only',
          userId: owner.profile.id,
          identityKey: owner.identityKey,
          issuer: external.issuer,
          subject: external.subject,
          authenticatedAt: owner.authenticatedAt,
          ownerCsrf,
          ...clerkOwnerProviderBinding(currentClerk),
          createdAt: Date.now(),
          expiresAt,
        };
        this.audit('clerk-owner-proof-issued', owner.profile.id, {
          method: 'password',
        });
        return reply({
          ok: true,
          ownerProof: raw,
          ownerCsrf,
          expiresAt,
          email: owner.profile.email,
          name: owner.profile.name,
        });
      }
      if (path === '/auth/clerk-production/link/start' || linkFinishing) {
        let tx;
        if (linkFinishing) {
          const nonceKey = await hash(
            typeof body?.nonce === 'string' ? body.nonce : '',
          );
          tx = this.state.authTransactions[nonceKey];
          if (!tx || tx.method !== 'clerk-production-link')
            fail(401, 'Account connection expired. Start again.');
          // Persist consumption before validating either credential or proof.
          // Failed provider calls, changed owners and rejected CSRF cannot replay.
          delete this.state.authTransactions[nonceKey];
          await this.saveState(this.state);
          this.rollbackState = structuredClone(this.state);
          if (!Number.isSafeInteger(tx.expiresAt) || tx.expiresAt <= Date.now())
            fail(401, 'Account connection expired. Start again.');
          if (req.headers.get('Origin') !== config.origin)
            fail(403, 'Origin rejected.');
        }
        clerkLinkInput(req, body, linkFinishing);
        const ownerSessionKey = await hash(
          (req.headers.get('Authorization') || '').replace(/^Bearer /, ''),
        );
        const owner = clerkLinkOwner(
          this.state,
          ownerSessionKey,
          Date.now(),
          identityConfig(this.env)?.issuer,
        );
        if (linkFinishing)
          await clerkLinkFinishProof(tx, owner, req, body, config.origin);
        const external = await clerkProductionIdentity(this.env, req);
        clerkLinkOwnerProviderProof(owner, external, req);
        if (linkFinishing) clerkLinkProviderProof(tx, external);
        const identityKey = await clerkLinkIdentity(
          this.state,
          owner,
          external,
          tx?.createdAt || Date.now(),
        );
        if (!linkFinishing) {
          this.rate('clerk-production-link:' + owner.profile.id, 10);
          for (const [key, value] of Object.entries(
            this.state.authTransactions,
          ))
            if (value.expiresAt <= Date.now())
              delete this.state.authTransactions[key];
          const nonce = token(),
            csrf = token();
          this.state.authTransactions[await hash(nonce)] =
            await clerkLinkTransaction(
              owner,
              external,
              config.origin,
              body.proof,
              csrf,
            );
          return reply({ nonce, csrf });
        }
        this.state.identities[identityKey] = {
          userId: owner.profile.id,
          issuer: external.issuer,
          subject: external.subject,
          method: 'clerk-production',
          createdAt: Date.now(),
          credentialsChangedAt: 0,
        };
        // Complete the cutover by retiring existing RWAS bearer sessions. No
        // seller profile, listing owner or pre-existing identity is rewritten.
        for (const [key, session] of Object.entries(this.state.sessions))
          if (session.userId === owner.profile.id)
            delete this.state.sessions[key];
        for (const [key, transaction] of Object.entries(
          this.state.authTransactions,
        ))
          if (transaction.linkUserId === owner.profile.id)
            delete this.state.authTransactions[key];
        const raw = token(),
          csrf = token();
        this.state.sessions[await hash(raw)] = {
          userId: owner.profile.id,
          method: 'clerk-production',
          csrf,
          identityKey,
          issuer: external.issuer,
          subject: external.subject,
          providerSessionId: external.providerSessionId,
          passwordLastUpdatedAt: external.passwordLastUpdatedAt,
          createdAt: Date.now(),
          expiresAt: Math.min(
            Date.now() + DAY,
            external.providerSessionExpiresAt,
          ),
        };
        this.audit('identity-link', owner.profile.id, {
          method: 'clerk-production',
        });
        return reply({ ok: true, session: raw, csrf });
      }
      if (path === '/auth/clerk-production/start') {
        const initiated = await clerkProductionIdentity(this.env, req);
        if (clerkQaOnlyEnabled(this.env)) {
          const existing =
            this.state.identities[
              await digest(initiated.issuer + '|' + initiated.subject)
            ];
          if (existing)
            assertClerkQaProfile(
              this.env,
              this.state.profiles[existing.userId],
              initiated.email,
            );
          else if (
            Object.values(this.state.profiles).some(
              (profile) => profile.email === initiated.email,
            )
          )
            fail(409, 'Accounts are never linked by email.');
        }
        this.rate(
          'clerk-production-login:' +
            (await digest(initiated.issuer + '|' + initiated.subject)),
          20,
        );
        for (const [key, value] of Object.entries(this.state.authTransactions))
          if (value.expiresAt <= Date.now())
            delete this.state.authTransactions[key];
        const nonce = token();
        this.state.authTransactions[await hash(nonce)] = {
          method: 'clerk-production',
          origin: config.origin,
          issuer: initiated.issuer,
          subject: initiated.subject,
          providerSessionId: initiated.providerSessionId,
          passwordLastUpdatedAt: initiated.passwordLastUpdatedAt,
          createdAt: Date.now(),
          expiresAt: Date.now() + 300000,
        };
        return reply({ nonce });
      }
      if (path !== '/auth/clerk-production/finish') fail(404, 'Not found.');
      const nonceKey = await hash(String(body.nonce || ''));
      const tx = this.state.authTransactions[nonceKey];
      if (!tx || tx.method !== 'clerk-production' || tx.expiresAt <= Date.now())
        fail(401, 'Login transaction expired.');
      delete this.state.authTransactions[nonceKey];
      await this.saveState(this.state);
      this.rollbackState = structuredClone(this.state);
      const external = await clerkProductionIdentity(this.env, req);
      if (
        tx.origin !== config.origin ||
        tx.issuer !== external.issuer ||
        tx.subject !== external.subject ||
        tx.providerSessionId !== external.providerSessionId ||
        tx.passwordLastUpdatedAt !== external.passwordLastUpdatedAt
      )
        fail(401, 'Login transaction identity mismatch.');
      const identityKey = await digest(
        external.issuer + '|' + external.subject,
      );
      const security = this.state.identitySecurity[identityKey];
      if (
        security?.blocked ||
        tx.createdAt <= (security?.credentialsChangedAt || 0)
      )
        fail(403, 'Account unavailable.');
      const existing = this.state.identities[identityKey];
      let profile = existing && this.state.profiles[existing.userId];
      if (!existing) {
        if (
          Object.values(this.state.profiles).some(
            (candidate) => candidate.email === external.email,
          )
        )
          fail(409, 'Accounts are never linked by email.');
        profile = {
          id: crypto.randomUUID(),
          email: external.email,
          name: external.name || '',
          phone: '',
          location: '',
          createdAt: Date.now(),
          ...(clerkQaOnlyEnabled(this.env)
            ? { clerkQaCohort: CLERK_QA_COHORT }
            : {}),
        };
        this.state.profiles[profile.id] = profile;
      }
      assertClerkQaProfile(this.env, profile, external.email);
      if (
        !profile ||
        accountHeld(profile) ||
        tx.createdAt <=
          Math.max(
            existing?.credentialsChangedAt || 0,
            profile.sessionRevokedAt || 0,
          )
      )
        fail(403, 'Account unavailable.');
      if (security?.providerResetHold) {
        // Clear only our provider-reset hold. Manual profile flags, identity
        // blocks, and revocation fences above remain authoritative and intact.
        // A new nonce or refreshed JWT on the old provider session is not recovery.
        if (
          !Number.isSafeInteger(security.providerResetGeneration) ||
          security.providerResetGeneration <= 0 ||
          !Number.isSafeInteger(external.passwordLastUpdatedAt) ||
          external.passwordLastUpdatedAt < security.providerResetGeneration ||
          !Number.isSafeInteger(external.providerSessionCreatedAt) ||
          external.providerSessionCreatedAt <= external.passwordLastUpdatedAt ||
          external.providerSessionCreatedAt <= security.credentialsChangedAt ||
          external.providerSessionCreatedAt > tx.createdAt ||
          !security.providerResetSessionId ||
          external.providerSessionId === security.providerResetSessionId
        )
          fail(403, 'Fresh provider sign-in required.');
        security.providerResetHold = false;
        this.audit('provider-reset-recovered', profile.id, {
          method: 'clerk-production',
        });
      }
      this.state.identities[identityKey] = {
        userId: profile.id,
        issuer: external.issuer,
        subject: external.subject,
        method: 'clerk-production',
        createdAt: existing?.createdAt || Date.now(),
        credentialsChangedAt: existing?.credentialsChangedAt || 0,
      };
      const raw = token(),
        csrf = token();
      this.state.sessions[await hash(raw)] = {
        userId: profile.id,
        method: 'clerk-production',
        csrf,
        identityKey,
        issuer: external.issuer,
        subject: external.subject,
        providerSessionId: external.providerSessionId,
        passwordLastUpdatedAt: external.passwordLastUpdatedAt,
        createdAt: Date.now(),
        expiresAt: Math.min(
          Date.now() + DAY,
          external.providerSessionExpiresAt,
        ),
      };
      this.audit('identity-login', profile.id, { method: 'clerk-production' });
      return reply({ ok: true, session: raw, csrf });
    }
    if (
      !betterAuthEnabled(this.env) &&
      this.env.CLERK_PRODUCTION_ENABLED === 'true' &&
      !clerkQaOnlyEnabled(this.env) &&
      (path.startsWith('/auth/') ||
        ['/send-code', '/check-code'].includes(path)) &&
      !(
        method === 'POST' &&
        ['/auth/events', '/auth/auth0-events'].includes(path)
      )
    ) {
      if (path === '/auth/methods' && method === 'GET') {
        // Advertise Clerk only when the complete runtime configuration used by
        // the start/finish routes is valid for this exact production origin.
        clerkProductionConfig(this.env, req);
        return reply({
          methods: ['clerk-production'],
          emailCode: false,
          existingAccountLink: 'fresh-email-code-session',
          ...(clerkOwnerConfig(this.env, new URL(req.url).origin)
            ? { existingAccountOwnerReauth: 'auth0-password' }
            : {}),
          publicListings: sellerPublicListingsEnabled(this.env),
        });
      }
      fail(
        404,
        'Alternate login is disabled when production Clerk is enabled.',
      );
    }
    if (path === '/auth/methods' && method === 'GET') {
      const qaOnly = clerkQaOnlyEnabled(this.env),
        qaEmail = qaOnly && clerkQaEmail(req.headers.get('X-RWAS-QA-Email'));
      if (qaEmail) {
        clerkProductionConfig(this.env, req);
        return reply({
          methods: ['clerk-production'],
          emailCode: false,
          clerkQaOnly: true,
          clerkQaEmail: qaEmail,
          publicListings: sellerPublicListingsEnabled(this.env),
        });
      }
      const config = identityConfig(this.env);
      return reply({
        methods: config
          ? Object.keys(config.methods).filter(
              (method) =>
                this.env.PASSWORD_ONLY_LOGIN !== 'true' ||
                method === 'password',
            )
          : [],
        emailCode: this.env.EMAIL_CODE_LOGIN_ENABLED === 'true',
        ...(qaOnly ? { clerkQaOnly: true } : {}),
        publicListings: sellerPublicListingsEnabled(this.env),
      });
    }
    if (path === '/auth/start' && method === 'POST') {
      const config = identityConfig(this.env),
        body = await this.json(req);
      if (
        betterAuthEnabled(this.env) &&
        !betterAuthQaEnabled(this.env) &&
        body.link === true
      )
        fail(403, 'Legacy login can only recover an existing owner account.');
      if (
        !config ||
        !config.methods[body.method] ||
        (this.env.PASSWORD_ONLY_LOGIN === 'true' && body.method !== 'password')
      )
        fail(503, 'This sign-in method is not available.');
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
      if (
        betterAuthEnabled(this.env) &&
        linkUser &&
        hasBetterAuthIdentity(this.state, linkUser.id)
      )
        fail(403, 'The selected seller account cannot connect a legacy login.');
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
      if (tx.purpose !== undefined || !config.methods[tx.method])
        fail(400, 'Sign-in transaction belongs to another flow. Start again.');
      if (body.error)
        fail(400, 'Sign-in was cancelled. Your account was not changed.');
      const external = await exchangeIdentity(this.env, config, tx, body.code);
      if (clerkQaOnlyEnabled(this.env) && clerkQaEmail(external.email))
        fail(403, 'QA accounts require the verified Clerk test login.');
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
      if (
        betterAuthEnabled(this.env) &&
        ((existing && hasBetterAuthIdentity(this.state, existing.userId)) ||
          (tx.linkUserId && hasBetterAuthIdentity(this.state, tx.linkUserId)) ||
          (!betterAuthQaEnabled(this.env) &&
            (!existing ||
              tx.linkUserId ||
              !this.state.profiles[existing.userId])))
      )
        fail(403, 'Legacy login can only recover an existing owner account.');
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
            this.env.EMAIL_CODE_LOGIN_ENABLED === 'true'
              ? 'This email already has a RWAS account. Sign in with an email code, then connect this login in Account.'
              : 'This email already has a RWAS account. Contact RWAS to connect this login.',
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
      if (accountHeld(profile))
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
    const receiptMatch = path.match(
      /^\/admin\/auth0-event-receipts\/(a0_[a-f0-9]{64})$/,
    );
    if (receiptMatch) {
      if (method !== 'GET') fail(405, 'Method not allowed.');
      if (url.search || url.hash) fail(400, 'Invalid receipt lookup.');
      await this.accountAdministrator(req, false);
      assertAccountOrigin(req, this.env, false);
      this.purgeAuth0EventReceipts(this.state);
      const receipt = this.state.auth0EventReceipts[receiptMatch[1]];
      if (!receipt)
        throw Object.assign(new Error('Event receipt not found.'), {
          status: 404,
          persist: true,
        });
      return reply({
        receiptId: receiptMatch[1],
        type: receipt.type,
        outcome: receipt.outcome,
        time: new Date(receipt.eventTime).toISOString(),
        receivedAt: new Date(receipt.receivedAt).toISOString(),
        source: receipt.source,
        tenant: receipt.tenant,
        stream: receipt.stream,
      });
    }
    if (/^\/admin\/accounts(?:\/|$)/.test(path)) {
      const write = method !== 'GET',
        identity = await this.accountAdministrator(req, write);
      assertAccountOrigin(req, this.env, write);
      if (path === '/admin/accounts' && method === 'GET')
        return reply({ ...accountDirectory(this.state, url), ...identity });
      const match = path.match(
        /^\/admin\/accounts\/([A-Za-z0-9_-]{1,128})(?:\/(preview|apply))?$/,
      );
      if (!match) fail(404, 'Account administration action not found.');
      const [, accountId, action] = match;
      if (method === 'GET' && !action)
        return reply({ ...accountDetail(this.state, accountId), ...identity });
      if (method !== 'POST' || !action) fail(405, 'Method not allowed.');
      const body = await this.json(req),
        operation = accountOperation(body);
      if (['delete-account', 'suspend'].includes(operation.operation)) {
        const adminIds = String(this.env.BETTER_AUTH_ADMIN_USER_IDS || '')
          .split(',')
          .map((id) => id.trim());
        if (
          Object.values(this.state.identities).some(
            (identity) =>
              identity.userId === accountId &&
              identity.issuer === 'rwas-better-auth' &&
              adminIds.includes(identity.subject),
          )
        )
          fail(
            403,
            'Protected administrator accounts cannot be deleted or suspended here.',
          );
      }
      const proposal = await accountProposal(
        this.state,
        accountId,
        operation,
        identity.actor,
      );
      if (proposal.previous)
        return reply({ ...proposal.previous.result, replayed: true });
      if (action === 'preview') return reply(proposal.public);
      if (body.confirmation !== proposal.public.confirmation)
        fail(409, 'Account changed or confirmation missing. Preview again.');
      return reply(
        applyAccountOperation(
          this.state,
          accountId,
          operation,
          proposal,
          identity.actor,
          this.audit.bind(this),
        ),
      );
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
        profileBlocked: !!profile && accountHeld(profile),
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
    if (path === '/auth/auth0-events' && method === 'POST') {
      const identity = identityConfig(this.env),
        stream = auth0EventConfig(this.env);
      if (!identity || !stream) fail(503, 'Provider stream is not configured.');
      if (
        url.origin !== identity.origin ||
        (req.headers.get('Origin') &&
          req.headers.get('Origin') !== identity.origin)
      )
        fail(403, 'Provider stream destination not allowed.');
      const authorization = req.headers.get('Authorization') || '';
      if (
        !authorization.startsWith('Bearer ') ||
        (await digest(authorization.slice(7))) !== (await digest(stream.secret))
      )
        fail(403, 'Provider stream not authorized.');
      if (
        !['application/json', 'application/cloudevents+json'].includes(
          (req.headers.get('Content-Type') || '')
            .split(';')[0]
            .trim()
            .toLowerCase(),
        )
      )
        fail(415, 'Provider stream requires JSON.');
      const event = await auth0BlockNotification(await this.json(req), stream);
      const fingerprint = await digest(JSON.stringify(event));
      this.purgeAuth0EventReceipts(this.state);
      const receipt = this.state.auth0EventReceipts[event.id];
      if (receipt) {
        if (receipt.fingerprint !== fingerprint)
          fail(409, 'Provider event identity changed.');
        return reply({
          ok: true,
          receiptId: event.id,
          outcome: receipt.outcome,
          replayed: true,
        });
      }
      const outcome = !event.blockedPresent
        ? 'ignored-no-blocked'
        : !event.blocked
          ? 'ignored-unblocked'
          : 'blocked-applied';
      if (event.blocked) await this.applyProviderSecurityEvent(event, identity);
      const receivedAt = Date.now();
      this.state.auth0EventReceipts[event.id] = {
        fingerprint,
        receivedAt,
        expiresAt: receivedAt + DAY,
        type: 'user.updated',
        outcome,
        eventTime: event.issuedAt,
        source: stream.source,
        tenant: stream.tenant,
        stream: stream.stream,
      };
      await this.scheduleAuth0ReceiptExpiry(this.state);
      return reply({ ok: true, receiptId: event.id, outcome, replayed: false });
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
      return this.applyProviderSecurityEvent(body, config);
    }
    if (path === '/send-code' && method === 'POST') {
      if (this.env.EMAIL_CODE_LOGIN_ENABLED !== 'true')
        fail(404, 'Email-code sign-in is unavailable.');
      const b = await this.json(req);
      return this.sendCode(req, b);
    }
    if (path === '/check-code' && method === 'POST') {
      if (this.env.EMAIL_CODE_LOGIN_ENABLED !== 'true')
        fail(404, 'Email-code sign-in is unavailable.');
      const b = await this.json(req),
        address = email(b.email);
      if (clerkQaOnlyEnabled(this.env) && clerkQaEmail(address))
        fail(403, 'QA accounts require the verified Clerk test login.');
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
      if (accountHeld(p))
        fail(403, 'This account is unavailable. Contact RWAS.');
      return this.sessionReply(p);
    }
    if (path === '/browse' && method === 'GET') {
      if (
        !sellerPublicListingsEnabled(this.env) &&
        this.env.CLERK_ACCEPTANCE_ENABLED !== 'true'
      )
        return reply({ listings: [] });
      const sold = url.searchParams.get('include') === 'sold';
      return reply({
        listings: Object.values(this.state.listings)
          .filter(
            (l) =>
              acceptancePublished(l, this.env) ||
              (sellerPublicListingsEnabled(this.env) &&
                (l.status === 'active' || (sold && l.status === 'sold'))),
          )
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
        (acceptancePublished(l, this.env) ||
          (sellerPublicListingsEnabled(this.env) &&
            ['active', 'sold'].includes(l.status))) &&
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
      const published =
        acceptancePublished(l, this.env) ||
        (sellerPublicListingsEnabled(this.env) &&
          ['active', 'sold'].includes(l.status));
      if (!published && (req.headers.get('Accept') || '').includes('text/html'))
        fail(404, 'Listing not found.');
      if (!published) {
        const u = await this.user(req);
        if (l.ownerId !== u.id) fail(404, 'Listing not found.');
      }
      if ((req.headers.get('Accept') || '').includes('text/html')) {
        if (!published) fail(404, 'Listing not found.');
        return publicPage(publicListing(this.hydrate(l)));
      }
      return reply({
        listing: published ? publicListing(this.hydrate(l)) : this.hydrate(l),
      });
    }
    const adminListing = path.match(/^\/admin\/listings\/([^/]+)$/);
    if (adminListing) {
      const actor = await this.admin(req),
        l = this.state.listings[adminListing[1]];
      if (!l) fail(404, 'Listing not found.');
      if (method === 'GET') return reply({ listing: this.hydrate(l) });
      if (!['PUT', 'DELETE', 'POST'].includes(method))
        fail(405, 'Method not allowed.');
      const body = await this.json(req);
      if (body.revision !== l.revision || l.purging)
        fail(409, 'Listing changed. Reload before making changes.');
      if (method === 'PUT') {
        if (['deleted', 'archived'].includes(l.status))
          fail(409, 'Restore the listing before editing.');
        if (
          body.submitForReview === true &&
          this.media(l).some((file) => file.deleting)
        )
          fail(409, 'Finish pending file deletion before review.');
        l.fields = clean(body.fields, body.submitForReview === true);
        l.status = body.submitForReview === true ? 'pending' : 'draft';
      } else if (method === 'DELETE') {
        if (body.confirm !== l.id) fail(400, 'Confirm the listing ID.');
        l.deleteFrom = l.status;
        l.status = 'deleted';
        l.deletedAt = Date.now();
      } else {
        if (body.action !== 'restore' || l.status !== 'deleted')
          fail(409, 'This listing cannot be restored.');
        l.status = 'draft';
        delete l.deletedAt;
      }
      l.revision++;
      l.updatedAt = Date.now();
      l.approvedRevision = null;
      delete l.acceptanceApprovedRevision;
      delete l.acceptancePublicUntil;
      for (const [key, value] of Object.entries(this.state.outbox))
        if (value.listingId === l.id) delete this.state.outbox[key];
      this.audit('admin-listing-' + method.toLowerCase(), actor, {
        listingId: l.id,
        revision: l.revision,
        status: l.status,
      });
      return reply({ ok: true, listing: this.hydrate(l) });
    }
    if (path.startsWith('/admin/support')) {
      const identity = await this.accountAdministrator(req, method !== 'GET');
      assertAccountOrigin(req, this.env, method !== 'GET');
      this.state.supportTickets ||= {};
      if (path === '/admin/support' && method === 'GET')
        return reply({
          tickets: Object.values(this.state.supportTickets).sort(
            (a, b) => b.updatedAt - a.updatedAt,
          ),
        });
      const match = path.match(/^\/admin\/support\/([a-zA-Z0-9_-]+)$/);
      if (!match || method !== 'PATCH') fail(405, 'Method not allowed.');
      const ticket = this.state.supportTickets[match[1]],
        body = await this.json(req);
      if (!ticket) fail(404, 'Support request not found.');
      if (body.revision !== ticket.revision)
        fail(409, 'Support request changed. Reload it.');
      if (
        !['open', 'in-progress', 'resolved'].includes(body.status) ||
        typeof body.reply !== 'string' ||
        !body.reply.trim() ||
        body.reply.length > 5000
      )
        fail(400, 'Enter a support reply and valid status.');
      ticket.messages.push({
        from: 'support',
        text: body.reply.trim(),
        at: Date.now(),
      });
      ticket.status = body.status;
      ticket.updatedAt = Date.now();
      ticket.revision++;
      this.audit('support-reply', identity.actor, {
        ticketId: ticket.id,
        status: ticket.status,
      });
      return reply({ ok: true, ticket });
    }
    if (path === '/admin/listings' && method === 'GET') {
      await this.admin(req);
      return reply({
        listings: Object.values(this.state.listings).map((l) => ({
          ...this.hydrate(l),
          reviewActions: staffReviewActions(l, this.env),
        })),
      });
    }
    if (path === '/admin/review' && method === 'POST') {
      const actor = await this.admin(req),
        b = await this.json(req),
        l = this.state.listings[b.listingId];
      if (!l) fail(404, 'Listing not found.');
      if (b.revision !== l.revision)
        fail(409, 'Listing changed. Review the latest revision.');
      if (b.decision === 'acceptance-unpublish') {
        if (!acceptanceMarker(l))
          fail(409, 'Listing has no acceptance publication marker.');
        delete l.acceptancePublicUntil;
        delete l.acceptanceApprovedRevision;
        l.updatedAt = Date.now();
        this.audit('acceptance-publication-rollback', actor, {
          listingId: l.id,
          revision: l.revision,
        });
        return reply({ ok: true, listing: this.hydrate(l) });
      }
      if (l.purging) fail(409, 'Permanent deletion is in progress.');
      if (b.decision === 'unpublish') {
        if (!['active', 'paused', 'sold'].includes(l.status))
          fail(409, 'Listing is not published or approved.');
        l.status = 'draft';
        l.revision++;
        l.approvedRevision = null;
        delete l.acceptancePublicUntil;
        delete l.acceptanceApprovedRevision;
        l.updatedAt = Date.now();
        this.audit('unpublish', actor, {
          listingId: l.id,
          revision: l.revision,
        });
        return reply({ ok: true, listing: this.hydrate(l) });
      }
      if (l.status !== 'pending') fail(409, 'Listing is not awaiting review.');
      if (!['approve', 'reject', 'acceptance-approve'].includes(b.decision))
        fail(400, 'Invalid review decision.');
      if (b.decision === 'approve' && !sellerPublicListingsEnabled(this.env))
        fail(409, 'Public listing activation is disabled.');
      if (b.decision === 'acceptance-approve') {
        const scope = acceptanceScope(l, this.env);
        if (!scope)
          fail(409, 'Listing is not eligible for bounded QA publication.');
        clean(l.fields, true);
        l.acceptanceApprovedRevision = l.revision;
        l.acceptancePublicUntil = scope.expiresAt;
      } else if (b.decision === 'approve') {
        clean(l.fields, true);
        l.approvedRevision = l.revision;
        l.status = 'active';
        delete this.state.outbox[l.id + ':' + l.revision];
      } else {
        l.status = 'rejected';
        l.reviewNote = String(b.note || 'Please update your listing.').slice(
          0,
          1000,
        );
        delete this.state.outbox[l.id + ':' + l.revision];
      }
      l.updatedAt = Date.now();
      this.audit('review', actor, {
        listingId: l.id,
        decision: b.decision,
        revision: l.revision,
      });
      return reply({ ok: true, listing: this.hydrate(l) });
    }
    const u = await this.user(req);
    if (path === '/account/access' && method === 'GET')
      return reply({ role: u.accountRole });
    if (path === '/support') {
      if (u.accountRole !== 'seller')
        fail(403, 'Use the administrator support workspace.');
      this.state.supportTickets ||= {};
      if (method === 'GET')
        return reply({
          tickets: Object.values(this.state.supportTickets)
            .filter((t) => t.ownerId === u.id)
            .sort((a, b) => b.updatedAt - a.updatedAt),
        });
      if (method !== 'POST') fail(405, 'Method not allowed.');
      const body = await this.json(req);
      if (
        typeof body.subject !== 'string' ||
        !body.subject.trim() ||
        body.subject.length > 200 ||
        typeof body.message !== 'string' ||
        !body.message.trim() ||
        body.message.length > 5000
      )
        fail(400, 'Enter a subject and message.');
      this.rate('support:' + u.id, 10);
      const ticket = {
        id: crypto.randomUUID(),
        ownerId: u.id,
        email: u.email,
        subject: body.subject.trim(),
        status: 'open',
        revision: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [
          { from: 'customer', text: body.message.trim(), at: Date.now() },
        ],
      };
      this.state.supportTickets[ticket.id] = ticket;
      this.audit('support-created', u.id, { ticketId: ticket.id });
      return reply({ ok: true, ticket }, 201);
    }
    if (
      u.accountRole !== 'seller' &&
      !['/logout', '/account', '/account/sessions'].includes(path)
    )
      fail(403, 'Administrative accounts cannot use seller tools.');
    if (u.accountRole !== 'seller' && path === '/account' && method !== 'GET')
      fail(
        403,
        'Administrative accounts are managed through the staff workspace.',
      );
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
      const legacySteps = [
        ['nNumber', 'What is your aircraft N-number?'],
        ['make', 'Aircraft make?'],
        ['model', 'Aircraft model?'],
        ['year', 'Aircraft year?'],
        ['price', 'Asking price in USD?'],
        ['description', 'Describe the condition and history, or say skip.'],
        ['avionics', 'Avionics and equipment, or say skip.'],
      ];
      const intakeFields = (fields) =>
        newListingFields(fields, [
          { name: 'make', label: 'Make', required: true },
          { name: 'model', label: 'Model', required: true },
          { name: 'year', label: 'Year', required: true, type: 'number' },
          { name: 'sellerLocation', label: 'Location', required: true },
          {
            name: 'description',
            label: 'Description',
            required: true,
            multiline: true,
            maxLength: 10000,
          },
        ]);
      const intakePrompt = (field) =>
        field.label +
        (field.required ? ' (required)' : ' (optional; say skip)') +
        (field.options
          ? '\n' +
            field.options
              .map(
                (option, index) =>
                  index +
                  1 +
                  '. ' +
                  (typeof option === 'string' ? option : option.label),
              )
              .join('\n')
          : '') +
        (field.help ? '\n' + field.help : '');
      if (/^(cancel|stop|never mind)$/i.test(text))
        return reply({
          reply: 'Your progress is saved privately. You can continue later.',
          state: { cancelled: true },
        });
      let progress = this.state.drafts[u.id];
      if (!progress?.intake) {
        progress = {
          intake: true,
          schemaVersion: 3,
          step: 0,
          fields: { sellerName: u.name, workflowVersion: '3' },
        };
        this.state.drafts[u.id] = progress;
        return reply({
          reply: intakePrompt(intakeFields(progress.fields)[0]),
          state: { step: 0 },
        });
      }
      const guidedFields =
        progress.schemaVersion === 3 ? intakeFields(progress.fields) : null;
      const steps = guidedFields
        ? guidedFields.map((field) => [field.name, intakePrompt(field)])
        : legacySteps;
      if (/\b(list|sell) my|want to (list|create a listing)/i.test(text))
        return reply({
          reply:
            'Continuing your saved draft. ' +
            steps[Math.min(progress.step, steps.length - 1)][1],
          state: { step: progress.step },
        });
      const [field] = steps[progress.step] || steps[0];
      if (
        text.toLowerCase() === 'skip' &&
        (guidedFields
          ? guidedFields[progress.step]?.required
          : progress.step < 5)
      )
        fail(400, 'This field is required before submitting a listing.');
      if (text.toLowerCase() !== 'skip') {
        const definition = guidedFields?.[progress.step];
        let answer = text;
        if (definition?.options) {
          const choice = definition.options.find(
            (option, index) =>
              String(index + 1) === text ||
              String(
                typeof option === 'string' ? option : option.value,
              ).toLowerCase() === text.toLowerCase() ||
              (typeof option === 'object' &&
                option.label.toLowerCase() === text.toLowerCase()),
          );
          if (!choice) fail(400, 'Choose one of the listed options.');
          answer = typeof choice === 'string' ? choice : choice.value;
        }
        const update = field.startsWith('spec:')
          ? {
              specifications: {
                ...progress.fields.specifications,
                [field.slice(5)]: answer,
              },
            }
          : { [field]: answer };
        if (guidedFields)
          progress.fields = clean({ ...progress.fields, ...update });
        else Object.assign(progress.fields, clean(update));
      }
      progress.step++;
      progress.updatedAt = Date.now();
      const nextSteps = guidedFields
        ? intakeFields(progress.fields).map((field) => [
            field.name,
            intakePrompt(field),
          ])
        : steps;
      if (progress.step < nextSteps.length)
        return reply({
          reply: nextSteps[progress.step][1],
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
        sessions: this.accountSessionRows(u.id, u.sessionKey),
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
      if (
        betterAuthQaEnabled(this.env) &&
        u.betterAuthQaCohort === BETTER_AUTH_QA_COHORT
      )
        assertBetterAuthQaEmail(this.env, address);
      await this.verify(address, b.code, 'email-change', u);
      if (
        Object.values(this.state.profiles).some(
          (p) => p.email === address && p.id !== u.id,
        )
      )
        fail(409, 'This address cannot be used.');
      this.state.profiles[u.id].email = address;
      const current = this.state.sessions[u.sessionKey];
      const otherSession = (key, session) =>
        key !== u.sessionKey && !sameBetterAuthSession(session, current);
      await this.revokeBetterAuthBusinessSessions(u.id, otherSession);
      for (const [k, s] of Object.entries(this.state.sessions))
        if (s.userId === u.id && otherSession(k, s))
          delete this.state.sessions[k];
      this.audit('email-change', u.id);
      return reply({ ok: true, email: address });
    }
    if (path === '/logout' && method === 'POST') {
      // Service bindings can represent a bodyless POST as an empty stream.
      await this.json(req, true);
      const external = this.state.sessions[u.sessionKey].method === 'identity';
      await this.revokeBetterAuthBusinessSessions(
        u.id,
        (key) => key === u.sessionKey,
      );
      delete this.state.sessions[u.sessionKey];
      const config = identityConfig(this.env);
      return reply({
        ok: true,
        ...(external && config ? { logoutUrl: logoutUrl(config) } : {}),
      });
    }
    if (path === '/account/sessions' && method === 'DELETE') {
      const b = await this.json(req);
      const current = this.state.sessions[u.sessionKey];
      const target = this.state.sessions[b.id];
      const selected = (key, session) =>
        b.id === key ||
        (target?.userId === u.id && sameBetterAuthSession(session, target)) ||
        (b.all === true &&
          key !== u.sessionKey &&
          !sameBetterAuthSession(session, current));
      await this.revokeBetterAuthBusinessSessions(u.id, selected);
      for (const [k, s] of Object.entries(this.state.sessions))
        if (s.userId === u.id && selected(k, s)) delete this.state.sessions[k];
      return reply({ ok: true });
    }
    if (path === '/account' && method === 'DELETE') {
      await this.user(req, true);
      const b = await this.json(req);
      if (b.confirm !== u.email)
        fail(400, 'Type your current email to confirm.');
      if (Object.values(this.state.listings).some((l) => l.ownerId === u.id))
        fail(409, 'Permanently delete your listings first.');
      const receipts = this.uploadReceipts(this.state).filter(
        ([, receipt]) => receipt.ownerId === u.id,
      );
      // A pending intent may be the only reference to an uncertain R2 write.
      // Preserve it for normal expiry/orphan cleanup; account deletion never
      // touches media. Completed receipts can retire only with the full owner
      // fence below, not on file/listing purge while this owner can still act.
      if (
        receipts.some(
          ([, receipt]) =>
            receipt.status !== 'complete' ||
            receipt.file?.ownerId !== u.id ||
            !receipt.file?.key ||
            !receipt.file?.listingId ||
            this.state.files[receipt.file.key] ||
            this.state.listings[receipt.file.listingId],
        ) ||
        Object.values(this.state.files).some((file) => file.ownerId === u.id)
      )
        fail(
          409,
          'Finish pending upload cleanup before deleting your account.',
        );
      delete this.state.drafts[u.id];
      // Keep a subject tombstone after the business profile is removed. A
      // surviving provider cookie cannot silently recreate a deleted account.
      for (const [identityKey, identity] of Object.entries(
        this.state.identities,
      ))
        if (identity.userId === u.id && identity.issuer === 'rwas-better-auth')
          this.state.identitySecurity[identityKey] = {
            ...this.state.identitySecurity[identityKey],
            blocked: true,
            deletedAt: Date.now(),
            deletedProfileId: u.id,
          };
      for (const [k, s] of Object.entries(this.state.sessions))
        if (s.userId === u.id) delete this.state.sessions[k];
      for (const [key, identity] of Object.entries(this.state.identities))
        if (identity.userId === u.id) delete this.state.identities[key];
      for (const [key, transaction] of Object.entries(
        this.state.authTransactions,
      ))
        if (transaction.linkUserId === u.id)
          delete this.state.authTransactions[key];
      for (const [id] of receipts) delete this.state.idempotency[id];
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
        const b = clean({ ...l.fields, ...(await this.json(req)) });
        l.fields = b;
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
        // Commit review-queue cleanup with listing removal only after R2 settles.
        for (const [key, review] of Object.entries(this.state.outbox))
          if (review?.listingId === l.id) delete this.state.outbox[key];
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
      else if (next === 'active' && !sellerPublicListingsEnabled(this.env))
        fail(409, 'Public listing activation is disabled.');
      else if (
        next === 'active' &&
        l.status === 'paused' &&
        l.approvedRevision === l.revision
      )
        l.status = 'active';
      else if (next === 'sold' && !sellerPublicListingsEnabled(this.env))
        fail(409, 'Public listing activation is disabled.');
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
      if (l.purging)
        fail(409, 'Permanent deletion is in progress. Retry deletion.');
      const operation = uploadOperation(req);
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
      // Body validation and current ownership precede receipt lookup. A receipt
      // is never an authorization capability, and it is not content deduplication.
      const contentHash = Array.from(
          new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
          (value) => value.toString(16).padStart(2, '0'),
        ).join(''),
        fingerprint = await hash(
          JSON.stringify([l.id, category, name, size, type, contentHash]),
        ),
        // Listing-create keys always contain ':'. This upload namespace has
        // none, including its digest, and cannot overlap that existing family.
        receiptId =
          'upload-v1|' + (await hash(JSON.stringify([u.id, operation.id])));
      // Hashing can cross the operation horizon. Validate at the synchronous
      // receipt lookup boundary, not only before awaited body/hash work.
      uploadOperation(req);
      let receipt = this.state.idempotency[receiptId];
      if (receipt) {
        if (
          receipt.kind !== UPLOAD_RECEIPT_KIND ||
          receipt.ownerId !== u.id ||
          receipt.operationId !== operation.id ||
          receipt.fingerprint !== fingerprint
        )
          fail(
            409,
            'This upload operation was already used for a different file or listing.',
          );
        if (receipt.status === 'complete') {
          const file = this.state.files[receipt.file.key];
          if (
            !file ||
            file.deleting ||
            file.ownerId !== u.id ||
            file.listingId !== l.id ||
            file.category !== category
          )
            fail(
              409,
              'This file was removed. Refresh saved media before selecting a new upload.',
            );
          return reply({ ok: true, file, replayed: true });
        }
        if (receipt.status !== 'pending')
          fail(
            409,
            'This upload operation is unavailable. Refresh saved media.',
          );
      } else {
        // Never make a valid replay wait for unrelated orphan cleanup. A new
        // intent can reclaim at most one bounded cleanup batch; alarms finish
        // any remaining expired intents in short successive batches.
        await this.expireUploadReceipts(this.state);
        uploadOperation(req);
        const receipts = this.uploadReceipts(this.state);
        if (
          receipts.length >= UPLOAD_RECEIPT_LIMIT ||
          receipts.filter(([, value]) => value.ownerId === u.id).length >=
            UPLOAD_OWNER_RECEIPT_LIMIT
        )
          fail(
            429,
            'Too many recent file uploads. Wait before starting another upload.',
          );
        const reserved = receipts.filter(
          ([, value]) =>
            value.status === 'pending' &&
            value.file.listingId === l.id &&
            value.file.category === category,
        ).length;
        if (
          this.media(l).filter((file) => file.category === category).length +
            reserved >=
          40
        )
          fail(400, '40 files per category limit.');
        const key =
          'listings/' +
          l.id +
          '/' +
          category +
          '/' +
          receiptId.slice('upload-v1|'.length) +
          '/' +
          name;
        receipt = this.state.idempotency[receiptId] = {
          kind: UPLOAD_RECEIPT_KIND,
          status: 'pending',
          ownerId: u.id,
          operationId: operation.id,
          fingerprint,
          expiresAt: operation.expiresAt,
          file: {
            key,
            name,
            size,
            type,
            category,
            listingId: l.id,
            ownerId: u.id,
            uploadedAt: Date.now(),
          },
        };
        // Persist the intent before R2 can accept bytes. Re-entry after either
        // process loss or an uncertain R2 response uses this exact object key.
        await this.saveState(this.state);
        this.rollbackState = structuredClone(this.state);
      }
      await this.scheduleAuth0ReceiptExpiry(this.state);
      await this.env.MEDIA.put(receipt.file.key, bytes, {
        httpMetadata: { contentType: type },
      });
      // Commit file metadata, completion receipt and the one listing revision
      // atomically. Keep the live state at the durable pending checkpoint while
      // saving so generic error rollback cannot delete this stable R2 object.
      const committed = structuredClone(this.state),
        current = committed.listings[l.id],
        savedReceipt = committed.idempotency[receiptId],
        existing = Object.values(committed.files).filter(
          (file) => file.listingId === l.id,
        ),
        file = {
          ...receipt.file,
          order:
            category === 'photos'
              ? existing
                  .filter((item) => item.category === 'photos')
                  .reduce(
                    (maximum, item) => Math.max(maximum, item.order),
                    -1,
                  ) + 1
              : existing.length,
        };
      committed.files[file.key] = file;
      savedReceipt.status = 'complete';
      current.revision++;
      current.status = 'draft';
      current.updatedAt = Date.now();
      await this.saveState(committed);
      this.state = committed;
      this.rollbackState = structuredClone(committed);
      return reply({ ok: true, file });
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
