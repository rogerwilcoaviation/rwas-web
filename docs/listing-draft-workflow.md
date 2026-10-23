# Guided manual listing drafts

The signed-in manual editor presents one field or attachment category at a time, followed by a review screen. Back keeps the current entries. Optional items can be skipped. Review links reopen individual items for correction.

Make, model, year and asking price are required before submission, matching the seller service. Year must be from 1903 through next year. Price must be positive and no more than $1 billion. Other current aircraft fields and all attachments are optional. Dedicated component and tool forms remain a separate task.

Save Draft can retain incomplete entries; the final details step also saves the draft before attachments. Existing saved numeric values cannot be cleared to an invalid value. The review action saves the current details before submitting the returned listing revision for private staff review. It never publishes a listing. Closing or replacing an editor prevents an older save response from replacing the newly opened draft.

Photos accept JPG/JPEG, PNG, GIF and WebP. Videos accept MP4 and WebM. Records accept PDF. Every file has the existing service limit of 50 × 1024 × 1024 bytes (52,428,800 bytes). The UI states this at each upload category and rejects an empty, oversized or unsupported-extension file before sending any of its selected batch. The service continues to validate actual file contents and ownership.

Ask Jerry to proofread sends only the description and editing instructions to Jerry's existing public chat endpoint. It sends no seller token, CSRF token, account profile, or chat history. The source is quoted separately from the editing instruction. Structured suggestions are bounded to 10,000 characters, and suggestions that change numerical tokens are rejected. The seller compares both versions, explicitly accepts or keeps the original, and can undo an accepted edit. Editing the source or leaving the editor cancels pending suggestions. Transport failures, chat fallbacks and malformed suggestions leave the original intact. Proofreading does not save or submit anything.

Verification:

- `node tests/aircraft-sale/marketplace-entry-browser.mjs` uses the exported application with intercepted, disposable account, listing, upload and proofreading services at 1440, 390 and 320 pixels. It covers required-field validation, incomplete save/resume, optional skips, media types/limits, proofreading acceptance/rejection/undo/stale responses, review edits, and private submission.
- `node tests/aircraft-sale/browser.mjs` covers the existing seller, media, staff review and account lifecycle with the guided editor.
- `LIVE_PROOFREAD_SMOKE=true MARKETPLACE_ORIGIN=https://www.rogerwilcoaviation.com node tests/aircraft-sale/marketplace-entry-browser.mjs` additionally makes one real Jerry proofreading request using synthetic text from the allowed website origin. All account and listing operations remain intercepted.
