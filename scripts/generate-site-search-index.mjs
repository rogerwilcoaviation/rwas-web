import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPublicProductHandle } from '../lib/public-product-route.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function loadLocalEnv() {
  for (const filename of ['.env.local', '.env', '.env.production']) {
    try {
      const source = await fs.readFile(path.join(root, filename), 'utf8');
      for (const line of source.split(/\r?\n/)) {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (!match || process.env[match[1]]) continue;
        let value = match[2].trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        )
          value = value.slice(1, -1);
        process.env[match[1]] = value;
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

const SERVICES = [
  [
    'Aircraft Maintenance',
    '/services/aircraft-maintenance',
    'Inspection, maintenance, troubleshooting, and repair from the RWAS aviation shop.',
  ],
  [
    'Avionics Installation',
    '/services/garmin-installation-northern-plains',
    'Garmin avionics installation and upgrade planning for aircraft in the Northern Plains.',
  ],
  [
    'GFC 500 Autopilot Installation',
    '/services/gfc-500-autopilot-installation',
    'Aircraft-specific Garmin GFC 500 autopilot planning and installation.',
  ],
  [
    'G3X Touch Installation',
    '/services/g3x-touch-installation',
    'G3X Touch panel and avionics installation planning for eligible aircraft.',
  ],
  [
    'GTN Xi Navigator Installation',
    '/services/gtn-xi-navigator-installation',
    'Garmin GTN Xi navigator installation and panel integration.',
  ],
  [
    'ADS-B Installation',
    '/services/ads-b-installation',
    'ADS-B equipment selection, compliance planning, installation, and testing.',
  ],
  [
    'Pre-Buy Facility Recommendations',
    '/services/pre-buy-inspection',
    'Find an independent facility. RWAS does not perform pre-buy inspections.',
  ],
  [
    'NDT Inspection',
    '/services/ndt-inspection',
    'Nondestructive testing and aircraft inspection services.',
  ],
  [
    'Rotax Repair',
    '/services/rotax-repair',
    'Rotax engine maintenance, troubleshooting, and repair.',
  ],
  [
    'Fiber Laser Fabrication',
    '/services/fiber-laser-fabrication',
    'Aircraft panel cutting, laser welding, bracket work, and precision fabrication.',
  ],
  [
    'Papa-Alpha Tools',
    '/services/papa-alpha-tools',
    'RWAS-built rigging tools and support for Piper Papa-Alpha airframes.',
  ],
  [
    'Custom Printing & Finishing',
    '/services/custom-printing-finishing',
    'Custom UV printing and powder coating for reviewed aviation and decorative work.',
  ],
  [
    'UV Printing',
    '/services/custom-printing-finishing/uv-printing',
    'UV printing inquiries for primarily flat aviation and decorative parts.',
  ],
  [
    'Powder Coating',
    '/services/custom-printing-finishing/powder-coating',
    'Powder coating inquiries for reviewed aviation shop and decorative work.',
  ],
];

const PLANNING_TOOLS = [
  [
    'Full Panel Planner',
    '/panel-planner',
    'Lay out a full aircraft instrument panel and prepare a project request.',
    ['panel layout planner', 'instrument panel'],
  ],
  [
    'AXIS System Builder',
    '/axis-system-planner',
    'Build an aircraft-specific avionics system plan for certified or experimental aircraft.',
    ['system planner', 'avionics builder'],
  ],
  [
    'Aircraft Financing Calculator',
    '/financing',
    'Estimate aircraft financing and monthly payments before requesting details.',
    ['loan calculator'],
  ],
];

function cleanText(value, maxLength = 280) {
  const clean = String(value || '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/([*_~])/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength - 1).replace(/\s+\S*$/, '') + '…';
}

function removePriceSentences(value) {
  return cleanText(value, 1200)
    .split(/(?<=[.!?])\s*/)
    .filter((sentence) => sentence && !/\$|\b(?:usd|msrp)\b/i.test(sentence));
}

function publicProductDescription(product) {
  const safeSentences = removePriceSentences(product.description).filter(
    (sentence) =>
      !/\b(price|pricing|checkout|dealer[- ]only|wholesale|discount|map)\b/i.test(
        sentence,
      ),
  );
  return (
    cleanText(safeSentences.join(' '), 240) ||
    'Public RWAS catalog product. Open the product page for current details and availability.'
  );
}

async function fetchProducts() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN || 'm06wpv-na.myshopify.com';
  const token =
    process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
    process.env.SHOPIFY_STOREFRONT_TOKEN;
  const version = process.env.SHOPIFY_STOREFRONT_API_VERSION || '2026-01';
  if (!token) throw new Error('A Shopify Storefront token is required.');
  const query =
    'query SiteSearchProducts($after: String) { products(first: 250, after: $after, sortKey: TITLE) { pageInfo { hasNextPage endCursor } edges { node { title handle description variants(first: 250) { edges { node { sku } } } } } } }';
  const products = [];
  let after = null;
  do {
    const response = await fetch(
      'https://' + domain + '/api/' + version + '/graphql.json',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': token,
        },
        body: JSON.stringify({ query, variables: { after } }),
      },
    );
    if (!response.ok)
      throw new Error('Shopify returned HTTP ' + response.status + '.');
    const payload = await response.json();
    if (payload.errors?.length)
      throw new Error(payload.errors.map((error) => error.message).join('; '));
    const connection = payload.data?.products;
    if (!connection)
      throw new Error('Shopify product response was incomplete.');
    products.push(...connection.edges.map(({ node }) => node));
    after = connection.pageInfo.hasNextPage
      ? connection.pageInfo.endCursor
      : null;
  } while (after);
  return products.filter((product) => isPublicProductHandle(product.handle));
}

