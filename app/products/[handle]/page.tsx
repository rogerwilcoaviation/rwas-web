/* eslint-disable @next/next/no-img-element */
/*
 * Product detail template — Ship 2 refactor (2026-04-21)
 *
 * Chrome matches the approved D2 PDP mockup at /preview/pdp_mockup.html.
 * Each content card (photo box, price card, spec card, trust cells, options)
 * carries the 3D specimen lift (4px 4px 0 ink-900) over the enr_h05 chart.
 *
 * Business rules (driven by Shopify product tags):
 *   otc-eligible       → Papa-Alpha path: Add to Cart + "ships same day"
 *   otc-disabled +
 *   stock-check-required → Garmin path: Confirm stock first + OTC notice
 *   garmin-map-locked  → adds "Garmin List Price — Sold at MAP" line
 *
 * Never render "in stock" or "ships same day" for any Garmin product.
 */
import ProductVariantSelector from '@/components/shopify/ProductVariantSelector';
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

function formatPrice(amount: string, currencyCode: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(Number(amount));
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

/* ──────────────────────────────────────────────────────────────────────────
 * Tag-based gating
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
  const stockCheckRequired = lower.includes('stock-check-required') || (isGarmin && !otcEligible);
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
              <div className="bs-cta-row">
                <a className="bs-cta-primary" href="/collections">Back to collections</a>
                <a className="bs-cta-secondary" href="/contact">Contact us</a>
              </div>
            </div>
          </section>
        </main>
        <BroadsheetFooter />
      </BroadsheetLayout>
    );
  }

  const gating = gateFromTags(product.tags || [], product.vendor);
  const primaryPrice = product.variants[0]?.price;
  const heroImg = product.images[0];
  const vendor = product.vendor || 'RWAS';
  const firstSku = product.variants[0]?.sku;

  // Stock pill + CTA copy
  const stockPill = gating.isGarmin || gating.stockCheckRequired
    ? 'Check stock with RWAS before ordering'
    : gating.otc === 'eligible'
      ? 'In stock — ships same day from Yankton'
      : null;

  const primaryCtaLabel = gating.otc === 'eligible' ? 'Add to Cart' : 'Confirm stock first';
  const primaryCtaHref = gating.otc === 'eligible' ? '/cart' : '/contact';

  // Breadcrumb dateline
  const productTypeLabel = product.productType || (gating.isGarmin ? 'Garmin' : 'Shop');
  const breadcrumbs = ['Pilot Shop', productTypeLabel, vendor].filter(Boolean);

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
              <img
                src={heroImg.url}
                alt={heroImg.altText || product.title}
              />
            ) : (
              <div style={{ aspectRatio: '4/3', background: '#fff', display: 'grid', placeItems: 'center', color: 'var(--ink-500)' }}>
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

            {/* Price card — the buy box */}
            <div className="bs-price-card">
              <div className="label">Price</div>
              <div className="price-row">
                <div className="price">
                  {primaryPrice ? formatPrice(primaryPrice.amount, primaryPrice.currencyCode) : 'Contact for pricing'}
                </div>
                {stockPill ? (
                  <span className={`stock${gating.otc === 'eligible' ? ' stock--ok' : ''}`}>{stockPill}</span>
                ) : null}
              </div>

              {gating.mapLocked ? (
                <div className="map-line">
                  <span className="seal">Garmin List Price</span>
                  Sold at MAP — no markup, no markdown.
                </div>
              ) : null}

              <div className="bs-cta-row">
                <a className="bs-cta-primary" href={primaryCtaHref}>{primaryCtaLabel}</a>
                <a className="bs-cta-secondary" href="/contact">
                  {gating.otc === 'eligible' ? 'Ask about install' : 'Talk to a pilot'}
                </a>
              </div>

              {gating.isGarmin || gating.stockCheckRequired ? (
                <div className="bs-otc">
                  Garmin items are ordered to your request — RWAS does not hold Garmin stock. Call{' '}
                  <a href="tel:+16052998178" style={{ color: 'var(--ink-900)' }}>(605) 299-8178</a>{' '}
                  or message us to confirm availability and lead time before placing an order.
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* Detail — article + spec aside */}
        <section className="bs-detail">
          <article>
            <div className="bs-body">
              {(product.description || '').split('\n\n').slice(0, 6).filter(Boolean).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>

            {/* Variant selector (preserved unchanged) */}
            {product.options.length > 0 ? (
              <div className="bs-options-card">
                <h3>Options</h3>
                <ProductVariantSelector product={product} />
              </div>
            ) : null}

            {/* Trust strip */}
            <div className="bs-trust-strip">
              <div className="cell">
                <span className="lab">Order &amp; fulfillment</span>
                {gating.isGarmin
                  ? <>Ordered direct from Garmin to your build — we do not hold Garmin stock at KYKN. <strong>Check with RWAS for stock before ordering.</strong> Typical lead time: 2&ndash;5 business days from confirmation.</>
                  : gating.otc === 'eligible'
                    ? <>Ships same day from Yankton, SD when ordered by 2pm CT. Most Papa-Alpha tools ship FedEx Ground; overnight available on request.</>
                    : <>Call (605) 299-8178 or email avionics@rwas.team to confirm availability and lead time before placing an order.</>}
              </div>
              <div className="cell">
                <span className="lab">Warranty &amp; service</span>
                {gating.isGarmin
                  ? <>Full Garmin warranty — warranty service performed in-house at our Part 145 repair station, not shipped out.</>
                  : <>Manufacturer warranty. Service and support from our Part 145 repair station, KYKN.</>}
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
                    <tr><th>Price</th><td>{formatPrice(primaryPrice.amount, primaryPrice.currencyCode)}</td></tr>
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
