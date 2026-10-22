# Staff publication and unpublish

These controls use the existing Staff authorization and exact current listing
revision. Seller login does not confer Staff authority. Ordinary publication keeps
the existing rollout gate; this change does not enable it or alter live settings.

## Bounded QA publication

`CLERK_ACCEPTANCE_SCOPE` is an optional server-owned JSON object with exactly four
fields: `listingId`, `ownerId`, `revision`, and `expiresAt`. Omission or invalid
data denies QA publication. Do not accept this scope from a request body, URL,
listing fields, browser storage, email address or naming convention.

The IDs must equal the stored listing and owner, and `revision` must be a positive
safe integer equal to the current revision. `expiresAt` is an absolute UTC
millisecond timestamp later than server time and at most ten minutes ahead.
Extra keys, malformed JSON, invalid types and values over 2048 characters fail closed.
The existing acceptance flag must be enabled and ordinary publication disabled.
No scope value is added to a configuration file by this change.

QA approval leaves the listing pending and fixes its publication marker to the
scope's exact revision and expiry. Retrying cannot extend that expiry. Anonymous
browse, detail and public photo/video reads require the matching current scope
and marker. Removing the scope, changing owner/revision or expiry, disabling
acceptance, or reaching expiry removes QA visibility. Records remain private;
Staff rejection notes remain excluded from public listing JSON.

Staff can remove an existing QA marker using the current revision even after
scope removal, expiry, an edit, or acceptance shutdown. Removal leaves the
listing's current status/revision/data intact. It cannot create public visibility.

## Ordinary unpublish

The `unpublish` decision accepts active, paused or sold listings and returns them
to draft. It increments revision, clears ordinary approval and QA markers, and
records a Staff audit entry. Owner, aircraft fields and media remain intact. The
seller must resubmit and obtain a fresh review; direct resume and old review
requests cannot restore publication. Unpublish remains available when ordinary
publication is disabled. Other source states and stale revisions are rejected.

The Staff queue computes per-listing `reviewActions` in its authenticated response;
it never stores these UI actions on a listing. The page exposes only known action
names from an array. Server checks run again on every decision. Published rows and
rows with cleanup markers remain reachable alongside pending review records.

## Verification boundary

API and built-page browser tests use disposable fixture users, storage and explicit
server-side QA scopes. They do not prove Cloudflare Access, real provider login,
live storage/configuration or publication. This is a separate Worker/frontend
candidate; approved Worker18 and live configuration remain unchanged.
