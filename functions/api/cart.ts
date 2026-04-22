/*
 * Cloudflare Pages Function — /api/cart
 *
 * Verbs:
 *   GET    ?cartId=…                     -> hydrate existing cart
 *   POST   { cartId?, merchandiseId, quantity? } -> create or add line
 *   PATCH  { cartId,  lineId, quantity }         -> update line qty (qty=0 removes)
 *   DELETE { cartId,  lineIds: string[] }        -> remove one or more lines
 *
 * All responses share the same flattened cart shape consumed by
 * components/shopify/CartClient.tsx:
 *   { cart: { id, checkoutUrl, totalQuantity, cost, lines: [...] } | null }
 *
 * `lines` is a flat array (Storefront's edges/node wrapper is unwrapped
 * server-side), and merchandise fields are denormalized to the variant.
 *
 * Env vars (set on the Cloudflare Pages project):
 *   SHOPIFY_STORE_DOMAIN
 *   SHOPIFY_STOREFRONT_ACCESS_TOKEN
 *   SHOPIFY_STOREFRONT_API_VERSION (defaults to 2025-10)
 */

type Env = {
  SHOPIFY_STORE_DOMAIN?: string;
  SHOPIFY_STOREFRONT_ACCESS_TOKEN?: string;
  SHOPIFY_STOREFRONT_API_VERSION?: string;
};

const CART_FIELDS = `
  id
  checkoutUrl
  totalQuantity
  cost {
    subtotalAmount { amount currencyCode }
    totalAmount { amount currencyCode }
  }
  lines(first: 100) {
    edges {
      node {
        id
        quantity
        merchandise {
          ... on ProductVariant {
            id
            title
            price { amount currencyCode }
            product {
              title
              handle
              featuredImage { url altText }
            }
            selectedOptions { name value }
          }
        }
      }
    }
  }
`;

const CART_QUERY = `query Cart($cartId: ID!) { cart(id: $cartId) { ${CART_FIELDS} } }`;

const CART_CREATE = `
  mutation CartCreate($merchandiseId: ID!, $quantity: Int!) {
    cartCreate(input: { lines: [{ merchandiseId: $merchandiseId, quantity: $quantity }] }) {
      cart { ${CART_FIELDS} }
      userErrors { message }
    }
  }
`;

const CART_LINES_ADD = `
  mutation CartLinesAdd($cartId: ID!, $merchandiseId: ID!, $quantity: Int!) {
    cartLinesAdd(cartId: $cartId, lines: [{ merchandiseId: $merchandiseId, quantity: $quantity }]) {
      cart { ${CART_FIELDS} }
      userErrors { message }
    }
  }
`;

const CART_LINES_UPDATE = `
  mutation CartLinesUpdate($cartId: ID!, $lineId: ID!, $quantity: Int!) {
    cartLinesUpdate(cartId: $cartId, lines: [{ id: $lineId, quantity: $quantity }]) {
      cart { ${CART_FIELDS} }
      userErrors { message }
    }
  }
`;

const CART_LINES_REMOVE = `
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart { ${CART_FIELDS} }
      userErrors { message }
    }
  }
`;

