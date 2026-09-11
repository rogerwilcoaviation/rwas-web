#!/usr/bin/env node
// Exact-ID public-price-only rollout. No discounts, orders, inventory or publications.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const policy = JSON.parse(
  fs.readFileSync(
    new URL('../data/garmin-public-price-policy.json', import.meta.url),
  ),
);
const sha = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function expectedProduct(product, entry) {
  if (
    product.id !== entry.productId ||
    product.handle !== entry.handle ||
    product.status !== 'ACTIVE' ||
    product.variants.nodes.length !== 1 ||
    product.variants.nodes[0].id !== entry.variantId ||
    product.variants.nodes[0].sku !== entry.sku
  )
    throw new Error(`Identity mismatch: ${entry.sku}`);
  const remove = new Set([
    'garmin-dealer-only',
    'install-by-rwas',
    'otc-disabled',
    'stock-check-required',
  ]);
  const tags = product.tags.filter(
    (t) =>
      !remove.has(t.toLowerCase()) &&
      !t.toLowerCase().startsWith('garmin-category:'),
  );
  for (const tag of [
    'garmin',
    'otc-eligible',
    'garmin-retail-policy-2026',
    'garmin-category:avionics-certified',
  ])
    if (!tags.includes(tag)) tags.push(tag);
  let descriptionHtml = product.descriptionHtml.replace(
    'This is a dealer-only Garmin avionics item. Contact RWAS to confirm aircraft eligibility, installation requirements, and pricing.',
    'Equipment purchase is available separately from installation. Contact RWAS to confirm aircraft eligibility and installation requirements. Installation and return to service require appropriately authorized personnel and applicable approved data.',
  );
  descriptionHtml = descriptionHtml.replace(
    /(<strong>)Garmin list price:(<\/strong>\s*)\$[\d,.]+/gi,
    (_match, open, close) =>
      `${open}Equipment price:${close}$${Number(entry.publicPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  );
  return {
    ...product,
    productType: 'Avionics — Certified',
    tags: tags.sort(),
    descriptionHtml,
    variants: {
      nodes: [
        {
          ...product.variants.nodes[0],
          price: entry.publicPrice,
          compareAtPrice: null,
        },
      ],
    },
  };
}
export function comparable(p) {
  return { ...p, tags: [...p.tags].sort() };
}
async function main() {
  const apply = process.argv.includes('--apply');
  const rollback = process.argv.includes('--rollback');
  if (apply && rollback) throw new Error('Choose apply or rollback');
  const reportArg = process.argv.find((x) => x.startsWith('--report='));
  if (!reportArg) throw new Error('A private --report=directory is required');
  const dir = path.resolve(reportArg.slice(9));
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const env = Object.fromEntries(
    fs
      .readFileSync(
        process.env.RWAS_SHOPIFY_ENV_PATH ||
          '/Users/rwas/.openclaw/workspace/configs/shopify.env',
        'utf8',
      )
      .split(/\r?\n/)
      .filter((x) => x.trim() && !x.trim().startsWith('#') && x.includes('='))
      .map((x) => {
        const i = x.indexOf('=');
        return [
          x.slice(0, i).trim(),
          x
            .slice(i + 1)
            .trim()
            .replace(/^(['"])(.*)\1$/, '$2'),
        ];
      }),
  );
  async function gql(query, variables = {}) {
    for (let i = 0; i < 5; i++) {
      const r = await fetch(
        `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION || '2026-01'}/graphql.json`,
        {
          method: 'POST',
          signal: AbortSignal.timeout(45000),
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': env.SHOPIFY_ADMIN_TOKEN,
          },
          body: JSON.stringify({ query, variables }),
        },
      );
      if (r.status === 429) {
        await new Promise((done) =>
          setTimeout(
            done,
            Math.max(2000, Number(r.headers.get('Retry-After') || 2) * 1000),
          ),
        );
        continue;
      }
      if (!r.ok) throw new Error(`Admin HTTP ${r.status}`);
      const j = await r.json();
      if (j.errors?.some((e) => e.extensions?.code === 'THROTTLED')) {
        await new Promise((done) => setTimeout(done, 5000));
        continue;
      }
      if (j.errors) throw new Error(JSON.stringify(j.errors));
      for (const result of Object.values(j.data))
        if (result?.userErrors?.length)
          throw new Error(JSON.stringify(result.userErrors));
      await new Promise((done) => setTimeout(done, 500));
      return j.data;
    }
    throw new Error('Admin throttling limit');
  }
  const fields =
    'id handle status productType tags descriptionHtml variants(first:100){nodes{id sku price compareAtPrice inventoryPolicy inventoryQuantity taxable}}';
  async function read(entry) {
    const d = await gql(
      `query($query:String!){products(first:20,query:$query){pageInfo{hasNextPage} nodes{${fields}}}}`,
      { query: `sku:${entry.sku}` },
    );
    const all = d.products.nodes.filter((p) =>
      p.variants.nodes.some((v) => v.sku === entry.sku),
    );
    if (d.products.pageInfo.hasNextPage)
      throw new Error(`Incomplete SKU inventory ${entry.sku}`);
    const selected = all.filter((p) => p.id === entry.productId);
    if (
      selected.length !== 1 ||
      (all.length !== 1 && !entry.canonicalIdentityReviewed)
    )
      throw new Error(`Ambiguous or absent SKU ${entry.sku}`);
    expectedProduct(selected[0], entry);
    return comparable(selected[0]);
  }
  const before = [];
  for (const entry of policy.products)
    before.push({ entry, product: await read(entry) });
  const backup = path.join(dir, 'public-price-before.json');
  if (apply && fs.existsSync(backup))
    throw new Error('Existing before-backup: inspect instead of overwriting');
  if (apply)
    fs.writeFileSync(
      backup,
      JSON.stringify(
        { at: new Date().toISOString(), sha256: sha(before), records: before },
        null,
        2,
      ),
      { mode: 0o600 },
    );
  const original = rollback
    ? JSON.parse(fs.readFileSync(backup)).records
    : null;
  const plan = before.map(({ entry, product }) => ({
    entry,
    before: product,
    after: rollback
      ? original.find((x) => x.entry.sku === entry.sku).product
      : comparable(expectedProduct(product, entry)),
  }));
  if (rollback) {
    for (const p of plan) {
      const old = original.find((x) => x.entry.sku === p.entry.sku).product;
      if (sha(p.before) !== sha(comparable(expectedProduct(old, p.entry))))
        throw new Error(`Concurrent change prevents rollback: ${p.entry.sku}`);
    }
  }
  fs.writeFileSync(
    path.join(dir, rollback ? 'rollback-plan.json' : 'public-price-plan.json'),
    JSON.stringify(plan, null, 2),
    { mode: 0o600 },
  );
  if (apply || rollback)
    for (const p of plan) {
      const current = await read(p.entry);
      if (sha(current) !== sha(p.before))
        throw new Error(`Concurrent change: ${p.entry.sku}`);
      if (sha(current) === sha(p.after)) continue;
      const { id, productType, tags, descriptionHtml } = p.after;
      if (
        sha({
          productType: current.productType,
          tags: current.tags,
          descriptionHtml: current.descriptionHtml,
        }) !== sha({ productType, tags, descriptionHtml })
      )
        await gql(
          'mutation($product:ProductUpdateInput!){productUpdate(product:$product){product{id} userErrors{field message}}}',
          { product: { id, productType, tags, descriptionHtml } },
        );
      const variant = p.after.variants.nodes[0];
      if (
        current.variants.nodes[0].price !== variant.price ||
        current.variants.nodes[0].compareAtPrice !== variant.compareAtPrice
      )
        await gql(
          'mutation($id:ID!,$variants:[ProductVariantsBulkInput!]!){productVariantsBulkUpdate(productId:$id,variants:$variants){productVariants{id sku price compareAtPrice} userErrors{field message}}}',
          {
            id,
            variants: [
              {
                id: variant.id,
                price: variant.price,
                compareAtPrice: variant.compareAtPrice,
              },
            ],
          },
        );
      const observed = await read(p.entry);
      if (sha(observed) !== sha(p.after))
        throw new Error(`Readback mismatch: ${p.entry.sku}`);
      fs.appendFileSync(
        path.join(dir, 'write-receipts.jsonl'),
        JSON.stringify({
          at: new Date().toISOString(),
          sku: p.entry.sku,
          mode: rollback ? 'rollback' : 'apply',
          before: sha(p.before),
          after: sha(observed),
        }) + '\n',
        { mode: 0o600 },
      );
    }
  const after = [];
  if (apply || rollback)
    for (const entry of policy.products)
      after.push({ entry, product: await read(entry) });
  if (after.length)
    fs.writeFileSync(
      path.join(
        dir,
        rollback ? 'public-price-rolled-back.json' : 'public-price-after.json',
      ),
      JSON.stringify(
        { at: new Date().toISOString(), sha256: sha(after), records: after },
        null,
        2,
      ),
      { mode: 0o600 },
    );
  console.log(
    JSON.stringify({
      mode: rollback ? 'rollback' : apply ? 'apply' : 'dry-run',
      products: plan.length,
      changes: plan.filter((p) => sha(p.before) !== sha(p.after)).length,
      cartSaleEnabled: false,
    }),
  );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
