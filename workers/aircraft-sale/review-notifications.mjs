import { digest } from './identity.mjs';
import { accountHeld } from './account-admin.mjs';
import { listingTitle } from '../../lib/marketplace/schema.mjs';

export const NOTIFICATION_URL =
  'https://www.rogerwilcoaviation.com/api/aircraft-sale/review-notifications';
const WINDOW = 23 * 3600000;
const LEASE = 120000;
const clean = (value, max = 200) =>
  String(value || '')
    .replace(/[\r\n\t]/g, ' ')
    .slice(0, max);
const pending = (delivery) =>
  ['queued', 'retry', 'sending', 'claimed'].includes(delivery?.status);
const validRecipient = (address) =>
  address.length <= 254 && /^\S+@[^\s@]+\.[^\s@]+$/.test(address);
const valid = (state, job) =>
  job.notificationVersion === 2 && job.kind === 'seller_decision'
    ? !!state.listings[job.listingId] &&
      state.listings[job.listingId].ownerId === job.sellerId &&
      !['deleted', 'archived'].includes(state.listings[job.listingId].status) &&
      !accountHeld(state.profiles[job.sellerId])
    : job.notificationVersion === 1 &&
      (job.test === true ||
        (state.listings[job.listingId]?.status === 'pending' &&
          state.listings[job.listingId]?.revision === job.revision &&
          !accountHeld(
            state.profiles[state.listings[job.listingId]?.ownerId],
          )));

function makeSellerDecision(env, listing, profile, now) {
  const approved = listing.status === 'active';
  const title = clean(listingTitle(listing.fields));
  const recipient =
    typeof profile?.email === 'string'
      ? profile.email.trim().toLowerCase()
      : '';
  const hasRecipient = validRecipient(recipient);
  const text = [
    approved
      ? 'Your Aviation Exchange listing was approved and published.'
      : 'Your Aviation Exchange listing was not approved and needs changes.',
    'Listing: ' + title,
    'Listing ID: ' + listing.id,
    'Revision: ' + listing.revision,
    ...(approved
      ? [
          'View listing: https://www.rogerwilcoaviation.com/aircraft-for-sale/' +
            listing.id,
        ]
      : [
          'Reason:',
          listing.reviewNote,
          'Open My Listings to update and resubmit your listing: https://www.rogerwilcoaviation.com/aircraft-for-sale',
        ]),
  ].join('\n');
  const notificationId = 'aviation-decision/' + crypto.randomUUID();
  return {
    kind: 'seller_decision',
    decision: approved ? 'approved' : 'rejected',
    sellerId: listing.ownerId,
    recipientEmail: hasRecipient ? recipient : '',
    listingId: listing.id,
    revision: listing.revision,
    createdAt: now,
    notificationVersion: 2,
    notificationId,
    emailBody: JSON.stringify({
      from: env.FROM_EMAIL,
      to: hasRecipient ? [recipient] : [],
      subject:
        'Aviation Exchange listing ' +
        (approved ? 'approved' : 'needs changes') +
        ' — ' +
        title,
      text,
    }),
    notifications: {
      email: hasRecipient
        ? { status: 'queued', attempts: 0, nextAt: now + 1000 }
        : {
            status: 'needs_review',
            attempts: 0,
            code: 'recipient_missing',
            completedAt: now,
          },
    },
  };
}

function makeJob(env, listing, profile, test = false, now = Date.now()) {
  const id = listing.id + ':' + listing.revision;
  const title = clean(listingTitle(listing.fields));
  const subject =
    (test ? 'TEST — ' : '') +
    'Aviation Exchange listing awaiting approval — ' +
    title;
  const text = [
    test
      ? 'TEST NOTIFICATION — no listing was created or submitted.'
      : 'A new Aviation Exchange listing is awaiting administrator approval.',
    'Listing: ' + title,
    'Seller: ' + clean(profile.name || profile.email || 'Not provided'),
    !test && profile.email ? 'Seller email: ' + clean(profile.email, 254) : '',
    'Submitted: ' + new Date(now).toISOString(),
    'Listing ID: ' + listing.id,
    'Revision: ' + listing.revision,
    'Review: https://www.rogerwilcoaviation.com/seller-review?listing=' +
      listing.id,
    'Publication requires an administrator decision.',
  ]
    .filter(Boolean)
    .join('\n');
  return {
    listingId: listing.id,
    revision: listing.revision,
    createdAt: now,
    notificationVersion: 1,
    test,
    notificationId: 'aviation-review/' + id,
    text,
    emailBody: JSON.stringify({
      from: env.FROM_EMAIL,
      to: ['admin@rwas.team'],
      subject,
      text,
    }),
    notifications: Object.fromEntries(
      ['email', 'teams'].map((channel) => [
        channel,
        { status: 'queued', attempts: 0, nextAt: now + 1000 },
      ]),
    ),
  };
}