await loadLocalEnv();
const [products, blogData] = await Promise.all([
  fetchProducts(),
  fs
    .readFile(path.join(root, 'public', 'blog-articles.json'), 'utf8')
    .then(JSON.parse),
]);

const productRoutes = products.map(
  (product) => '/products/' + encodeURIComponent(product.handle),
);
const duplicateProductRoutes = productRoutes.filter(
  (route, index) => productRoutes.indexOf(route) !== index,
);
if (duplicateProductRoutes.length) {
  throw new Error(
    'Duplicate public product routes: ' +
      [...new Set(duplicateProductRoutes)].join(', '),
  );
}

const entries = [
  ...SERVICES.map(([title, href, description]) => ({
    group: 'Services',
    title,
    href,
    description,
  })),
  ...products.map((product) => ({
    group: 'Products',
    title: cleanText(product.title, 140),
    href: '/products/' + encodeURIComponent(product.handle),
    handle: product.handle,
    description: publicProductDescription(product),
    skus: [
      ...new Set(
        (product.variants?.edges || [])
          .map(({ node }) => cleanText(node.sku, 80))
          .filter(Boolean),
      ),
    ],
  })),
  ...blogData.articles
    .filter((article) => article.status === 'published')
    .map((article) => ({
      group: 'Articles',
      title: cleanText(article.title, 180),
      href: '/blog/' + encodeURIComponent(article.id),
      description: cleanText(
        removePriceSentences(
          article.description || article.subtitle || article.lead,
        ).join(' '),
        240,
      ),
      keywords: [article.category, ...(article.tags || [])]
        .map((value) => cleanText(value, 80))
        .filter(
          (value) =>
            value &&
            !['admin', 'dealer-memo', 'draft', 'internal', 'private'].includes(
              value.toLowerCase(),
            ),
        ),
    })),
  ...PLANNING_TOOLS.map(([title, href, description, keywords]) => ({
    group: 'Planning tools',
    title,
    href,
    description,
    keywords,
  })),
];

const output =
  '/* Generated by scripts/generate-site-search-index.mjs. Public fields only; no prices or credentials. */\n' +
  "import type { SiteSearchEntry } from '@/lib/site-search';\n\n" +
  'export const SITE_SEARCH_INDEX = ' +
  JSON.stringify(entries, null, 2) +
  ' as const satisfies readonly SiteSearchEntry[];\n';
await fs.writeFile(
  path.join(root, 'lib', 'site-search-index.generated.ts'),
  output,
);
await fs.writeFile(
  path.join(root, 'lib', 'site-search-product-routes.generated.json'),
  JSON.stringify(productRoutes.slice().sort(), null, 2) + '\n',
);
console.log(
  JSON.stringify({
    services: SERVICES.length,
    products: products.length,
    articles: entries.filter((entry) => entry.group === 'Articles').length,
    planningTools: PLANNING_TOOLS.length,
    total: entries.length,
  }),
);
