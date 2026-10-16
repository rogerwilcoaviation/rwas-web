# Private seller chat and Clerk authentication

The listing widget previously sent only the RWAS bearer session to private draft and intake routes. A Clerk-authenticated seller must also send a fresh provider session token and the session's CSRF value. Without those headers the Worker correctly rejects the request.

The widget now uses the seller panel's narrow `window.rwasSellerRequestHeaders(path)` bridge for the exact `/api/aircraft-sale/draft` and `/api/aircraft-sale/intake` paths. The paired seller panel change supplies fresh official SDK tokens, checks the current session after that asynchronous operation, and permits Clerk requests only on `https://www.rogerwilcoaviation.com`. The widget independently requires that origin and validates the returned core bearer, CSRF, and provider-token fields. A missing bridge fails closed and asks the seller to sign in. No provider JWT is saved in browser storage, chat history, or evidence output. Legacy email-code sessions retain their existing same-origin bearer contract.

`rwas:session-changed` is authoritative over an older storage envelope. The widget checks the session generation before sending a request and before applying its response. It discards stale results and resets intake state when the seller changes or signs out. A matching 401/403 calls `window.rwasSellerSessionRejected(coreToken)` so the panel clears its own authentication state. The callback and widget check the captured core token; a late response cannot clear a replacement seller's session. A temporary service failure preserves the current session and the conversation. The paired panel bridge must be integrated before enabling this widget change for Clerk; no assumed `window.Clerk` instance or direct provider fallback exists.

Only private intake and draft retrieval use these headers. Generic Jerry chat on the apex `/api/chat` receives no seller authentication headers and cannot hand off a service-generated listing action. Widget file selection continues to ask the seller to add the file in the saved draft; it does not upload files. Draft completion still opens the seller panel for manual review, saving, media, and Submit for Review. The widget never creates or publishes a listing, changes legacy inventory, or sends review approvals. The safe `<em>` renderer remains unchanged.

## Local verification

Run in the isolated, combined widget and seller-panel checkout using the owner's existing Playwright module and outbound-denial harness:

```sh
node --check public/jerry-widget.js
node --check tests/aircraft-sale/clerk-widget-browser.mjs
node tests/aircraft-sale/clerk-widget-browser.mjs
node tests/aircraft-sale/chat-failure.mjs
CHAT_MARKUP_BEFORE_SOURCE=/absolute/path/to/chat-markup-before-a72e67e.js \
CHAT_MARKUP_BEFORE_SOURCE_SHA256=2b58df9c6660d30b9f44522576151eee5c6b7dd27e6e06bbd03b6ed6c324c6e0 \
node tests/aircraft-sale/chat-markup.mjs
node scripts/jerry-message-regression.mjs
```

`CLERK_WIDGET_EVIDENCE_PATH` optionally writes a local result artifact containing case names and scope, never headers or tokens. The new browser test intercepts every browser request and blocks service workers; locally generated RSA signatures and mocked Clerk Backend API/JWKS responses drive the real in-memory Worker Clerk start/finish and authorization code. It checks the eight intake POSTs and one draft GET with a different provider token for each request, private browse, manual draft handoff, missing or invalid headers, origin restrictions, revoked-provider rejection, generic-chat isolation, sign-out and replacement races, and the absence of provider tokens in storage. It substitutes the panel bridge at the UI boundary. The paired panel tests must separately prove the real bridge's official SDK fresh-token calls and invalidation behavior.

These cases establish the local header and UI boundary. They do not establish live Clerk login, OAuth configuration, genuine browser file uploads, upstream AI chat, deployed route behavior, Staff acceptance, or the original 56-evidence/10-action acceptance contract. The existing email-code full-shell fixture is not Clerk provider QA. No live configuration, credentials, accounts, or customer data are needed for these tests.

The five-mode markup browser test keeps its genuine historical before control. In a checkout lacking the Git object, provide the unmodified public widget exported from commit `a72e67eef602f647e3af833065a18697c29899c5`. Its 41,274 bytes and SHA256 above were verified from the existing `repair-rwas-web` repository; its Git blob is `e0d985db4289d54cf4d0faf4522dff332f585092`. The test checks the pinned source hash before loading any browser code and fails with an explicit diagnostic if the source is absent or changed. It neither reconstructs historical code nor skips the raw `<em>` failure assertion. The current renderer's separate 50-case script remains available in `scripts/jerry-message-regression.mjs`.
