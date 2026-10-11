# Clerk seller completion: local verification and release limits

The seller console now offers explicit sign-in account settings, guards stale Clerk callbacks during Sign Out, and can explicitly link an established owner with independently proven fresh pre-cutover email-code access. Public discovery combines the original legacy inventory with approved seller listings using source-specific links and media URLs. Ordinary Clerk publication requires a separate opt-in flag; bounded acceptance remains private by default.

Local validation on October 11, 2026 used a credential-free environment and an OS sandbox permitting loopback while denying external connections and protected credential files. The existing seller regression files passed 158 tests, with the live JWKS test deliberately skipped. New publication/marketplace, linking, native media/storage and account-browser suites passed another 44 tests. The account suites use a mocked Clerk API; they demonstrate integration behavior, not live provider login.

A fresh isolated Next 15.5.20 static export passed compilation, lint and type checking. Its build excluded dotenv files, used an independent synthetic legacy inventory, and substituted local fonts. The export was bound to current source hashes before the full-shell browser run. That run passed 22 checkpoints and 148 local service requests, with no external requests or browser errors. It exercised real PNG decoding, H.264 playback/seek, PDF rendering, review, public discovery, editing, archive, trash/restore, purge, contact-account maintenance and logout against in-memory fixtures. A separate Miniflare test exercised persistent SQLite/R2 behavior, private PDF ranges, video ranges, revision fencing and exact-prefix cleanup while preserving unrelated objects. Installed workerd clamps the requested compatibility date, so production-runtime compatibility still needs verification.

Focused additional tests:

```sh
node --test tests/aircraft-sale/clerk-publication.test.mjs tests/aircraft-sale/marketplace.test.mjs tests/aircraft-sale/clerk-existing-account.test.mjs
node --test tests/aircraft-sale/seller-native-media-lifecycle.test.mjs
node --test --test-concurrency=1 tests/aircraft-sale/clerk-production-account-lifecycle.test.mjs tests/aircraft-sale/clerk-production-panel-lifecycle.test.mjs
```

The browser suites require an existing Playwright installation. `full-shell.mjs` additionally requires `TEST_EXPORT_DIR` and its `RWAS-LOCAL-BUILD-MANIFEST.json`; it refuses an unverified old export. Build inventory must use `tests/aircraft-sale/legacy-marketplace-fixture.json`. No dependency, package script, source environment or deployment configuration was changed.

## Remaining acceptance limits

- Actual email/password, Google and Apple login, password recovery and the pinned Clerk UI's secondary account-verification dialogs remain unverified.
- Established sellers without a still-fresh independent email-code owner session do not have a reviewed migration path. Email coincidence does not link accounts. See `CLERK-EXISTING-ACCOUNT-LINKING.md`.
- A terminal failed connection remains latched in this browser tab by the existing release safeguard; the UI does not silently reset that authorization.
- RWAS account deletion and provider-account deletion are separate. Deleting a provider account does not prove aircraft cleanup; RWAS deletion requires recent access, exact confirmation and no owned listings.
- New seller cards are discovered in the browser. Static SEO metadata and the original legacy detail-page export remain tied to the legacy build snapshot.
- The chat draft-transfer fixture does not call the AI service (`chatCalls=0`). The screenshot's literal `<em>` text is covered by existing offline renderer tests; a new live conversation was not tested.
- Genuine Staff authorization, original private-listing conservation and provider/backend configuration must be read back before live QA. Source tests and public links do not supply that proof.

At the final independent readback, production remained on Auth0 rollback Pages source `8ec5927` and Worker version `51bc4dda-fe57-4e28-8a56-22313b19dbb9` at 100%. No fresh live signup or seller data was created, and the consumed live attempt remains at 0/10 business actions and 2/56 evidence checks. Its expired deadline and unapplied extension cannot be replayed. This source change is not live acceptance or deployment authorization.
