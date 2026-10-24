# Public chatbot restoration — October 24, 2026

The established public chatbot and the unfinished account-conversation candidate are different surfaces. Disabling the latter must not remove the former.

## Public information surface

When account chat is unavailable, `jerry-widget.js` mounts `jerry-public-chat.mjs`. It sends only fresh public user/assistant text to the established apex `/api/chat`, with credentials omitted, no seller authority, `state:null` and `listingUi:false`. It requires `publicFaqOnly:true` in a successful response.

The existing backend's public handler is informational only: published FAQ/business guidance, conservative pricing/scheduling/troubleshooting and human contact information. It does not call an operational agent, send a notification, create a callback, or mutate an account/listing. This is not a claim of new generative-model activation. Unknown questions receive a safe public handoff, not an unsafe model fallback.

The frontend never imports old unbound transcripts or account history, never reads seller headers, ignores response actions/state, and keeps only a bounded in-memory public conversation. Account changes cancel pending work and reset the public view. Seller-intent seeds only open the public panel; they are not automatically submitted. Normal manual listing entry continues through the authenticated seller UI.

If the public module cannot load, the unavailable notice/manual fallback remains. If the backend does not confirm informational-only handling, the public UI shows a contact fallback rather than rendering an unqualified answer.

## Account candidate

The native account transport and its flags/storage remain off. Its owner/session/surface/deletion boundaries and future qualification requirements are unchanged. Earlier candidate documentation that described all feature-off website chat as unavailable is superseded only for this separately restored public information surface. There is no fallback from an account inference operation into the public channel.

## Verification

`npm run test:jerry:browser` includes real public-widget tests for fresh-text-only requests, absent credentials, ignored actions, manual seller handoff, backend-mode rejection and account-switch fencing. The existing Clerk and Better Auth identity/race assertions remain; their outage fixtures explicitly make the public module unavailable. The exported marketplace test covers normal manual/sign-in entry and saved-work preservation with the restored public panel. CI adds the public restoration browser test without removing any identity/security command.
