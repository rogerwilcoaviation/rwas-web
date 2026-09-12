# Cart pricing operations

Public catalog prices remain governed by `data/garmin-public-price-policy.json`. That document contains no private prices; its former `cartSaleEnabled` flag was not a runtime switch and has been replaced by `containsPrivatePrices`.

The Pages secret `SHOPIFY_CART_PRICING_POLICY` supplies the server-only version-1 policy. Never commit its contents, coupon strings, dealer costs, or actual private targets. Provision native exact-variant product discounts and verify their identities, per-item amounts, expiration, combinations and allocations before enabling the secret. There is no Admin credential in the website and no client-supplied pricing input.

Both `functions/api/cart.ts` and the hand-injected Pages worker call the same self-contained `applyPrivateCartPricing` function. The worker verifies exact variant/SKU/product/handle, current USD public price, positive OTC tag, quantity, expiry and complete cart scope. Shopify performs the price allocation; the website never fabricates a lower line total. Failures return no checkout link. Existing customer codes are retained, subject to native noncombining rules. A competing customer code may leave a target at public price; it cannot reduce it below the approved private target through this route.

Shopify supports at most five product/order codes. More than five required groups, including customer codes, fails closed with a contact-shop message rather than silently pricing only some eligible lines. A shared native per-item amount can cover several exact variants in one group. This implementation does not promise arbitrary-size mixed-cart matching.

Native codes must expire no later than their source-review policy. Missing policy leaves existing ordinary cart behavior intact; disabling/expiring an existing policy removes its known codes when that cart visits this API. For rollback, expire the owned native codes first so direct/returning hosted checkout cannot keep them, then disable configuration or revert the scoped source. Do not delete or recreate existing customer codes, reset use history, or roll back unrelated public catalog, gallery or widget releases.

Before changing a reviewed variant's SKU, identity, price, classification or applicable policy, revoke the affected native rule first, verify hosted checkout, and only then edit/re-review/re-admit. A website validation check is not a universal synchronous barrier against other catalog writers; no such claim is made.

Papa-Alpha customer coupon scope is an exact 57-variant registry at `data/papa-alpha-coupon-variants.json`, independent of vendor names. Run `node scripts/papa-alpha-coupon-scope-audit.mjs <private-complete-catalog-snapshot>` before any related scope/catalog mutation. New variants are not automatically admitted to the nine exact-scoped customer codes. Existing collection-scoped codes retain their own membership behavior and require review before collection changes. Repurposed admitted IDs must be revoked before editing, not silently rebound by SKU similarity.

Verification:
- `node scripts/cart-private-pricing-test.mjs`
- `node scripts/cart-private-runtime-test.mjs`
- `node scripts/cart-native-refresh-test.mjs`
- `node scripts/cart-purchase-exceptions-test.mjs`
- `node scripts/garmin-commercial-review-test.mjs`
- Native cart plus hosted-checkout proof with private policy input; quantity, mixed cart, five-group, excess-group, competing-code, returning-cart, failed native mutation and cleanup cases.

Keep public PDP/JSON-LD/catalog/feed prices unchanged. Cart responses are no-store and noindex; `/cart` remains disallowed in robots. Never connect or expand external feeds as part of this pricing path. A Google account's existing connected state is not a reason to accept additional countries, local inventory, campaigns or optional add-ons.
