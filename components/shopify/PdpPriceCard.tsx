'use client';

/*
 * PdpPriceCard — client component for PDP buy box.
 *
 * - Variant dropdown (<select>) displays Shopify variants.
 * - Displayed price tracks the selected variant.
 * - Single CTA:
 *     otc === 'eligible'  →  "Add to Cart"    (Shopify cart permalink)
 *     otherwise           →  "Check availability" (Link to /contact?sku=...)
 * - Stock pill, MAP line, and OTC notice rendered from parent-supplied flags.
 *
 * Business rule: add-to-cart visibility is driven purely by the `otc-eligible`
 * Shopify tag — brand-agnostic. A Garmin product tagged `otc-eligible`
 * gets add-to-cart just like a Papa-Alpha tool.
 */

import Link from 'next/link';
import { useMemo, useState } from 'react';

const CART_STORAGE_KEY = 'rwas-shopify-cart-id';

type Money = { amount: string; currencyCode: string };

export type PdpVariant = {
  id: string;
  title: string;
  sku?: string | null;
  price: Money;
  compareAtPrice?: Money | null;
  availableForSale: boolean;
  selectedOptions: Array<{ name: string; value: string }>;
};

export type PdpPriceCardProps = {
  productTitle: string;
  variants: PdpVariant[];
  otc: 'eligible' | 'disabled' | 'unknown';
  stockCheckRequired: boolean;
  isGarmin: boolean;
  mapLocked: boolean;
  shopifyCartBaseUrl: string;
};

