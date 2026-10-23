import { listingFields } from './listing-fields.mjs';
import {
  listingPayload,
  categoryFields,
} from '../../lib/marketplace/schema.mjs';
const fail = (message, status = 400) => {
  throw Object.assign(Error(message), { status });
};
export function manualDraft(body, owned) {
  if (
    !body ||
    !body.values ||
    Array.isArray(body.values) ||
    typeof body.values !== 'object'
  )
    fail('Invalid draft recovery data.');
  const values = body.values;
  const allowed = new Set([
    ...listingFields,
    '__legacyAircraft',
    ...categoryFields(values).map((field) => field.name),
  ]);
  if (
    Object.keys(values).length > 350 ||
    JSON.stringify(values).length > 100000
  )
    fail('Draft recovery data exceeds the limit.');
  for (const [key, value] of Object.entries(values)) {
    if (!allowed.has(key) || typeof value !== 'string' || value.length > 10000)
      fail('Invalid draft recovery field.');
  }
  if (!Number.isInteger(body.step) || body.step < 0 || body.step > 600)
    fail('Invalid draft step.');
  if (body.listingId != null) {
    const listing = owned(body.listingId);
    if (
      ['deleted', 'archived'].includes(listing.status) ||
      listing.revision !== body.listingRevision
    )
      fail(
        'The listing changed. Reopen its latest version before continuing.',
        409,
      );
  }
  if (
    body.expectedRevision !== null &&
    !/^[a-f0-9]{64}$/.test(body.expectedRevision || '')
  )
    fail('A saved-draft revision is required.');
  return {
    manual: true,
    values: { ...values },
    step: body.step,
    listingId: body.listingId || null,
    listingRevision: body.listingId ? body.listingRevision : null,
    updatedAt: Date.now(),
  };
}
export function manualIntakeFields(draft) {
  return listingPayload(
    Object.fromEntries(
      Object.entries(draft.values).filter(
        ([key, value]) => key !== '__legacyAircraft' && value.trim() !== '',
      ),
    ),
  );
}