export function planListingNotifications(
  state,
  previous,
  env,
  now = Date.now(),
) {
  for (const listing of Object.values(state.listings)) {
    const old = previous.listings[listing.id];
    if (
      old?.status === 'pending' &&
      old.revision === listing.revision &&
      ['active', 'rejected'].includes(listing.status)
    ) {
      const job = makeSellerDecision(
        env,
        listing,
        state.profiles[listing.ownerId],
        now,
      );
      state.outbox[job.notificationId] = job;
    }
    if (env.LISTING_NOTIFICATIONS_ENABLED !== 'true') continue;
    if (
      listing.status !== 'pending' ||
      (old?.status === 'pending' && old?.revision === listing.revision)
    )
      continue;
    const profile = state.profiles[listing.ownerId];
    if (accountHeld(profile)) continue;
    const key = listing.id + ':' + listing.revision;
    if (state.outbox[key]?.notificationVersion === 1) continue;
    state.outbox[key] = {
      ...state.outbox[key],
      ...makeJob(env, listing, profile, false, now),
    };
  }
}

export function createNotificationTest(state, env, now = Date.now()) {
  const listing = {
    id: crypto.randomUUID(),
    revision: 1,
    fields: { listingType: 'tools', title: 'Notification delivery check' },
  };
  const job = makeJob(
    env,
    listing,
    { name: 'Administrator delivery test' },
    true,
    now,
  );
  state.outbox[listing.id + ':1'] = job;
  // Test receipts are metadata only after completion, bounded independently of listings.
  const tests = Object.entries(state.outbox)
    .filter(([, item]) => item.test === true)
    .sort((a, b) => b[1].createdAt - a[1].createdAt);
  for (const [key, item] of tests.slice(10))
    if (!Object.values(item.notifications || {}).some(pending))
      delete state.outbox[key];
  return job;
}

export function nextListingNotificationAt(state, env, now = Date.now()) {
  if (env.LISTING_NOTIFICATIONS_ENABLED !== 'true') return Infinity;
  return Math.min(
    ...Object.values(state.outbox)
      .filter((job) => valid(state, job))
      .flatMap((job) =>
        Object.values(job.notifications)
          .filter(pending)
          .map((delivery) =>
            Math.max(
              now,
              ['sending', 'claimed'].includes(delivery.status)
                ? delivery.leaseUntil
                : delivery.nextAt,
            ),
          ),
      ),
  );
}

export async function takeListingNotification(state, env, now = Date.now()) {
  if (env.LISTING_NOTIFICATIONS_ENABLED !== 'true') return null;
  for (const [key, job] of Object.entries(state.outbox)) {
    if (!valid(state, job)) continue;
    for (const channel of ['email', 'teams']) {
      const delivery = job.notifications[channel];
      if (!pending(delivery)) continue;
      const next = ['sending', 'claimed'].includes(delivery.status)
        ? delivery.leaseUntil
        : delivery.nextAt;
      if (next > now) continue;
      if (job.kind === 'seller_decision') {
        const currentEmail = String(state.profiles[job.sellerId]?.email || '')
          .trim()
          .toLowerCase();
        if (currentEmail !== job.recipientEmail) {
          if (!delivery.attempts && validRecipient(currentEmail)) {
            const body = JSON.parse(job.emailBody);
            body.to = [currentEmail];
            job.emailBody = JSON.stringify(body);
            job.recipientEmail = currentEmail;
          } else {
            Object.assign(delivery, {
              status: 'needs_review',
              code: 'recipient_changed',
              completedAt: now,
            });
            continue;
          }
        }
      }
      if (
        delivery.status === 'claimed' ||
        delivery.attempts >= 6 ||
        (delivery.firstAttemptAt && now >= delivery.firstAttemptAt + WINDOW)
      ) {
        delivery.code =
          delivery.status === 'claimed'
            ? 'delivery_uncertain'
            : 'retry_boundary';
        delivery.status = 'needs_review';
        delivery.completedAt = now;
        continue;
      }
      if (
        job.kind === 'seller_decision' &&
        (!delivery.attempts || delivery.code === 'email_not_configured') &&
        typeof env.FROM_EMAIL === 'string' &&
        env.FROM_EMAIL &&
        !/[\r\n]/.test(env.FROM_EMAIL)
      ) {
        const body = JSON.parse(job.emailBody);
        if (!body.from) {
          body.from = env.FROM_EMAIL;
          job.emailBody = JSON.stringify(body);
        }
      }
      const ticket = key + ':' + crypto.randomUUID();
      Object.assign(delivery, {
        status: 'sending',
        attempts: delivery.attempts + 1,
        firstAttemptAt: delivery.firstAttemptAt || now,
        leaseUntil: now + LEASE,
        ticketHash: await digest(ticket),
        code: 'attempt_reserved',
      });
      return {
        key,
        channel,
        ticket,
        attempt: delivery.attempts,
        notificationId: job.notificationId,
        emailBody: job.emailBody,
        leaseUntil: delivery.leaseUntil,
        windowEnds: delivery.firstAttemptAt + WINDOW,
      };
    }
  }
  return null;
}

