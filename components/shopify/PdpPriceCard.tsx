'use client';

/*
 * PdpPriceCard — client component for PDP buy box.
 *
 * - Variant dropdown (<select>) displays Shopify variants.
 * - Displayed price tracks the selected variant.
 * - Single CTA:
 *     otc === 'eligible'  →  "Add to Cart"    (POST /api/cart → /cart)
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

export default function PdpPriceCard(props: PdpPriceCardProps) {
  const { productTitle, variants, otc, stockCheckRequired, isGarmin, mapLocked } = props;

  const [selectedId, setSelectedId] = useState<string>(variants[0]?.id || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => variants.find((v) => v.id === selectedId) || variants[0],
    [variants, selectedId]
  );

  const otcEligible = otc === 'eligible';

  const stockPill =
    isGarmin || stockCheckRequired
      ? 'Check stock with RWAS before ordering'
      : otcEligible
        ? 'In stock — ships same day from Yankton'
        : null;

  const displayPrice = selected?.price
    ? formatPrice(selected.price.amount, selected.price.currencyCode)
    : 'Contact for pricing';

  const multiVariant = variants.length > 1;
  const contactHref = selected?.sku
    ? `/contact?sku=${encodeURIComponent(selected.sku)}&product=${encodeURIComponent(productTitle)}`
    : `/contact?product=${encodeURIComponent(productTitle)}`;

  async function handleAddToCart() {
    if (!selected || !selected.availableForSale) return;
    setLoading(true);
    setError(null);
    try {
      const existingCartId =
        typeof window !== 'undefined' ? window.localStorage.getItem(CART_STORAGE_KEY) : null;
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartId: existingCartId,
          merchandiseId: selected.id,
          quantity: 1,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to add item to cart.');
      }
      if (payload.cart?.id && typeof window !== 'undefined') {
        window.localStorage.setItem(CART_STORAGE_KEY, payload.cart.id);
      }
      window.location.href = '/cart';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add item to cart.');
      setLoading(false);
    }
  }

  return (
    <div className="bs-price-card">
      <div className="label">Price</div>
      <div className="price-row">
        <div className="price">{displayPrice}</div>
        {stockPill ? (
          <span className={`stock${otcEligible ? ' stock--ok' : ''}`}>{stockPill}</span>
        ) : null}
      </div>

      {mapLocked ? (
        <div className="map-line">
          <span className="seal">Garmin List Price</span>
          Sold at MAP — no markup, no markdown.
        </div>
      ) : null}

      {multiVariant ? (
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
                {variantLabel(v)}
                {v.sku ? ` — SKU ${v.sku}` : ''}
                {!v.availableForSale ? ' (unavailable)' : ''}
              </option>
            ))}
          </select>
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
        ) : (
          <Link className="bs-cta-primary" href={contactHref}>
            Check availability
          </Link>
        )}
      </div>

      {error ? <div className="bs-cta-error">{error}</div> : null}

      {isGarmin || stockCheckRequired ? (
        <div className="bs-otc">
          Garmin items are ordered to your request — RWAS does not hold Garmin stock. Call{' '}
          <a href="tel:+16052998178" style={{ color: 'var(--ink-900)' }}>(605) 299-8178</a> or
          message us to confirm availability and lead time before placing an order.
        </div>
      ) : null}
    </div>
  );
}
