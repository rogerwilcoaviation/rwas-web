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
import Link from 'next/link';
import PdpPriceCard, { type PdpVariant } from '@/components/shopify/PdpPriceCard';
import { getProductByHandle, getProductHandles } from '@/lib/shopify';
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

const FALLBACK_PRODUCT_HANDLES = [
  'garmin-g5-dg-hsi-stcd-for-certified-aircraft-with-lpm',
  'garmin-g5-primary-electronic-attitude-display-stcd-for-certified-aircraft-with-lpm',
  'garmin-gea-71b-enhanced',
  'garmin-gfc-500-digital-autopilot',
];

export async function generateStaticParams() {
  try {
    const handles = await getProductHandles(120);
    return handles.map((handle) => ({ handle }));
  } catch {
    return FALLBACK_PRODUCT_HANDLES.map((handle) => ({ handle }));
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  try {
    const product = await getProductByHandle(handle);
    if (!product) return { title: 'Product not found' };
    return {
      title: `${product.title} — Roger Wilco Aviation Services`,
      description:
        product.description || `View ${product.title} from Roger Wilco Aviation Services.`,
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

function gateFromTags(tags: string[], vendor?: string): Gating {
  const lower = tags.map((t) => t.toLowerCase());
  const isGarmin =
    (vendor || '').toLowerCase().includes('garmin') ||
    lower.some((t) => t.startsWith('garmin'));
  const otcEligible = lower.includes('otc-eligible');
  const otcDisabled = lower.includes('otc-disabled');
  const stockCheckRequired =
    lower.includes('stock-check-required') || (isGarmin && !otcEligible);
  const mapLocked = lower.includes('garmin-map-locked');
  const otc: Gating['otc'] = otcEligible ? 'eligible' : otcDisabled ? 'disabled' : 'unknown';
  return { otc, stockCheckRequired, mapLocked, isGarmin };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
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

  const gating = gateFromTags(product.tags || [], product.vendor);
  const heroImg = product.images[0];
  const vendor = product.vendor || 'RWAS';
  const firstSku = product.variants[0]?.sku;
  const primaryPrice = product.variants[0]?.price;

  // Breadcrumb dateline
  const productTypeLabel = product.productType || (gating.isGarmin ? 'Garmin' : 'Shop');
  const breadcrumbs = ['Pilot Shop', productTypeLabel, vendor].filter(Boolean);

  // Variant payload for the client component — keep only what we need.
  const variantPayload: PdpVariant[] = product.variants.map((v) => ({
    id: v.id,
    title: v.title,
    sku: v.sku,
    price: v.price,
    availableForSale: v.availableForSale,
    selectedOptions: v.selectedOptions,
  }));

  return (
    <BroadsheetLayout>
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
            <p className="bs-product-kicker">From the workbench</p>
            <h1 className="bs-product-headline">{product.title}</h1>
            {product.description ? (
              <p className="bs-product-subhead">
                {product.description.split('\n')[0].slice(0, 220)}
              </p>
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
            <div
              className="bs-body bs-body--rich"
              dangerouslySetInnerHTML={{ __html: sanitizeProductHtml(product.descriptionHtml || product.description || '') }}
            />

            {/* Trust strip */}
            <div className="bs-trust-strip">
              <div className="cell">
                <span className="lab">Order &amp; fulfillment</span>
                {gating.isGarmin ? (
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
                  {primaryPrice ? (
                    <tr>
                      <th>Price</th>
                      <td>{formatPrice(primaryPrice.amount, primaryPrice.currencyCode)}</td>
                    </tr>
                  ) : null}
                  {product.options.map((opt) => (
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