export async function claimListingNotification(
  state,
  env,
  ticket,
  now = Date.now(),
) {
  if (
    env.LISTING_NOTIFICATIONS_ENABLED !== 'true' ||
    typeof ticket !== 'string' ||
    !/^[a-f0-9-]{36}:\d{1,10}:[a-f0-9-]{36}$/.test(ticket)
  )
    return null;
  const key = ticket.split(':').slice(0, 2).join(':');
  const job = state.outbox[key],
    delivery = job?.notifications?.teams;
  if (
    !job ||
    !valid(state, job) ||
    delivery?.status !== 'sending' ||
    delivery.leaseUntil <= now ||
    delivery.ticketHash !== (await digest(ticket))
  )
    return null;
  delivery.status = 'claimed';
  return {
    notificationId: job.notificationId,
    text: job.text,
    target: 'Shop Talk',
  };
}

export async function dispatchListingNotification(env, job) {
  if (Date.now() >= Math.min(job.leaseUntil, job.windowEnds))
    return { ok: false, code: 'attempt_expired' };
  const request =
    job.channel === 'email'
      ? new Request('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + env.RESEND_API_KEY,
            'Content-Type': 'application/json',
            'Idempotency-Key': job.notificationId + '/email',
          },
          body: job.emailBody,
          redirect: 'manual',
          signal: AbortSignal.timeout(15000),
        })
      : new Request(NOTIFICATION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticket: job.ticket }),
          redirect: 'manual',
          signal: AbortSignal.timeout(20000),
        });
  if (
    job.channel === 'email' &&
    (!env.RESEND_API_KEY || !JSON.parse(job.emailBody).from)
  )
    return { ok: false, code: 'email_not_configured' };
  try {
    const response = await (
      env.LISTING_NOTIFICATION_FETCH?.fetch?.bind(
        env.LISTING_NOTIFICATION_FETCH,
      ) || fetch
    )(request);
    const body = await response.json().catch(() => null);
    if (
      response.ok &&
      (job.channel === 'email'
        ? typeof body?.id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(body.id)
        : body?.delivered === true &&
          body.notificationId === job.notificationId)
    )
      return {
        ok: true,
        code: 'accepted',
        providerId: job.channel === 'email' ? body.id : undefined,
      };
    return { ok: false, code: 'http_' + response.status };
  } catch {
    return { ok: false, code: 'network_unknown' };
  }
}

export async function finishListingNotification(
  state,
  job,
  result,
  now = Date.now(),
) {
  const record = state.outbox[job.key],
    delivery = record?.notifications?.[job.channel];
  if (
    !record ||
    delivery?.attempts !== job.attempt ||
    delivery.ticketHash !== (await digest(job.ticket))
  )
    return null;
  if (result.ok) {
    if (job.channel === 'teams' && delivery.status !== 'claimed') return null;
    Object.assign(delivery, {
      status: 'delivered',
      code: result.code,
      completedAt: now,
      ...(result.providerId ? { providerId: result.providerId } : {}),
    });
    if (record.kind === 'seller_decision') {
      delete record.emailBody;
      delete record.recipientEmail;
    }
  } else {
    const uncertain = job.channel === 'teams' && delivery.status === 'claimed';
    const stop =
      uncertain ||
      delivery.attempts >= 6 ||
      now >= delivery.firstAttemptAt + WINDOW;
    Object.assign(delivery, {
      status: stop ? 'needs_review' : 'retry',
      code: uncertain ? 'delivery_uncertain' : result.code,
      nextAt: now + Math.min(3600000, 60000 * 2 ** (delivery.attempts - 1)),
    });
  }
  delete delivery.ticketHash;
  return {
    ...(record.kind === 'seller_decision'
      ? { kind: record.kind, decision: record.decision }
      : {}),
    listingId: record.listingId,
    revision: record.revision,
    channel: job.channel,
    status: delivery.status,
    code: delivery.code,
    test: record.test,
  };
}

export function notificationStatus(job, env) {
  return [1, 2].includes(job?.notificationVersion)
    ? {
        ...(job.notificationVersion === 2
          ? {
              kind: job.kind,
              decision: job.decision,
              notificationId: job.notificationId,
            }
          : {}),
        listingId: job.listingId,
        revision: job.revision,
        submittedAt: job.createdAt,
        test: job.test,
        channels: Object.fromEntries(
          Object.entries(job.notifications).map(([channel, d]) => [
            channel,
            {
              status:
                env &&
                env.LISTING_NOTIFICATIONS_ENABLED !== 'true' &&
                pending(d)
                  ? 'paused'
                  : d.status,
              attempts: d.attempts,
              code:
                env &&
                env.LISTING_NOTIFICATIONS_ENABLED !== 'true' &&
                pending(d)
                  ? 'notifications_disabled'
                  : d.code || '',
              at: d.completedAt || d.firstAttemptAt || job.createdAt,
            },
          ]),
        ),
      }
    : null;
}
