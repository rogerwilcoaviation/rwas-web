'use client';

/*
 * CartFloater
 *
 * Fixed-position top-right broadsheet-styled link to /cart, with a live
 * "(N)" count fetched from /api/cart.
 *
 * Rendered once from app/layout.tsx so it appears on every www page,
 * including pages that don't opt into the broadsheet chrome wrapper.
 * Re-fetches when:
 *   - component mounts
 *   - a 'rwas-cart-updated' event fires (add/patch/remove sites dispatch)
 *   - tab becomes visible again (covers tab-switch cases)
 *   - localStorage CART_STORAGE_KEY changes in another tab
 *
 * If cart id is missing or fetch fails, the link still renders reading
 * plain "Cart" — never breaks the page.
 */

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

const CART_STORAGE_KEY = 'rwas-shopify-cart-id';
export const CART_UPDATED_EVENT = 'rwas-cart-updated';

export default function CartFloater() {
  const [count, setCount] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const cartId = window.localStorage.getItem(CART_STORAGE_KEY);
      if (!cartId) {
        setCount(0);
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
        setCount(0);
        return;
      }
      const payload = await response.json();
      setCount(payload.cart?.totalQuantity ?? 0);
    } catch {
      setCount(0);
    }
  }, []);

  useEffect(() => {
    refresh();

    const onUpdated = () => refresh();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY) refresh();
    };

    window.addEventListener(CART_UPDATED_EVENT, onUpdated);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, onUpdated);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
    };
  }, [refresh]);

  const label =
    count === null || count === 0 ? 'Cart' : `Cart (${count})`;
  const ariaLabel =
    count && count > 0
      ? `Shopping cart, ${count} item${count === 1 ? '' : 's'}`
      : 'Shopping cart';

  return (
    <Link
      href="/cart"
      className="rwas-cart-floater"
      aria-label={ariaLabel}
    >
      {label}
    </Link>
  );
}
