# Seller and administrator account layout

The seller account dialog and `/seller-accounts` use a shared left navigation
index. Choosing an item displays its section in the main body. Both screens use
Arial, including headings, navigation, form controls, and embedded identity
settings. On phones the index becomes a compact grid above the selected section.

Seller sections: contact profile, contact email, sign-in and security, active
sessions, and account deletion. Administrator sections: account directory,
contact and access, seller listings, active sessions, administrator activity,
and identity accounts. Account-specific administrator items become available
after choosing a seller from the directory.

Sections remain mounted while hidden so switching does not discard entered form
values or reset identity operations. The index supports arrow keys, Home, End,
and normal Tab navigation. Administrator previews keep navigation disabled until
the preview is confirmed or cancelled. Existing API authorization, verification,
confirmation, and access-expiry checks continue to apply.

## Local verification

- `npm run build` includes compilation, lint, and type validation.
- `npm run lint` checks the application and shared components.
- `node tests/aircraft-sale/account-navigation-browser.mjs` checks the actual
  Next export: section switching, keyboard navigation, entered-value retention,
  rendered Arial fonts, and desktop/390px/320px layouts. It saves screenshots.
- `node tests/aircraft-sale/account-admin-browser.mjs` exercises the actual built
  admin interface against disposable account storage, including previews,
  account edits, suspension, reinstatement, revocation, receipt replay, expiry,
  sidebar position, Arial, and mobile reflow.
- `node --test --test-concurrency=1 tests/aircraft-sale/better-auth-ui.test.mjs
tests/aircraft-sale/better-auth-admin-browser.test.mjs` checks the existing
  seller and identity administration flows using intercepted service responses.
- `node --test tests/aircraft-sale/local-account-preview-focus.test.mjs` checks
  confirmation/cancellation focus and delayed responses. Set
  `ACCOUNT_FOCUS_EXPORT` to the absolute `out` directory to check the built page.

Browser checks use synthetic local data and block external requests. Set
`TEST_ARTIFACT_DIR` to choose where layout screenshots and reports are saved.
These changes are a local deliverable; production deployment and hosted
acceptance remain separate.