async function shopify(env: Env, query: string, variables: Record<string, unknown>) {
  const domain = env.SHOPIFY_STORE_DOMAIN || "m06wpv-na.myshopify.com";
  const token = env.SHOPIFY_STOREFRONT_ACCESS_TOKEN || "";
  const version = env.SHOPIFY_STOREFRONT_API_VERSION || "2025-10";
  if (!token) throw new Error("Storefront token not configured");
  const res = await fetch(`https://${domain}/api/${version}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as {
    data?: Record<string, unknown>;
    errors?: Array<{ message: string }>;
  };
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  return json.data;
}


// ---- Checkout host rewrite (2026-04-22) ----
// See lib/shopify.ts for rationale. Mirrored here because this Pages Function
// calls the Storefront API directly (not through lib/shopify.ts).
function rewriteCheckoutHost(url: string | null | undefined): string {
  if (!url) return '';
  return url.replace('www.rogerwilcoaviation.com', 'm06wpv-na.myshopify.com');
}

function flattenCart(c: any) {
  if (!c) return null;
  return {
    id: c.id,
    checkoutUrl: rewriteCheckoutHost(c.checkoutUrl),
    totalQuantity: c.totalQuantity,
    cost: c.cost,
    lines: Array.isArray(c?.lines?.edges)
      ? c.lines.edges.map((e: any) => e?.node).filter(Boolean)
      : [],
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type Ctx = { request: Request; env: Env };

export const onRequestGet = async ({ request, env }: Ctx) => {
  const url = new URL(request.url);
  const cartId = url.searchParams.get("cartId");
  if (!cartId) return jsonResponse({ error: "cartId required" }, 400);
  try {
    const data = (await shopify(env, CART_QUERY, { cartId })) as
      | { cart: any | null }
      | undefined;
    return jsonResponse({ cart: flattenCart(data?.cart ?? null) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: msg }, 502);
  }
};

export const onRequestPost = async ({ request, env }: Ctx) => {
  try {
    const body = (await request.json()) as {
      cartId?: string | null;
      merchandiseId: string;
      quantity?: number;
    };
    const merchandiseId = body.merchandiseId;
    const quantity = body.quantity ?? 1;
    if (!merchandiseId) {
      return jsonResponse({ error: "merchandiseId is required" }, 400);
    }

    type CartPayload = {
      cartCreate?: { cart?: any; userErrors?: Array<{ message: string }> };
      cartLinesAdd?: { cart?: any; userErrors?: Array<{ message: string }> };
    };
    let cart: any | undefined;
    if (body.cartId) {
      const data = (await shopify(env, CART_LINES_ADD, {
        cartId: body.cartId,
        merchandiseId,
        quantity,
      })) as CartPayload | undefined;
      if (data?.cartLinesAdd?.userErrors?.length) {
        const fresh = (await shopify(env, CART_CREATE, {
          merchandiseId,
          quantity,
        })) as CartPayload | undefined;
        cart = fresh?.cartCreate?.cart;
      } else {
        cart = data?.cartLinesAdd?.cart;
      }
    } else {
      const data = (await shopify(env, CART_CREATE, {
        merchandiseId,
        quantity,
      })) as CartPayload | undefined;
      cart = data?.cartCreate?.cart;
    }

    if (!cart) return jsonResponse({ error: "Cart operation failed" }, 502);
    return jsonResponse({ cart: flattenCart(cart) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cart request failed";
    return jsonResponse({ error: message }, 500);
  }
};

export const onRequestPatch = async ({ request, env }: Ctx) => {
  try {
    const body = (await request.json()) as {
      cartId?: string;
      lineId?: string;
      quantity?: number;
    };
    if (!body.cartId || !body.lineId || typeof body.quantity !== "number") {
      return jsonResponse(
        { error: "cartId, lineId, and quantity are required" },
        400,
      );
    }
    // quantity:0 is interpreted by Storefront as a remove.
    const data = (await shopify(env, CART_LINES_UPDATE, {
      cartId: body.cartId,
      lineId: body.lineId,
      quantity: Math.max(0, Math.floor(body.quantity)),
    })) as
      | { cartLinesUpdate?: { cart?: any; userErrors?: Array<{ message: string }> } }
      | undefined;
    const errs = data?.cartLinesUpdate?.userErrors;
    if (errs && errs.length) {
      return jsonResponse(
        { error: errs.map((e) => e.message).join("; ") },
        422,
      );
    }
    return jsonResponse({ cart: flattenCart(data?.cartLinesUpdate?.cart ?? null) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: msg }, 502);
  }
};

export const onRequestDelete = async ({ request, env }: Ctx) => {
  try {
    const body = (await request.json()) as {
      cartId?: string;
      lineId?: string;
      lineIds?: string[];
    };
    const lineIds = body.lineIds && body.lineIds.length
      ? body.lineIds
      : body.lineId
        ? [body.lineId]
        : [];
    if (!body.cartId || lineIds.length === 0) {
      return jsonResponse({ error: "cartId and lineId(s) are required" }, 400);
    }
    const data = (await shopify(env, CART_LINES_REMOVE, {
      cartId: body.cartId,
      lineIds,
    })) as
      | { cartLinesRemove?: { cart?: any; userErrors?: Array<{ message: string }> } }
      | undefined;
    const errs = data?.cartLinesRemove?.userErrors;
    if (errs && errs.length) {
      return jsonResponse(
        { error: errs.map((e) => e.message).join("; ") },
        422,
      );
    }
    return jsonResponse({ cart: flattenCart(data?.cartLinesRemove?.cart ?? null) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: msg }, 502);
  }
};
