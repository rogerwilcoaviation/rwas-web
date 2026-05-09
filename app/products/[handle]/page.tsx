/* eslint-disable @next/next/no-img-element */
/*
 * Product detail template — Ship 2 refactor (2026-04-21).
 *
 * Chrome matches the approved D2 PDP mockup at /preview/pdp_mockup.html.
 * Each content card (photo box, price card, spec card, trust cells, options)
 * carries the 3D specimen lift (4px 4px 0 ink-900) over the enr_h05 chart.
 *
 * Business rules (driven by Shopify product tags):
 *   otc-eligible       → Add to Cart (Papa-Alpha OR Garmin — brand-agnostic)
 *   otc-disabled +
 *   stock-check-required → "Check availability" CTA + OTC notice
 *   garmin-map-locked  → adds "Garmin List Price — Sold at MAP" line
 *
 * Never render "in stock" or "ships same day" for any Garmin product that
 * is not explicitly tagged `otc-eligible`.
 *
 * CTAs merged 2026-04-21: "Confirm stock first" + "Talk to a pilot" collapsed
 * into a single "Check availability" CTA. Live-pilot contact remains in the
 * trust strip's third cell.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import PdpPriceCard, { type PdpVariant } from '@/components/shopify/PdpPriceCard';
import {
  getProductByHandle,
  getProductHandles,
  isOtcCollection,
  isOtcEligible,
} from '@/lib/shopify';
import { productSeoTitle, truncateMeta } from '@/lib/seo';
import {
  BroadsheetLayout,
  Dateline,
  Masthead,
  BroadsheetNav,
  CredentialsBar,
  BulletinBar,
  BroadsheetFooter,
} from '@/components/shared/broadsheet';


// Strip Garmin "Buy & Save rebate form" paragraph from Shopify descriptionHtml.
// John (2026-04-21): on Garmin PDPs, remove "Click here for Garmin's Buy & Save rebate form."
function sanitizeProductHtml(html: string): string {
  if (!html) return '';
  let out = html;
  // Remove <p>-wrapped rebate link
  out = out.replace(/<p>\s*<a[^>]*BuyAndSaveRebateForm[^>]*>[\s\S]*?<\/a>\s*<\/p>/gi, '');
  // Remove bare rebate anchor
  out = out.replace(/<a[^>]*BuyAndSaveRebateForm[^>]*>[\s\S]*?<\/a>/gi, '');
  return out;
}

const PRIORITY_PRODUCT_HANDLES = [
  'd2-mach-2-47-mm-titanium-oxford-brown-leather-band',
  'd2-mach-2-51-mm-carbon-gray-dlc-titanium-vented-titanium-bracelet',
  'd2-mach-2-pro-51-mm-carbon-gray-dlc-titanium-chestnut-leather-band',
];

const FALLBACK_PRODUCT_HANDLES = [
  ...PRIORITY_PRODUCT_HANDLES,
  'garmin-g5-dg-hsi-stcd-for-certified-aircraft-with-lpm',
  'garmin-g5-primary-electronic-attitude-display-stcd-for-certified-aircraft-with-lpm',
  'garmin-gea-71b-enhanced',
  'garmin-gfc-500-digital-autopilot',
];

export async function generateStaticParams() {
  try {
    const handles = await getProductHandles(120);
    return Array.from(new Set([...PRIORITY_PRODUCT_HANDLES, ...handles])).map((handle) => ({ handle }));
  } catch {
    return FALLBACK_PRODUCT_HANDLES.map((handle) => ({ handle }));
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle: rawHandle } = await params;
  const handle = decodeURIComponent(rawHandle);
  try {
    const product = await getProductByHandle(handle);
    if (!product) return { title: 'Product not found' };
    const description = truncateMeta(
      product.description || `View ${product.title} from Roger Wilco Aviation Services.`,
    );
    const url = `https://www.rogerwilcoaviation.com/products/${encodeURIComponent(product.handle)}`;
    const imageUrl = product.featuredImage?.url || product.images[0]?.url;
    const title = productSeoTitle(product.title);
    return {
      title: { absolute: title },
      description,
      alternates: { canonical: url },
      openGraph: {
        type: 'website',
        url,
        title,
        description,
        images: imageUrl ? [{ url: imageUrl, alt: product.featuredImage?.altText || product.title }] : undefined,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: imageUrl ? [imageUrl] : undefined,
      },
    };
  } catch {
    return { title: 'Product not found' };
  }
}

function formatPrice(amount: string, currencyCode: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function isPlaceholderOption(option: { name: string; values: string[] }) {
  const name = option.name.trim().toLowerCase();
  const values = option.values.map((value) => value.trim().toLowerCase());
  return name === 'title' && values.length === 1 && values[0] === 'default title';
}

/* ──────────────────────────────────────────────────────────────────────────
 * Tag-based gating — brand-agnostic. A Garmin product tagged `otc-eligible`
 * takes the add-to-cart path just like a Papa-Alpha tool.
 * ────────────────────────────────────────────────────────────────────────── */
