'use client';

import { ShopifyProductDetail, ShopifyVariant, isQuoteProduct } from '@/lib/shopify';
import { useMemo, useState } from 'react';
import AddToCartButton from './AddToCartButton';
import QuoteRequestForm from './QuoteRequestForm';

function formatPrice(amount: string, currencyCode: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export default function ProductVariantSelector({ product }: { product: ShopifyProductDetail }) {
  const [selectedVariantId, setSelectedVariantId] = useState(product.variants[0]?.id);

  const selectedVariant = useMemo(
    () => product.variants.find((variant) => variant.id === selectedVariantId) || product.variants[0],
    [product.variants, selectedVariantId]
  );

  if (!selectedVariant) return null;

  const quoteOnly = isQuoteProduct({ variants: [selectedVariant], productType: product.productType });

  return (
    <div className="space-y-6 rounded-[1.5rem] border border-black/10 bg-white p-6 shadow-sm">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary-700">
          Variant options
        </p>
        <div className="mt-4 space-y-3">
          {product.variants.map((variant) => {
            const isActive = variant.id === selectedVariant.id;
            return (
              <button
                key={variant.id}
                type="button"
                onClick={() => setSelectedVariantId(variant.id)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  isActive
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-black/10 hover:border-primary-500/40 hover:bg-[#f5f3ef]'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-[#111111]">{variant.title}</p>
                    <p className="mt-1 text-sm text-black/60">
                      {variant.selectedOptions
                        .filter((option) => option.name !== 'Title')
                        .map((option) => `${option.name}: ${option.value}`)
                        .join(' · ') || 'Standard configuration'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[#111111]">
                      {formatPrice(variant.price.amount, variant.price.currencyCode)}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-black/50">
                      {variant.availableForSale ? 'Available' : 'Unavailable'}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-[#f5f3ef] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-black/50">Selected SKU</p>
            <p className="text-lg font-semibold text-[#111111]">{selectedVariant.sku || 'Not listed'}</p>
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-black/50">Inventory</p>
            <p className="text-lg font-semibold text-[#111111]">
              {selectedVariant.quantityAvailable && selectedVariant.quantityAvailable > 0
                ? `${selectedVariant.quantityAvailable} available`
                : selectedVariant.availableForSale
                  ? 'Available to order'
                  : 'Currently unavailable'}
            </p>
          </div>
        </div>
      </div>

      {quoteOnly ? (
        <QuoteRequestForm productTitle={product.title} sku={selectedVariant.sku} />
      ) : (
        <AddToCartButton merchandiseId={selectedVariant.id} disabled={!selectedVariant.availableForSale} />
      )}
    </div>
  );
}
