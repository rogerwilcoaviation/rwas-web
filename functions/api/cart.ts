/*
 * Cloudflare Pages Function — POST /api/cart
 *
 * Create or append to a Shopify Storefront cart. Reads env vars from the
 * Pages project (set via Cloudflare API in `project_rwas_task44_deploy`):
 *   SHOPIFY_STORE_DOMAIN
 *   SHOPIFY_STOREFRONT_ACCESS_TOKEN
 *   SHOPIFY_STOREFRONT_API_VERSION (defaults to 2025-10)
 *
 * Request body: { cartId?: string, merchandiseId: string, quantity?: number }
 * Response:     { cart: { id, checkoutUrl, totalQuantity } }
 */

type Env = {
  SHOPIFY_STORE_DOMAIN?: string;
  SHOPIFY_STOREFRONT_ACCESS_TOKEN?: string;
  SHOPIFY_STOREFRONT_API_VERSION?: string;
};

const CART_CREATE = `
  mutation CartCreate($merchandiseId: ID!, $quantity: Int!) {
    cartCreate(input: { lines: [{ merchandiseId: $merchandiseId, quantity: $quantity }] }) {
      cart { id checkoutUrl totalQuantity }
      userErrors { message }
    }
  }
`;

const CART_LINES_ADD = `
  mutation CartLinesAdd($cartId: ID!, $merchandiseId: ID!, $quantity: Int!) {
    cartLinesAdd(cartId: $cartId, lines: [{ merchandiseId: $merchandiseId, quantity: $quantity }]) {
      cart { id checkoutUrl totalQuantity }
      userErrors { message }
    }
  }
`;

async function shopify(env: Env, query: string, variables: Record<string, unknown>) {
  const domain = env.SHOPIFY_STORE_DOMAIN || 'm06wpv-na.myshopify.com';
  const token = env.SHOPIFY_STOREFRONT_ACCESS_TOKEN || '';
  const version = env.SHOPIFY_STOREFRONT_API_VERSION || '2025-10';
  if (!token) throw new Error('Storefront token not configured');
  const res = await fetch(`https://${domain}/api/${version}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as {
    data?: Record<string, unknown>;
    errors?: Array<{ message: string }>;
  };
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join('; '));
  }
  return json.data;
}

type CtxPost = { request: Request; env: Env };

export const onRequestPost = async (ctx: CtxPost) => {
  const { request, env } = ctx;
  try {
    const body = (await request.json()) as {
      cartId?: string | null;
      merchandiseId: string;
      quantity?: number;
    };
    const merchandiseId = body.merchandiseId;
    const quantity = body.quantity ?? 1;
    if (!merchandiseId) {
      return new Response(JSON.stringify({ error: 'merchandiseId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    type CartShape = { id: string; checkoutUrl?: string; totalQuantity?: number };
    type CartPayload = {
      cartCreate?: { cart?: CartShape; userErrors?: Array<{ message: string }> };
      cartLinesAdd?: { cart?: CartShape; userErrors?: Array<{ message: string }> };
    };
    let cart: CartShape | undefined;
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

    if (!cart) {
      return new Response(JSON.stringify({ error: 'Cart operation failed' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ cart }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cart request failed';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};


/* -----------------------------------------------------------------------
 * GET /api/cart?cartId=<id>
 * Load an existing Storefront cart by id.
 * Returns: { cart: { id, checkoutUrl, totalQuantity, cost, lines } | null }
 *   - cart=null when missing / expired (Shopify returns null for unknown ids).
 *   - 400 if no cartId; 502 on Storefront errors.
 * --------------------------------------------------------------------- */
export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const url = new URL(request.url);
  const cartId = url.searchParams.get("cartId");
  if (!cartId) {
    return Response.json({ error: "cartId required" }, { status: 400 });
  }

  const CART_QUERY = `
    query Cart($cartId: ID!) {
      cart(id: $cartId) {
        id
        checkoutUrl
        totalQuantity
        cost {
          subtotalAmount { amount currencyCode }
          totalAmount { amount currencyCode }
        }
        lines(first: 50) {
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
      }
    }
  `;

  try {
    const data = (await shopify(env, CART_QUERY, { cartId })) as
      | { cart: unknown | null }
      | undefined;
    return Response.json({ cart: data?.cart ?? null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 502 });
  }
};
