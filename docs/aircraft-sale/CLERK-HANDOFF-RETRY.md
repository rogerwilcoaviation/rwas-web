# Explicit retry for temporary Clerk handoff failures

This isolated patch adds an explicit **Retry secure sign-in** action for an
ordinary handoff that failed with a recorded network error, HTTP 429 or HTTP 503.
The seller sees the three-attempt limit and remaining attempts. Provider session
notifications never retry a failed handoff automatically. The limit and failure
metadata survive closing/reopening the panel or reloading after a failure.

Retry is available only for a newly recorded, identified ordinary attempt with
the same current Clerk session and user. The action compares the exact current
failure-latch ID, status and attempt count before clearing that latch. An older
unbound latch, changed identity, superseding rejection, exhausted budget, or
validation rejection remains blocked. Existing-owner linking never receives this
action and is never initiated or repeated by ordinary retry.

Each authorized retry starts a new UI generation and full start/finish/account
sequence. It obtains fresh Clerk JWTs and a new server-issued nonce; it never
reuses a prior finish nonce or installs an unverified bearer. If a finish response
is lost, the next fresh finish resolves the same exact persisted Clerk
issuer/subject mapping. The existing Worker creates a profile only when that
mapping is absent, so a previously committed finish cannot create a second
profile through retry. The fresh `/account` verification must succeed before the
browser accepts the replacement seller envelope. Existing profile fields and
listing ownership are not edited by this patch.

Ordinary browser handoffs now accept an optional abort signal. Closing or
replacing their panel cancels outstanding HTTP and stops subsequent token,
finish and account calls. A cancelled promise cannot clear a succeeding handoff
promise, publish a session callback, or overwrite the succeeding generation's
failure latch. A rejection already recorded before cancellation remains
latched. Cancellation itself does not become a retryable network failure.

The scoped browser fixtures cover outages at finish/account, fresh nonces and
paired headers, three-attempt exhaustion across reload, changed Clerk identity,
replacement latches, terminal validation failures, owner-link outages, stale
retry callbacks and cancellation followed by a successful replacement panel.
Tests are deliberately unexecuted here; root owns the guarded browser run. No
production activation, dependency/configuration changes, provider actions, or
live acceptance credit are included.
