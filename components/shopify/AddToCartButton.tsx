'use client';

import { Button } from '@/components/shared/ui/button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const CART_STORAGE_KEY = 'rwas-shopify-cart-id';

export default function AddToCartButton({
  merchandiseId,
  disabled,
}: {
  merchandiseId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setLoading(true);
    setError(null);

    try {
      const existingCartId = window.localStorage.getItem(CART_STORAGE_KEY);
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartId: existingCartId,
          merchandiseId,
          quantity: 1,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Unable to add item to cart.');
      }

      if (payload.cart?.id) {
        window.localStorage.setItem(CART_STORAGE_KEY, payload.cart.id);
      }

      window.dispatchEvent(new Event("rwas-cart-updated"));
      router.push("/cart");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add item to cart.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={handleAdd}
        disabled={disabled || loading}
        className="bg-[#111111] text-[#f5f3ef] hover:bg-black"
      >
        {loading ? 'Adding…' : 'Add to cart'}
      </Button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
