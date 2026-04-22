'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Specimen } from '@/components/shared/broadsheet';

const CART_STORAGE_KEY = 'rwas-shopify-cart-id';

type MoneyV2 = { amount: string; currencyCode: string };

type CartLine = {
  id: string;
  quantity: number;
  merchandise: {
    id?: string;
    title: string;
    price: MoneyV2;
    product: {
      title: string;
      handle: string;
      featuredImage?: { url: string; altText: string | null } | null;
    };
    selectedOptions: Array<{ name: string; value: string }>;
  };
};

type Cart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: { subtotalAmount: MoneyV2; totalAmount: MoneyV2 };
  lines: CartLine[];
};

function formatPrice(amount: string | number, currencyCode: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export default function CartClient() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadCart() {
      // PATCHED-CART-LOADER: try/catch/finally so a failed fetch or
      // bad JSON never strands the UI on "Loading cart...".
      try {
        const cartId = window.localStorage.getItem(CART_STORAGE_KEY);
        if (!cartId) {
          setCart(null);
          return;
        }
        const response = await fetch(
          `/api/cart?cartId=${encodeURIComponent(cartId)}`,
          { headers: { Accept: 'application/json' } },
        );
        if (!response.ok) {
          if (response.status === 400 || response.status === 404) {
            window.localStorage.removeItem(CART_STORAGE_KEY);
          }
          throw new Error(`cart fetch failed: ${response.status}`);
        }
        const payload = await response.json();
        setCart(payload.cart || null);
        if (!payload.cart) {
          window.localStorage.removeItem(CART_STORAGE_KEY);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setCart(null);
      } finally {
        setLoading(false);
      }
    }
    loadCart();
  }, []);

  const markBusy = (lineId: string, on: boolean) =>
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(lineId);
      else next.delete(lineId);
      return next;
    });

  const removeLine = useCallback(
    async (lineId: string) => {
      if (!cart) return;
      markBusy(lineId, true);
      setError(null);
      try {
        const res = await fetch('/api/cart', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cartId: cart.id, lineIds: [lineId] }),
        });
        if (!res.ok) throw new Error(`remove failed: ${res.status}`);
        const payload = await res.json();
        setCart(payload.cart || null);
        if (!payload.cart || (payload.cart.lines || []).length === 0) {
          window.localStorage.removeItem(CART_STORAGE_KEY);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        markBusy(lineId, false);
      }
    },
    [cart],
  );

  const updateQuantity = useCallback(
    async (lineId: string, quantity: number) => {
      if (!cart) return;
      if (quantity < 1) {
        return removeLine(lineId);
      }
      markBusy(lineId, true);
      setError(null);
      try {
        const res = await fetch('/api/cart', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cartId: cart.id, lineId, quantity }),
        });
        if (!res.ok) throw new Error(`update failed: ${res.status}`);
        const payload = await res.json();
        setCart(payload.cart || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        markBusy(lineId, false);
      }
    },
    [cart, removeLine],
  );

  if (loading) {
    return (
      <Specimen variant="flat">
        <div style={{ padding: '28px 24px', textAlign: 'center' }}>
          <p className="bs-body" style={{ margin: 0 }}>
            Loading cart&hellip;
          </p>
        </div>
      </Specimen>
    );
  }

  if (!cart || cart.lines.length === 0) {
    return (
      <Specimen variant="flat">
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <p className="bs-kicker">Your cart is empty</p>
          <p className="bs-script-accent">&mdash; nothing on order yet &mdash;</p>
          <h2 className="bs-headline bs-headline--section" style={{ marginTop: 8 }}>
            Pick something from the broadsheet.
          </h2>
          <p
            className="bs-body"
            style={{ maxWidth: 560, margin: '12px auto 24px' }}
          >
            Start with the RWAS collections &mdash; Garmin certified avionics, Papa-Alpha tools, or the on-sale rack &mdash; and add a few products to your cart.
          </p>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <Link href="/collections" className="bs-cta-primary">
              Browse collections
            </Link>
            <Link href="/" className="bs-cta-secondary">
              Back to front page
            </Link>
          </div>
        </div>
      </Specimen>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gap: 28,
        gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 0.85fr)',
        alignItems: 'start',
      }}
      className="cart-grid"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {cart.lines.map((line) => {
          const isBusy = busy.has(line.id);
          const lineTotal =
            Number(line.merchandise.price.amount) * line.quantity;
          const variantLabel =
            line.merchandise.title &&
            line.merchandise.title !== 'Default Title'
              ? line.merchandise.title
              : null;
          return (
            <Specimen key={line.id} variant="flat">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr',
                  gap: 20,
                  padding: '18px 20px',
                  alignItems: 'flex-start',
                  opacity: isBusy ? 0.7 : 1,
                  transition: 'opacity 120ms ease',
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    width: 120,
                    height: 120,
                    background: '#f5f1e8',
                    borderRadius: 4,
                    overflow: 'hidden',
                    border: '1px solid rgba(26, 26, 26, 0.08)',
                  }}
                >
                  {line.merchandise.product.featuredImage ? (
                    <Image
                      src={line.merchandise.product.featuredImage.url}
                      alt={
                        line.merchandise.product.featuredImage.altText ||
                        line.merchandise.product.title
                      }
                      fill
                      sizes="120px"
                      style={{ objectFit: 'contain', padding: 6 }}
                    />
                  ) : null}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Link
                    href={`/products/${encodeURIComponent(line.merchandise.product.handle)}`}
                    className="bs-product-headline"
                    style={{
                      fontSize: '1.15rem',
                      lineHeight: 1.2,
                      textDecoration: 'none',
                    }}
                  >
                    {line.merchandise.product.title}
                  </Link>

                  {variantLabel ? (
                    <p className="bs-detail" style={{ margin: 0 }}>
                      Variant: {variantLabel}
                    </p>
                  ) : null}

                  <p className="bs-detail" style={{ margin: 0 }}>
                    {formatPrice(
                      line.merchandise.price.amount,
                      line.merchandise.price.currencyCode,
                    )}{' '}
                    each
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 10,
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'stretch',
                        border: '1px solid rgba(26,26,26,0.2)',
                        borderRadius: 3,
                        overflow: 'hidden',
                        background: '#fdfbf4',
                      }}
                    >
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => updateQuantity(line.id, line.quantity - 1)}
                        aria-label={
                          line.quantity === 1
                            ? `Remove ${line.merchandise.product.title}`
                            : `Decrease quantity of ${line.merchandise.product.title}`
                        }
                        style={{
                          padding: '6px 14px',
                          background: 'transparent',
                          border: 'none',
                          cursor: isBusy ? 'not-allowed' : 'pointer',
                          fontSize: '1.05rem',
                          lineHeight: 1,
                          color: '#1a1a1a',
                        }}
                      >
                        &minus;
                      </button>
                      <span
                        aria-live="polite"
                        style={{
                          minWidth: 40,
                          textAlign: 'center',
                          padding: '6px 6px',
                          fontWeight: 600,
                          borderLeft: '1px solid rgba(26,26,26,0.18)',
                          borderRight: '1px solid rgba(26,26,26,0.18)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => updateQuantity(line.id, line.quantity + 1)}
                        aria-label={`Increase quantity of ${line.merchandise.product.title}`}
                        style={{
                          padding: '6px 14px',
                          background: 'transparent',
                          border: 'none',
                          cursor: isBusy ? 'not-allowed' : 'pointer',
                          fontSize: '1.05rem',
                          lineHeight: 1,
                          color: '#1a1a1a',
                        }}
                      >
                        +
                      </button>
                    </div>

                    <p
                      style={{
                        margin: 0,
                        fontWeight: 700,
                        fontSize: '1.05rem',
                        color: '#1a1a1a',
                      }}
                    >
                      {formatPrice(
                        lineTotal,
                        line.merchandise.price.currencyCode,
                      )}
                    </p>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => removeLine(line.id)}
                      aria-label={`Remove ${line.merchandise.product.title} from cart`}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#5a5448',
                        textDecoration: 'underline',
                        textUnderlineOffset: 3,
                        cursor: isBusy ? 'not-allowed' : 'pointer',
                        fontSize: '0.92rem',
                        padding: 0,
                        letterSpacing: '0.02em',
                      }}
                    >
                      {isBusy ? 'Removing\u2026' : 'Remove'}
                    </button>
                  </div>
                </div>
              </div>
            </Specimen>
          );
        })}
      </div>

      <aside>
        <Specimen variant="hero">
          <div style={{ padding: '22px 24px' }}>
            <p className="bs-kicker" style={{ marginTop: 0 }}>
              Order summary
            </p>
            <h2
              className="bs-headline bs-headline--section"
              style={{ marginTop: 6, marginBottom: 18 }}
            >
              Tally.
            </h2>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                fontSize: '0.98rem',
              }}
            >
              <SummaryRow label="Items" value={String(cart.totalQuantity)} />
              <SummaryRow
                label="Subtotal"
                value={formatPrice(
                  cart.cost.subtotalAmount.amount,
                  cart.cost.subtotalAmount.currencyCode,
                )}
              />
              <hr
                style={{
                  border: 'none',
                  borderTop: '1px solid rgba(26,26,26,0.2)',
                  margin: '6px 0',
                }}
              />
              <SummaryRow
                label="Total"
                value={formatPrice(
                  cart.cost.totalAmount.amount,
                  cart.cost.totalAmount.currencyCode,
                )}
                bold
              />
            </div>

            <p
              className="bs-detail"
              style={{
                marginTop: 14,
                marginBottom: 18,
                fontSize: '0.85rem',
              }}
            >
              Shipping &amp; tax are calculated at the Shopify checkout.
            </p>

            <a
              href={cart.checkoutUrl}
              className="bs-cta-primary"
              style={{
                display: 'block',
                textAlign: 'center',
                textDecoration: 'none',
              }}
            >
              Proceed to Shopify checkout
            </a>

            <Link
              href="/collections"
              className="bs-cta-secondary"
              style={{
                display: 'block',
                textAlign: 'center',
                marginTop: 10,
                textDecoration: 'none',
              }}
            >
              Continue shopping
            </Link>

            {error ? (
              <p
                style={{
                  marginTop: 14,
                  marginBottom: 0,
                  fontSize: '0.85rem',
                  color: '#8a2a2a',
                }}
              >
                {error}
              </p>
            ) : null}
          </div>
        </Specimen>
      </aside>

      <style jsx>{`
        @media (max-width: 880px) {
          :global(.cart-grid) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        fontWeight: bold ? 700 : 400,
        color: '#1a1a1a',
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