type Gating = {
  otc: 'eligible' | 'disabled' | 'unknown';
  stockCheckRequired: boolean;
  mapLocked: boolean;
  isGarmin: boolean;
};

function gateFromProduct(
  tags: string[],
  vendor: string | undefined,
  collections: string[],
): Gating {
  const lower = tags.map((t) => t.toLowerCase());
  const isGarmin =
    (vendor || '').toLowerCase().includes('garmin') ||
    lower.some((t) => t.startsWith('garmin'));
  // Route through isOtcEligible so the global OTC kill switch (in lib/shopify.ts)
  // applies to PDPs too. When OTC is re-enabled, this delegates back to the
  // tag-based logic without further changes here.
  const perProductOtcEligible = isOtcEligible({ tags: lower });
  const perProductOtcDisabled = lower.includes('otc-disabled');
  const mapLocked = lower.includes('garmin-map-locked');

  // Collection-level OTC override (e.g., Garmin Watches — MAP-locked,
  // direct-ship from Garmin) WINS over per-product `otc-disabled` /
  // `stock-check-required` tags, mirroring the rule used by ProductCard on
  // collection grids (see project_rwas_otc_add_to_cart memory).
  const collectionOtc = collections.some((handle) => isOtcCollection(handle));

  const otcEligible = collectionOtc || perProductOtcEligible;
  // Only a collection-level OTC override (e.g. garmin-watches) clears the
  // stock-check-required rule. A per-product `otc-eligible` tag on its own
  // (e.g., Garmin G5 kits that also carry `stock-check-required`) keeps the
  // Check-stock pill and the 'RWAS does not hold Garmin stock' notice.
  const stockCheckRequired = collectionOtc
    ? false
    : lower.includes('stock-check-required') || (isGarmin && !perProductOtcEligible);
  const otc: Gating['otc'] = otcEligible
    ? 'eligible'
    : perProductOtcDisabled
      ? 'disabled'
      : 'unknown';
  return { otc, stockCheckRequired, mapLocked, isGarmin };
}