function formatPrice(amount: string, currencyCode: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function variantLabel(v: PdpVariant) {
  const opts = v.selectedOptions
    .filter((o) => o.name !== 'Title')
    .map((o) => `${o.name}: ${o.value}`)
    .join(' · ');
  return opts || v.title || 'Standard configuration';
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compactVariantLabel(v: PdpVariant) {
  let compact = variantLabel(v)
    .replace(/\b(?:Airframe|Configuration|Variant|Option):\s*/gi, '')
    .replace(/\bAileron and Flap Rigging Tool\b/gi, 'Tool')
    .replace(/\bBellcrank Reference Tool\b/gi, 'Ref')
    .replace(/\bBell Crank Reference Tool\b/gi, 'Ref')
    .replace(/\bBell Crank Rigging Tool\b/gi, 'Tool')
    .replace(/\bRudder Reference Tool\b/gi, 'Ref')
    .replace(/\bRudder Trim Rigging Tool\b/gi, 'Tool')
    .replace(/\bStabilator Reference Tool\b/gi, 'Ref')
    .replace(/\bStabilator Rigging Tool\b/gi, 'Tool')
    .replace(/\bRudder Rigging Tool\b/gi, 'Tool')
    .replace(/\bRigging Kit\b/gi, 'Kit')
    .replace(/\bRigging Tool\b/gi, 'Tool')
    .replace(/\s+/g, ' ')
    .trim();

  const sku = v.sku?.trim();
  if (!sku) return compact || 'Standard configuration';

  compact = compact
    .replace(new RegExp(`^(?:Kit|Tool)?\\s*${escapeRegExp(sku)}\\b\\s*-?\\s*`, 'i'), '')
    .trim();

  return compact ? `${sku} - ${compact}` : sku;
}

function variantNumericId(gid?: string | null): string | null {
  if (!gid) return null;
  const match = gid.match(/(\d+)$/);
  return match ? match[1] : null;
}

export default function PdpPriceCard(props: PdpPriceCardProps) {
  const { productTitle, variants, otc, stockCheckRequired, isGarmin, mapLocked, shopifyCartBaseUrl } = props;

  const [selectedId, setSelectedId] = useState<string>(variants[0]?.id || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => variants.find((v) => v.id === selectedId) || variants[0],
    [variants, selectedId]
  );

  const otcEligible = otc === 'eligible';
  const isNonOtcGarmin = isGarmin && !otcEligible;

  // Stock pill: never call Garmin items "in stock". Garmin products are
  // special-order/direct-fulfillment: Garmin delivers to RWAS, then RWAS
  // delivers to the customer. Papa-Alpha/non-Garmin OTC items may still show
  // normal availability language.
  const stockPill = otcEligible
    ? isGarmin
      ? 'Special order — Garmin delivers to RWAS, then RWAS delivers to you'
      : 'Available to order'
    : null;

  const displayPrice = selected?.price
    ? formatPrice(selected.price.amount, selected.price.currencyCode)
    : 'Contact for pricing';
  const normalListPrice = selected?.compareAtPrice
    ? formatPrice(selected.compareAtPrice.amount, selected.compareAtPrice.currencyCode)
    : null;
  const hasSalePrice = Boolean(normalListPrice && selected?.price && Number(selected.compareAtPrice?.amount) > Number(selected.price.amount));

  const multiVariant = variants.length > 1;
  const contactHref = selected?.sku
    ? `/contact?sku=${encodeURIComponent(selected.sku)}&product=${encodeURIComponent(productTitle)}`
    : `/contact?product=${encodeURIComponent(productTitle)}`;

  async function handleAddToCart() {
    if (!selected || !selected.availableForSale) return;
    setLoading(true);
    setError(null);
    try {
      const numericId = variantNumericId(selected.id);
      if (!numericId) {
        throw new Error('Unable to prepare Shopify checkout for this item.');
      }
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(CART_STORAGE_KEY);
        window.location.href = new URL(`/cart/${numericId}:1`, shopifyCartBaseUrl).toString();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add item to cart.');
      setLoading(false);
    }
  }

  return (
    <div className="bs-price-card">
      {!isNonOtcGarmin ? (
        <>
          <div className="label">{hasSalePrice ? 'Sale Price' : 'Price'}</div>
          <div className="price-row">
            <div className="price"><strong>{displayPrice}</strong></div>
            {stockPill ? (
              <span className={`stock${otcEligible ? ' stock--ok' : ''}`}>{stockPill}</span>
            ) : null}
          </div>
          {hasSalePrice ? (
            <div className="map-line">
              <span className="seal">Normal Garmin List Price</span>
              <span className="map-line-copy">After the sale: {normalListPrice}</span>
            </div>
          ) : null}
        </>
      ) : null}

      {mapLocked && !isNonOtcGarmin && !hasSalePrice ? (
        <div className="map-line">
          <span className="seal">Garmin List Price</span>
          Sold at MAP — no markup, no markdown.
        </div>
      ) : null}

      {multiVariant && !isNonOtcGarmin ? (
        <div className="bs-variant-row">
          <label className="bs-variant-label" htmlFor="pdp-variant-select">
            Configuration
          </label>
          <select
            id="pdp-variant-select"
            className="bs-variant-select"
            value={selected?.id || ''}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id} disabled={!v.availableForSale}>
                {compactVariantLabel(v)}
                {!v.availableForSale ? ' (unavailable)' : ''}
              </option>
            ))}
          </select>
          <div className="bs-variant-detail" aria-live="polite">
            {selected ? variantLabel(selected) : 'Standard configuration'}
            {selected?.sku ? ` - SKU ${selected.sku}` : ''}
          </div>
        </div>
      ) : null}

      <div className="bs-cta-row bs-cta-row--single">
        {otcEligible ? (
          <button
            type="button"
            className="bs-cta-primary"
            onClick={handleAddToCart}
            disabled={loading || !selected?.availableForSale}
          >
            {loading ? 'Adding…' : selected?.availableForSale ? 'Add to Cart' : 'Unavailable'}
          </button>
        ) : isNonOtcGarmin ? (
          <Link className="bs-cta-primary" href={contactHref}>
            Call RWAS for Pricing and Installation
          </Link>
        ) : null}
      </div>

      {error ? <div className="bs-cta-error">{error}</div> : null}

      {/* bs-otc "RWAS does not hold Garmin stock" notice removed per product
          direction (2026-04-21). */}
    </div>
  );
}
