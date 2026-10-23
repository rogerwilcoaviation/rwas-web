# Guided manual listing drafts

“Resume Saved Draft” offers “Resume manually” and “Resume with Jerry.” Both reload the authenticated seller’s saved answers, including category and specifications. The manual path opens an unfinished item; Jerry resumes the stored conversation cursor without treating the resume request as an answer. A manual draft can also be resumed with Jerry without resetting its fields. The chat’s manual link restores the same saved draft. When the seller saves it as a listing, an opaque source-draft revision lets the service consume that intake atomically; a changed source returns a conflict instead of overwriting newer progress. Replays return the same listing.

The signed-in manual editor presents one field or attachment category at a time, followed by a review screen. Back keeps the current entries. Optional items can be skipped. Review links reopen individual items for correction.

Required questions depend on the listing type and category. Aircraft require make, model, year, N-number and location; hangars, parts and tools use their own relevant fields. Optional specifications and attachments are labeled. Year must be from 1903 through next year. An amount-based price must be positive and no more than $1 billion; supported categories also allow price on request.

Save Draft can retain incomplete entries; the final details step also saves the draft before attachments. Existing saved numeric values cannot be cleared to an invalid value. The review action saves the current details before submitting the returned listing revision for private staff review. It never publishes a listing. Closing or replacing an editor prevents an older save response from replacing the newly opened draft.

Photos accept JPG/JPEG, PNG, GIF and WebP. Videos accept MP4 and WebM. Records accept PDF. Every file has the existing service limit of 50 × 1024 × 1024 bytes (52,428,800 bytes). The UI states this at each upload category and rejects an empty, oversized or unsupported-extension file before sending any of its selected batch. The service continues to validate actual file contents and ownership.

Ask Jerry to proofread sends only the description and editing instructions to Jerry's existing public chat endpoint. It sends no seller token, CSRF token, account profile, or chat history. The source is quoted separately from the editing instruction. Structured suggestions are bounded to 10,000 characters, and suggestions that change numerical tokens are rejected. The seller compares both versions, explicitly accepts or keeps the original, and can undo an accepted edit. Editing the source or leaving the editor cancels pending suggestions. Transport failures, chat fallbacks and malformed suggestions leave the original intact. Proofreading does not save or submit anything.

Verification:

- `node tests/aircraft-sale/marketplace-entry-browser.mjs` uses the exported application with intercepted, disposable account, listing, upload and proofreading services at 1440, 390 and 320 pixels. It covers required-field validation, incomplete save/resume, optional skips, media types/limits, proofreading acceptance/rejection/undo/stale responses, review edits, and private submission.
- `node tests/aircraft-sale/browser.mjs` covers the existing seller, media, staff review and account lifecycle with the guided editor.
- `LIVE_PROOFREAD_SMOKE=true MARKETPLACE_ORIGIN=https://www.rogerwilcoaviation.com node tests/aircraft-sale/marketplace-entry-browser.mjs` additionally makes one real Jerry proofreading request using synthetic text from the allowed website origin. All account and listing operations remain intercepted.


## Automatic saving and recovery

The manual workflow writes a recovery copy synchronously as a field or step changes, and debounces authenticated account syncing by 600ms. Recovery is keyed by the immutable RWAS profile ID; no access tokens or passwords are kept in that copy. The save-status panel distinguishes synced, syncing, and failed states and provides a retry. Pending requests are bound to their original session and editor. A device copy is offered separately if it conflicts with a newer online version.

Private autosave snapshots retain incomplete/invalid text, whitespace, category specifications, and the current step; they do not create or publish listings. Explicit Save Draft and submission retain validation. A linked snapshot records the listing ID, base revision and content fingerprint. Resume edits that same listing, preserves uploaded media, rejects changed content, and consumes the matching recovery buffer atomically. Another tab cannot silently overwrite a saved buffer without its revision. Closing a page before a sync finishes can recover its last keystrokes on the same device; other devices receive the last acknowledged online save. Files must finish uploading before leaving.
