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

type StorefrontMoney = {
  amount: string;
  currencyCode: string;
};

type StorefrontCartLine = {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    price: StorefrontMoney;
    product: {
      title: string;
      handle: string;
      featuredImage?: { url: string; altText: string | null } | null;
    };
    selectedOptions: Array<{ name: string; value: string }>;
  };
};

type StorefrontCart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: {
    subtotalAmount: StorefrontMoney;
    totalAmount: StorefrontMoney;
  };
  lines: { edges: Array<{ node: StorefrontCartLine | null }> };
};

type CartOperation = {
  cart?: StorefrontCart | null;
  userErrors?: Array<{ message: string }>;
};

const MAX_LINE_QUANTITY = 100;

function validQuantity(value: unknown, { allowZero = false } = {}) {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= (allowZero ? 0 : 1) &&
    value <= MAX_LINE_QUANTITY
  );
}

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

const MERCHANDISE_PRODUCT_QUERY = `query MerchandiseProduct($id: ID!) {
  node(id: $id) { ... on ProductVariant { product { productType title handle } } }
}`;

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

async function shopify(
  env: Env,
  query: string,
  variables: Record<string, unknown>,
) {
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

async function assertCartEligible(env: Env, merchandiseId: string) {
  const data = (await shopify(env, MERCHANDISE_PRODUCT_QUERY, {
    id: merchandiseId,
  })) as {
    node?: {
      product?: { productType?: string | null; title?: string | null } | null;
    } | null;
  } | undefined;
  const productType = data?.node?.product?.productType;
  if (
    productType === 'Avionics — Certified' ||
    productType === 'Garmin Dealer Install'
  ) {
    throw new Error(
      `Cart unavailable for dealer-install product type "${productType}". Contact us for package pricing.`,
    );
  }
}

function flattenCart(c: StorefrontCart | null | undefined) {
  if (!c) {
    return null;
  }
  return {
    id: c.id,
    checkoutUrl: c.checkoutUrl,
    totalQuantity: c.totalQuantity,
    cost: c.cost,
    lines: Array.isArray(c?.lines?.edges)
      ? c.lines.edges
          .map((edge) => edge.node)
          .filter((line): line is StorefrontCartLine => Boolean(line))
      : [],
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type Ctx = { request: Request; env: Env };

export const onRequestGet = async ({ request, env }: Ctx) => {
  const url = new URL(request.url);
  const cartId = url.searchParams.get('cartId');
  if (!cartId) return jsonResponse({ error: 'cartId required' }, 400);
  try {
    const data = (await shopify(env, CART_QUERY, { cartId })) as
      | { cart: StorefrontCart | null }
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
      return jsonResponse({ error: 'merchandiseId is required' }, 400);
    }
    if (!validQuantity(quantity)) {
      return jsonResponse(
        { error: `quantity must be an integer from 1 to ${MAX_LINE_QUANTITY}` },
        400,
      );
    }
    try {
      await assertCartEligible(env, merchandiseId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/dealer-install product type/i.test(message)) {
        return jsonResponse({ error: message }, 400);
      }
      throw err;
    }

    type CartPayload = {
      cartCreate?: CartOperation;
      cartLinesAdd?: CartOperation;
    };
    let cart: StorefrontCart | null | undefined;
    if (body.cartId) {
      const data = (await shopify(env, CART_LINES_ADD, {
        cartId: body.cartId,
        merchandiseId,
        quantity,
      })) as CartPayload | undefined;
      if (data?.cartLinesAdd?.userErrors?.length) {
        return jsonResponse(
          { error: data.cartLinesAdd.userErrors.map((e) => e.message).join('; ') },
          400,
        );
      } else {
        cart = data?.cartLinesAdd?.cart;
      }
    } else {
      const data = (await shopify(env, CART_CREATE, {
        merchandiseId,
        quantity,
      })) as CartPayload | undefined;
      if (data?.cartCreate?.userErrors?.length) {
        return jsonResponse(
          { error: data.cartCreate.userErrors.map((e) => e.message).join('; ') },
          400,
        );
      }
      cart = data?.cartCreate?.cart;
    }

    if (!cart) return jsonResponse({ error: 'Cart operation failed' }, 502);
    return jsonResponse({ cart: flattenCart(cart) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cart request failed';
    // Shopify reports malformed merchandise IDs and rejected quantities as
    // GraphQL errors rather than userErrors. They are client input errors,
    // not an upstream outage.
    const clientInput = /variant|merchandise|quantity|invalid id|must be a valid/i.test(message);
    return jsonResponse({ error: message }, clientInput ? 400 : 502);
  }
};

export const onRequestPatch = async ({ request, env }: Ctx) => {
  try {
    const body = (await request.json()) as {
      cartId?: string;
      lineId?: string;
      quantity?: number;
    };
    if (
      !body.cartId ||
      !body.lineId ||
      !validQuantity(body.quantity, { allowZero: true })
    ) {
      return jsonResponse(
        {
          error: `cartId, lineId, and quantity are required; quantity must be an integer from 0 to ${MAX_LINE_QUANTITY}`,
        },
        400,
      );
    }
    // quantity:0 is interpreted by Storefront as a remove.
    const data = (await shopify(env, CART_LINES_UPDATE, {
      cartId: body.cartId,
      lineId: body.lineId,
      quantity: body.quantity,
    })) as { cartLinesUpdate?: CartOperation } | undefined;
    const errs = data?.cartLinesUpdate?.userErrors;
    if (errs && errs.length) {
      return jsonResponse(
        { error: errs.map((e) => e.message).join('; ') },
        422,
      );
    }
    return jsonResponse({
      cart: flattenCart(data?.cartLinesUpdate?.cart ?? null),
    });
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
    const lineIds =
      body.lineIds && body.lineIds.length
        ? body.lineIds
        : body.lineId
          ? [body.lineId]
          : [];
    if (!body.cartId || lineIds.length === 0) {
      return jsonResponse({ error: 'cartId and lineId(s) are required' }, 400);
    }
    const data = (await shopify(env, CART_LINES_REMOVE, {
      cartId: body.cartId,
      lineIds,
    })) as { cartLinesRemove?: CartOperation } | undefined;
    const errs = data?.cartLinesRemove?.userErrors;
    if (errs && errs.length) {
      return jsonResponse(
        { error: errs.map((e) => e.message).join('; ') },
        422,
      );
    }
    return jsonResponse({
      cart: flattenCart(data?.cartLinesRemove?.cart ?? null),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: msg }, 502);
  }
};
