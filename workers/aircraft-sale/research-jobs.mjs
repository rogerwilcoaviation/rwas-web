import { digest } from './identity.mjs';
import { accountHeld } from './account-admin.mjs';
import { REVIEW_POLICY } from './jerry-review.mjs';
const identity = (p) =>
  JSON.stringify({ email: p.email, name: p.name, website: p.website || '' });
export const reviewFingerprint = (kind, profile, listing) =>
  digest(
    JSON.stringify({
      kind,
      profile: identity(profile),
      ...(listing
        ? { revision: listing.revision, fields: listing.fields }
        : {}),
    }),
  );
export const queueResearch = (previous) => ({
  policy: REVIEW_POLICY,
  status: 'queued',
  queuedAt: Date.now(),
  attempts: 0,
  nextAt: Math.max(Date.now() + 1000, previous?.cooldownUntil || 0),
  cooldownUntil: previous?.cooldownUntil || 0,
  authority: 'Advisory only; administrator decision required.',
});
export function planResearch(state, previous) {
  for (const profile of Object.values(state.profiles)) {
    const old = previous.profiles[profile.id];
    if (!old || identity(old) !== identity(profile))
      profile.jerryReview = queueResearch(profile.jerryReview);
  }
  for (const listing of Object.values(state.listings)) {
    const old = previous.listings[listing.id];
    if (
      listing.status === 'pending' &&
      (old?.status !== 'pending' || old?.revision !== listing.revision)
    )
      listing.jerryReview = queueResearch(listing.jerryReview);
    else if (listing.jerryReview && old?.revision !== listing.revision)
      listing.jerryReview = {
        ...listing.jerryReview,
        status: 'stale',
        nextAt: null,
      };
  }
}
function candidates(state) {
  return [
    ...Object.values(state.profiles).map((record) => ({
      kind: 'account',
      record,
      profile: record,
    })),
    ...Object.values(state.listings)
      .filter((record) => record.status === 'pending')
      .map((record) => ({
        kind: 'listing',
        record,
        profile: state.profiles[record.ownerId],
      })),
  ].filter(
    ({ record, profile }) =>
      !accountHeld(profile) &&
      record.jerryReview &&
      ['queued', 'researching'].includes(record.jerryReview.status),
  );
}
export function nextResearchAt(state) {
  if (
    candidates(state).length &&
    state.rates?.['jerry-research-lease']?.expiresAt > Date.now()
  )
    return state.rates['jerry-research-lease'].expiresAt;
  return Math.min(
    ...candidates(state)
      .map(({ record }) =>
        record.jerryReview.status === 'researching'
          ? record.jerryReview.leaseUntil
          : record.jerryReview.nextAt,
      )
      .filter(Number.isFinite),
  );
}
export async function takeResearchJob(state, now = Date.now()) {
  state.rates ||= {};
  if (state.rates['jerry-research-lease']?.expiresAt > now) return null;
  const found = candidates(state).find(
    ({ record }) =>
      (record.jerryReview.status === 'researching'
        ? record.jerryReview.leaseUntil
        : record.jerryReview.nextAt) <= now,
  );
  if (!found) return null;
  const { kind, record, profile } = found;
  const fingerprint = await reviewFingerprint(
    kind,
    profile,
    kind === 'listing' ? record : null,
  );
  const jobId = crypto.randomUUID();
  record.jerryReview = {
    ...record.jerryReview,
    jobId,
    status: 'researching',
    fingerprint,
    attempts: record.jerryReview.attempts + 1,
    leaseUntil: now + 120000,
    cooldownUntil: now + 300000,
  };
  state.rates['jerry-research-lease'] = {
    jobId,
    expiresAt: now + 120000,
    kind,
    id: record.id,
    fingerprint,
  };
  return {
    jobId,
    kind,
    id: record.id,
    fingerprint,
    profile: structuredClone({
      email: profile.email,
      name: profile.name,
      website: profile.website,
    }),
    ...(kind === 'listing'
      ? {
          listing: structuredClone({
            fields: record.fields,
            revision: record.revision,
          }),
        }
      : {}),
  };
}
export async function applyResearch(state, job, result) {
  const lease = state.rates?.['jerry-research-lease'];
  if (
    lease?.jobId === job.jobId &&
    lease?.fingerprint === job.fingerprint &&
    lease?.kind === job.kind &&
    lease?.id === job.id
  )
    delete state.rates['jerry-research-lease'];
  const record =
    job.kind === 'account' ? state.profiles[job.id] : state.listings[job.id];
  const profile =
    job.kind === 'account' ? record : state.profiles[record?.ownerId];
  if (
    !record ||
    accountHeld(profile) ||
    record.jerryReview?.fingerprint !== job.fingerprint ||
    record.jerryReview?.jobId !== job.jobId
  )
    return false;
  if (
    (job.kind === 'listing' && record.status !== 'pending') ||
    job.fingerprint !==
      (await reviewFingerprint(
        job.kind,
        profile,
        job.kind === 'listing' ? record : null,
      ))
  ) {
    record.jerryReview = {
      ...record.jerryReview,
      status: 'stale',
      nextAt: null,
    };
    return false;
  }
  const attempts = record.jerryReview.attempts;
  const cooldownUntil = record.jerryReview.cooldownUntil;
  record.jerryReview = { ...result, attempts, fingerprint: job.fingerprint };
  if (result.aiUnavailable && attempts < 3)
    Object.assign(record.jerryReview, {
      status: 'queued',
      nextAt: Date.now() + 60000,
    });
  return true;
}