const D2_WATCH_BRIEFINGS: Record<string, {
  caseSize: string;
  finish: string;
  band: string;
  display: string;
  battery: string;
  saleNote: string;
  highlights: Array<{ label: string; copy: string }>;
}> = {
  'd2-mach-2-47-mm-titanium-oxford-brown-leather-band': {
    caseSize: '47 mm',
    finish: 'Titanium case',
    band: 'Oxford Brown leather band',
    display: 'AMOLED display with sapphire lens',
    battery: 'Up to 24 days in smartwatch mode',
    saleNote: 'Garmin D2 Mach 2 promotion valid through June 29, 2026, while available through authorized Garmin aviation dealers.',
    highlights: [
      { label: 'Flight-ready tools', copy: 'Moving-map style aviation tools, nearest-airport/direct-to functions, HSI course guidance, timers and UTC/time-zone references.' },
      { label: 'Weather before launch', copy: 'Pilot-focused weather views including METAR/TAF awareness, NEXRAD, winds and temperature overlays when paired with the Garmin ecosystem.' },
      { label: 'Daily performance watch', copy: 'Health monitoring, training readiness, suggested workouts and travel recovery tools in a dress-watch aviation package.' },
    ],
  },
  'd2-mach-2-51-mm-carbon-gray-dlc-titanium-vented-titanium-bracelet': {
    caseSize: '51 mm',
    finish: 'Carbon Gray DLC titanium',
    band: 'Vented titanium bracelet',
    display: '1.4-inch AMOLED display with sapphire lens',
    battery: 'Up to 24 days in smartwatch mode',
    saleNote: 'Garmin D2 Mach 2 promotion valid through June 29, 2026, while available through authorized Garmin aviation dealers.',
    highlights: [
      { label: 'Premium cockpit watch', copy: 'Larger 51 mm case, titanium bracelet, UTC bezel styling and aviation-first widgets for pilots who want a more substantial watch.' },
      { label: 'Advanced flight awareness', copy: 'Airport data, moving-map style navigation, weather awareness and flight logging support through Garmin’s aviation ecosystem.' },
      { label: 'Everyday capability', copy: 'Built-in LED flashlight, red shift mode, fitness metrics and long battery life for travel days as well as flight days.' },
    ],
  },
  'd2-mach-2-pro-51-mm-carbon-gray-dlc-titanium-chestnut-leather-band': {
    caseSize: '51 mm',
    finish: 'Carbon Gray DLC titanium',
    band: 'Chestnut leather band',
    display: '1.4-inch AMOLED display with sapphire lens',
    battery: 'Up to 24 days in smartwatch mode',
    saleNote: 'Garmin D2 Mach 2 promotion valid through June 29, 2026, while available through authorized Garmin aviation dealers.',
    highlights: [
      { label: 'D2 Mach 2 Pro connectivity', copy: 'Adds Garmin inReach technology with LTE and satellite connectivity between flights for messaging, LiveTrack and SOS features.' },
      { label: 'Ultimate aviator toolset', copy: 'Dynamic flight mapping, HSI guidance, nearest-airport navigation, PlaneSync compatibility and Garmin Pilot integration.' },
      { label: 'Important service note', copy: 'inReach/LTE features require an active Garmin subscription and are intended for ground use between flights, subject to coverage and regional availability.' },
    ],
  },
};

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle: rawHandle } = await params;
  const handle = decodeURIComponent(rawHandle);
  let product: Awaited<ReturnType<typeof getProductByHandle>> = null;
  try {
    product = await getProductByHandle(handle);
  } catch {
    product = null;
  }

  if (!product) {
    return (
      <BroadsheetLayout>
        <Dateline />
        <Masthead />
        <BroadsheetNav activeHref="/collections" />
        <CredentialsBar />
        <BulletinBar />
        <main className="bs-stage">
          <section className="bs-hero">
            <div>
              <div className="bs-product-dateline">Pilot Shop <span className="gilded">·</span> Detail</div>
              <h2 className="bs-product-headline">Product temporarily unavailable</h2>
              <p className="bs-product-subhead">
                We could not load this product from Shopify right now. Please try again shortly, or call
                (605) 299-8178.
              </p>
              <div className="bs-cta-row bs-cta-row--single">
                <Link className="bs-cta-primary" href="/collections">Back to collections</Link>
              </div>
            </div>
          </section>
        </main>
        <BroadsheetFooter />
      </BroadsheetLayout>
    );
  }

  const gating = gateFromProduct(product.tags || [], product.vendor, product.collections || []);
  const heroImg = product.images[0];
  const vendor = product.vendor || 'RWAS';
  const firstSku = product.variants[0]?.sku;
  const primaryPrice = product.variants[0]?.price;
  const normalListPrice = product.variants[0]?.compareAtPrice;
  const hasSalePrice = Boolean(normalListPrice && primaryPrice && Number(normalListPrice.amount) > Number(primaryPrice.amount));
  const d2Briefing = D2_WATCH_BRIEFINGS[product.handle];
  const visibleOptions = product.options.filter((opt) => !isPlaceholderOption(opt));

  // Breadcrumb dateline
  const productTypeLabel = product.productType || (gating.isGarmin ? 'Garmin' : 'Shop');
    const cleanDescText = (product.description || '')
    .replace(/^[^\n]*Buy\s*&\s*Save rebate form\.?\s*\n*/i, '')
    .replace(/Click here for Garmin's Buy\s*&\s*Save rebate form\.?\s*/gi, '')
    .trim();
  const breadcrumbs = ['Pilot Shop', productTypeLabel, vendor].filter(Boolean);

  // Variant payload for the client component — keep only what we need.
  const variantPayload: PdpVariant[] = product.variants.map((v) => {
    const selectedOptions = v.selectedOptions.filter(
      (opt) => !(opt.name.trim().toLowerCase() === 'title' && opt.value.trim().toLowerCase() === 'default title'),
    );
    return {
      id: v.id,
      title: v.title.trim().toLowerCase() === 'default title' ? 'Standard configuration' : v.title,
      sku: v.sku,
      price: v.price,
      compareAtPrice: v.compareAtPrice,
      availableForSale: v.availableForSale,
      selectedOptions,
    };
  });
  const canonicalUrl = `https://www.rogerwilcoaviation.com/products/${encodeURIComponent(product.handle)}`;
  const imageUrls = product.images.map((img) => img.url).filter(Boolean);
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${canonicalUrl}#product`,
    name: product.title,
    description: truncateMeta(cleanDescText || product.title, 500),
    sku: firstSku || undefined,
    brand: product.vendor ? { '@type': 'Brand', name: product.vendor } : undefined,
    category: product.productType || undefined,
    image: imageUrls.length ? imageUrls : undefined,
    url: canonicalUrl,
    offers: primaryPrice && !(gating.isGarmin && gating.otc !== 'eligible') ? {
      '@type': 'Offer',
      price: primaryPrice.amount,
      priceCurrency: primaryPrice.currencyCode,
      availability: product.availableForSale
        ? gating.isGarmin
          ? 'https://schema.org/PreOrder'
          : 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: canonicalUrl,
      seller: { '@type': 'Organization', name: 'Roger Wilco Aviation Services' },
    } : undefined,
  };

  return (
    <BroadsheetLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref="/collections" />
      <CredentialsBar />
      <BulletinBar />

      <main className="bs-stage">
        {/* Hero — photo + summary */}
        <section className="bs-hero">
          <figure className="bs-photo-box">
            {heroImg ? (
              <img src={heroImg.url} alt={heroImg.altText || product.title} />
            ) : (
              <div
                style={{
                  aspectRatio: '4/3',
                  background: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--ink-500)',
                }}
              >
                Image coming soon
              </div>
            )}
            <figcaption className="bs-photo-caption">
              <div className="num">01</div>
              <div className="cap">{product.title}</div>
            </figcaption>
          </figure>

          <div>
            <div className="bs-product-dateline">
              {breadcrumbs.map((b, i) => (
                <span key={b + i}>
                  {b}
                  {i < breadcrumbs.length - 1 ? <span className="gilded"> · </span> : null}
                </span>
              ))}
            </div>
            <p className="bs-product-kicker">{d2Briefing ? 'Authorized Garmin aviation dealer offering' : 'From the workbench'}</p>
            <h1 className="bs-product-headline">{product.title}</h1>
            {cleanDescText ? (
              <p className="bs-product-subhead">{cleanDescText}</p>
            ) : null}

            <div className="bs-byline">
              <span>By the RWAS Pilot Shop Desk</span>
              <span className="sep">◆</span>
              <span className="vendor-row">From <strong>{vendor}</strong></span>
              {firstSku ? (
                <>
                  <span className="sep">◆</span>
                  <span>SKU {firstSku}</span>
                </>
              ) : null}
            </div>

            {/* Price card — variant dropdown + single CTA live inside this client component */}
            <PdpPriceCard
              productTitle={product.title}
              variants={variantPayload}
              otc={gating.otc}
              stockCheckRequired={gating.stockCheckRequired}
              isGarmin={gating.isGarmin}
              mapLocked={gating.mapLocked}
            />
          </div>
        </section>

        {/* Detail — article + spec aside */}
        <section className="bs-detail">
          <article>
            {!cleanDescText ? (
              <div
                className="bs-body bs-body--rich"
                dangerouslySetInnerHTML={{ __html: sanitizeProductHtml(product.descriptionHtml || product.description || '') }}
              />
            ) : null}

            {d2Briefing ? (
              <section className="bs-pilot-briefing" aria-label="Pilot briefing">
                <div className="bs-section-kicker">Pilot briefing</div>
                <h2>Built for the flight deck, sold by an aviation shop</h2>
                <p>
                  RWAS presents the D2 Mach 2 line as an aviation product first: exact Garmin SKU,
                  current promotional price, normal Garmin list price after the sale, and practical
                  pilot notes before you buy.
                </p>
                <div className="bs-brief-grid">
                  {d2Briefing.highlights.map((item) => (
                    <div className="bs-brief-card" key={item.label}>
                      <span>{item.label}</span>
                      {item.copy}
                    </div>
                  ))}
                </div>
                <div className="bs-promo-note">
                  <strong>Current Garmin promotion:</strong> {d2Briefing.saleNote}
                </div>
              </section>
            ) : null}

            {/* Trust strip */}
            <div className="bs-trust-strip">
              <div className="cell">
                <span className="lab">Order &amp; fulfillment</span>
                {gating.isGarmin && gating.otc === 'eligible' && !gating.stockCheckRequired ? (
                  <>
                    Garmin watches are sold at the current Garmin promotional sale price when applicable.
                    Garmin delivers to RWAS first; RWAS then delivers to the customer and handles warranty claims.
                  </>
                ) : gating.isGarmin ? (
                  <>
                    Garmin components are ordered directly from Garmin in Kansas, shipped to our facility,
                    then shipped directly to you. Turn-around time can vary.{' '}
                    <strong>The best course of action is to call us to confirm availability.</strong>
                  </>
                ) : gating.otc === 'eligible' ? (
                  <>
                    Based on inventory, Papa-Alpha parts can be shipped same day if ordered before 2pm local.
                  </>
                ) : (
                  <>
                    Call (605) 299-8178 or email avionics@rwas.team to confirm availability and
                    lead time before placing an order.
                  </>
                )}
              </div>
              <div className="cell">
                <span className="lab">Warranty &amp; service</span>
                {gating.isGarmin ? (
                  <>
                    Warranty for Garmin product is shipped back to Garmin for repair or replacement.
                    Warranty for labor of installation is life-time (conditions apply).
                  </>
                ) : (
                  <>Manufacturer warranty. Service and support from our Part 145 repair station, KYKN.</>
                )}
              </div>
              <div className="cell">
                <span className="lab">Talk to a pilot</span>
                Call (605) 299-8178 — staffed by pilots and A&amp;Ps, not a call center.
              </div>
            </div>
          </article>

          {/* Spec aside — built from variant options for now */}
          <aside>
            <div className="bs-spec-card">
              <h3>Specifications</h3>
              <table>
                <tbody>
                  {product.vendor ? (
                    <tr><th>Manufacturer</th><td>{product.vendor}</td></tr>
                  ) : null}
                  {product.productType ? (
                    <tr><th>Type</th><td>{product.productType}</td></tr>
                  ) : null}
                  {firstSku ? (
                    <tr><th>SKU</th><td>{firstSku}</td></tr>
                  ) : null}
                  {d2Briefing ? (
                    <>
                      <tr><th>Case Size</th><td>{d2Briefing.caseSize}</td></tr>
                      <tr><th>Finish</th><td>{d2Briefing.finish}</td></tr>
                      <tr><th>Band</th><td>{d2Briefing.band}</td></tr>
                      <tr><th>Display</th><td>{d2Briefing.display}</td></tr>
                      <tr><th>Battery</th><td>{d2Briefing.battery}</td></tr>
                    </>
                  ) : null}
                  {primaryPrice && !(gating.isGarmin && gating.otc !== 'eligible') ? (
                    <tr>
                      <th>{hasSalePrice ? 'Sale Price' : 'Price'}</th>
                      <td><strong>{formatPrice(primaryPrice.amount, primaryPrice.currencyCode)}</strong></td>
                    </tr>
                  ) : null}
                  {hasSalePrice && normalListPrice ? (
                    <tr>
                      <th>Normal List Price After Sale</th>
                      <td>{formatPrice(normalListPrice.amount, normalListPrice.currencyCode)}</td>
                    </tr>
                  ) : null}
                  {visibleOptions.map((opt) => (
                    <tr key={opt.name}>
                      <th>{opt.name}</th>
                      <td>{opt.values.join(', ')}</td>
                    </tr>
                  ))}
                  <tr><th>Installs at</th><td>KYKN · Yankton, SD</td></tr>
                  <tr><th>Certification</th><td>FAA Part 145 · RWSR491E</td></tr>
                </tbody>
              </table>
            </div>
          </aside>
        </section>
      </main>

      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
