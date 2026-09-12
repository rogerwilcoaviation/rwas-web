// Server-only: configuration is supplied by a Pages secret, never a public asset.
// Keep self-contained: the static Pages build embeds this function in its worker.
export async function applyPrivateCartPricing(
  cart,
  rawPolicy,
  shop,
  cartFields,
  now = Date.now(),
) {
  if (!cart || !rawPolicy) return cart;
  const fail = () => {
    throw new Error(
      'Cart pricing could not be verified. Please retry or contact the shop.',
    );
  };
  let policy;
  try {
    policy = JSON.parse(rawPolicy);
  } catch {
    return fail();
  }
  if (
    policy.version !== 1 ||
    !Array.isArray(policy.entries) ||
    policy.entries.length > 100
  )
    return fail();
  const money = (v) => {
    if (!/^\d+(\.\d{1,2})?$/.test(String(v))) return NaN;
    return Math.round(Number(v) * 100);
  };
  const entries = policy.entries;
  const ids = new Set();
  const codes = new Set();
  for (const e of entries) {
    if (
      !e.variantId ||
      !e.productId ||
      !e.sku ||
      !e.code ||
      ids.has(e.variantId) ||
      e.policy !== 'MAP' ||
      e.otc !== true ||
      !Number.isSafeInteger(money(e.publicPrice)) ||
      !Number.isSafeInteger(money(e.cartPrice)) ||
      money(e.cartPrice) <= 0 ||
      money(e.cartPrice) >= money(e.publicPrice)
    )
      return fail();
    ids.add(e.variantId);
    codes.add(e.code);
  }
  const lines = cart.lines?.edges?.map((e) => e.node).filter(Boolean);
  if (!lines || cart.lines.pageInfo?.hasNextPage) return fail();
  const existing = cart.discountCodes?.map((d) => d.code) || [];
  const customerCodes = existing.filter((c) => !codes.has(c));
  const desired = new Set();
  const active =
    policy.enabled === true &&
    Number.isFinite(Date.parse(policy.expiresAt)) &&
    now < Date.parse(policy.expiresAt);
  for (const l of lines) {
    const e = entries.find((e) => e.variantId === l.merchandise?.id);
    if (!e || !active) continue;
    const v = l.merchandise;
    const tags = (v.product?.tags || []).map((t) => t.toLowerCase());
    if (
      v.sku !== e.sku ||
      v.product?.id !== e.productId ||
      v.product?.handle !== e.handle ||
      v.price?.currencyCode !== 'USD' ||
      money(v.price.amount) !== money(e.publicPrice) ||
      !tags.includes('otc-eligible') ||
      tags.some((t) =>
        ['garmin-dealer-only', 'otc-disabled', 'stock-check-required'].includes(
          t,
        ),
      ) ||
      !Number.isInteger(l.quantity) ||
      l.quantity < 1 ||
      l.quantity > 100
    )
      return fail();
    desired.add(e.code);
  }
  // Shopify permits at most five product/order discount codes. Never silently
  // present a partial match or discard a customer's own code to fit this limit.
  if (desired.size + customerCodes.length > 5) return fail();
  const next = [...customerCodes, ...desired];
  if (!next.length && !existing.length) return cart;
  const data = await shop(
    `mutation PrivateCartCodes($cartId: ID!, $codes: [String!]!) { cartDiscountCodesUpdate(cartId:$cartId, discountCodes:$codes) { cart { ${cartFields} } userErrors { message } } }`,
    { cartId: cart.id, codes: next },
  );
  const result = data?.cartDiscountCodesUpdate;
  if (!result?.cart || result.userErrors?.length || result.cart.id !== cart.id)
    return fail();
  const fresh = result.cart;
  if (fresh.lines?.pageInfo?.hasNextPage) return fail();
  const freshLines =
    fresh.lines?.edges?.map((e) => e.node).filter(Boolean) || [];
  if (freshLines.length !== lines.length) return fail();
  for (const old of lines) {
    const l = freshLines.find((l) => l.id === old.id);
    if (
      !l ||
      l.quantity !== old.quantity ||
      l.merchandise?.id !== old.merchandise?.id
    )
      return fail();
    const e = entries.find((e) => e.variantId === l.merchandise?.id);
    if (!e || !active) continue;
    const paid = money(l.cost?.totalAmount?.amount);
    const floor = money(e.cartPrice) * l.quantity;
    // Native customer-code competition may select a better nonstacking offer
    // elsewhere; this line may remain at retail, but may never go below its
    // approved private value. No client-supplied price is ever accepted.
    if (
      !Number.isSafeInteger(paid) ||
      paid < floor ||
      l.cost?.totalAmount?.currencyCode !== 'USD'
    )
      return fail();
    if (!customerCodes.length && paid !== floor) return fail();
  }
  return fresh;
}
