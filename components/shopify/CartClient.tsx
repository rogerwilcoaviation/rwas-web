'use client';

import { Button } from '@/components/shared/ui/button';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const CART_STORAGE_KEY = 'rwas-shopify-cart-id';

type Cart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: {
    subtotalAmount: { amount: string; currencyCode: string };
    totalAmount: { amount: string; currencyCode: string };
  };
  lines: Array<{
    id: string;
    quantity: number;
    merchandise: {
      title: string;
      price: { amount: string; currencyCode: string };
      product: {
        title: string;
        handle: string;
        featuredImage?: { url: string; altText: string | null } | null;
      };
      selectedOptions: Array<{ name: string; value: string }>;
    };
  }>;
};

function formatPrice(amount: string, currencyCode: string) {
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
          { headers: { Accept: "application/json" } },
        );
        if (!response.ok) {
          // 404 / 502 etc. — clear the stored id if the cart is gone.
          if (response.status === 400 || response.status === 404) {
            window.localStorage.removeItem(CART_STORAGE_KEY);
          }
          throw new Error(`cart fetch failed: ${response.status}`);
        }
        const payload = await response.json();
        setCart(payload.cart || null);
        // If Shopify returned null (expired cart), drop the stale id.
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

  if (loading) {
    return <p className="text-black/65">Loading cart…</p>;
  }

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-black/10 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-bold">Your cart is empty</h2>
        <p className="mt-3 text-black/65">
          Start with the RWAS collections and add a few products.
        </p>
        <Button asChild className="mt-6 bg-[#111111] text-[#f5f3ef] hover:bg-black">
          <Link href="/collections">Browse collections</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-4">
        {cart.lines.map((line) => (
          <div key={line.id} className="flex gap-4 rounded-[1.5rem] border border-black/10 bg-white p-4 shadow-sm">
            <div className="relative h-24 w-24 overflow-hidden rounded-2xl bg-[#f5f3ef]">
              {line.merchandise.product.featuredImage ? (
                <Image
                  src={line.merchandise.product.featuredImage.url}
                  alt={line.merchandise.product.featuredImage.altText || line.merchandise.product.title}
                  fill
                  className="object-contain p-3"
                  sizes="96px"
                />
              ) : null}
            </div>
            <div className="flex-1">
              <Link href={`/products/${encodeURIComponent(line.merchandise.product.handle)}`} className="text-lg font-semibold text-[#111111] hover:text-primary-700">
                {line.merchandise.product.title}
              </Link>
              <p className="mt-2 text-sm text-black/60">Variant: {line.merchandise.title}</p>
              <p className="mt-1 text-sm text-black/60">Qty: {line.quantity}</p>
              <p className="mt-3 font-semibold text-[#111111]">
                {formatPrice(line.merchandise.price.amount, line.merchandise.price.currencyCode)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-[1.5rem] border border-black/10 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold">Order summary</h2>
        <div className="mt-6 space-y-3 text-sm text-black/70">
          <div className="flex items-center justify-between">
            <span>Items</span>
            <span>{cart.totalQuantity}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span>
              {formatPrice(cart.cost.subtotalAmount.amount, cart.cost.subtotalAmount.currencyCode)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-black/10 pt-3 font-semibold text-[#111111]">
            <span>Total</span>
            <span>
              {formatPrice(cart.cost.totalAmount.amount, cart.cost.totalAmount.currencyCode)}
            </span>
          </div>
        </div>

        <Button asChild className="mt-6 w-full bg-[#111111] text-[#f5f3ef] hover:bg-black">
          <Link href={cart.checkoutUrl}>Proceed to Shopify checkout</Link>
        </Button>
      </div>
    </div>
  );
}
