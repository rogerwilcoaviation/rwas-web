'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { productImageUrl } from '@/lib/product-image';

type CollectionBrowserImage = {
  url: string;
  altText: string | null;
};

export type CollectionBrowserProduct = {
  id: string;
  title: string;
  handle: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
  featuredImage?: CollectionBrowserImage | null;
  priceRange: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
};

type FilterKey = 'subcategory' | 'family' | 'purchase';
const INITIAL_PRODUCT_LIMIT = 24;
const PRODUCT_PAGE_SIZE = 24;

function tagValue(tags: string[] | undefined, prefix: string) {
  return tags?.find((tag) => tag.startsWith(prefix))?.slice(prefix.length) || '';
}

function labelFromSlug(value: string) {
  if (!value) return 'General';
  const special: Record<string, string> = {
    ads: 'ADS',
    b: 'B',
    gps: 'GPS',
    stc: 'STC',
    txi: 'TXi',
    gtn: 'GTN',
    g3x: 'G3X',
    gfc: 'GFC',
    gma: 'GMA',
    gdl: 'GDL',
    gtx: 'GTX',
    gdu: 'GDU',
    lru: 'LRU',
    pfd: 'PFD',
    mfd: 'MFD',
    pma: 'PMA',
    tso: 'TSO',
    otc: 'OTC',
  };

  return value
    .split('-')
    .filter(Boolean)
    .map((part) => special[part] || part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    .replace(/\bADS B\b/g, 'ADS-B');
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function formatPrice(amount: string, currencyCode: string) {
  const numeric = Number(amount || '0');
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(numeric);
}

function productSubcategory(product: CollectionBrowserProduct) {
  return tagValue(product.tags, 'garmin-subcategory:') || 'general';
}

function productFamily(product: CollectionBrowserProduct) {
  return tagValue(product.tags, 'garmin-family:') || 'general';
}

function purchaseMode(product: CollectionBrowserProduct, quoteOnly: boolean) {
  const tags = product.tags?.map((tag) => tag.toLowerCase()) || [];
  const price = Number(product.priceRange.minVariantPrice.amount || '0');
  if (quoteOnly || tags.includes('garmin-dealer-only') || price <= 0) return 'quote-request';
  if (tags.includes('otc-eligible')) return 'otc-ready';
  return 'shopify-product';
}

function countOptions(
  products: CollectionBrowserProduct[],
  getValue: (product: CollectionBrowserProduct) => string
) {
  const counts = new Map<string, number>();
  for (const product of products) {
    const value = getValue(product);
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, label: labelFromSlug(value), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function FilterButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition',
        active
          ? 'border-[#111111] bg-[#111111] text-[#f5f3ef]'
          : 'border-black/10 bg-white text-[#111111] hover:border-[#C49A2A] hover:bg-[#f8f4e8]',
      ].join(' ')}
    >
      <span className="font-semibold">{label}</span>
      <span className={active ? 'text-[#f5f3ef]/70' : 'text-black/45'}>{count}</span>
    </button>
  );
}

function ProductTile({
  product,
  quoteOnly,
  eager = false,
}: {
  product: CollectionBrowserProduct;
  quoteOnly: boolean;
  eager?: boolean;
}) {
  const price = formatPrice(
    product.priceRange.minVariantPrice.amount,
    product.priceRange.minVariantPrice.currencyCode
  );
  const mode = purchaseMode(product, quoteOnly);
  const badge =
    mode === 'quote-request'
      ? 'Quote-request item'
      : mode === 'otc-ready'
      ? 'OTC-ready item'
      : 'Shopify product';

  return (
    <article className="overflow-hidden rounded-[1.25rem] border border-black/10 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <Link href={`/products/${encodeURIComponent(product.handle)}`} className="group block">
        <div className="relative aspect-[4/3] bg-[#f5f3ef]">
          {product.featuredImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={productImageUrl(product.featuredImage.url, 600)}
              alt={product.featuredImage.altText || product.title}
              loading={eager ? 'eager' : 'lazy'}
              fetchPriority={eager ? 'high' : 'low'}
              decoding="async"
              className="h-full w-full object-contain p-6 transition duration-300 group-hover:scale-[1.03]"
            />
          ) : null}
        </div>
      </Link>
      <div className="space-y-3 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-700">
          {badge}
        </p>
        <h3 className="line-clamp-3 text-lg font-bold leading-snug text-[#111111]">
          {product.title}
        </h3>
        <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
          <span>{labelFromSlug(productSubcategory(product))}</span>
          <span aria-hidden="true">/</span>
          <span>{labelFromSlug(productFamily(product))}</span>
        </div>
        {price && mode !== 'quote-request' ? (
          <p className="text-sm text-black/60">From {price}</p>
        ) : null}
        <Link
          href={`/products/${encodeURIComponent(product.handle)}`}
          className="inline-flex items-center justify-center rounded-md bg-[#111111] px-4 py-2 text-sm font-medium text-[#f5f3ef] transition hover:bg-black"
        >
          View product
        </Link>
      </div>
    </article>
  );
}

export default function CollectionProductBrowser({
  products,
  collectionTitle,
  collectionHandle,
  quoteOnly = false,
}: {
  products: CollectionBrowserProduct[];
  collectionTitle: string;
  collectionHandle: string;
  quoteOnly?: boolean;
}) {
  const [subcategory, setSubcategory] = useState('all');
  const [family, setFamily] = useState('all');
  const [purchase, setPurchase] = useState('all');
  const [query, setQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(INITIAL_PRODUCT_LIMIT);

  const indexed = useMemo(
    () =>
      products.map((product) => ({
        product,
        search: normalize([
          product.title,
          product.handle,
          product.vendor,
          product.productType,
          productSubcategory(product),
          productFamily(product),
        ].filter(Boolean).join(' ')),
      })),
    [products]
  );

  const filtered = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    return indexed
      .filter(({ product, search }) => {
        if (subcategory !== 'all' && productSubcategory(product) !== subcategory) return false;
        if (family !== 'all' && productFamily(product) !== family) return false;
        if (purchase !== 'all' && purchaseMode(product, quoteOnly) !== purchase) return false;
        return terms.every((term) => search.includes(term));
      })
      .map(({ product }) => product);
  }, [family, indexed, purchase, query, quoteOnly, subcategory]);

  const filterGroups = useMemo(
    () => [
      {
        key: 'subcategory' as const,
        title: 'Subcategory',
        options: countOptions(products, productSubcategory),
      },
      {
        key: 'family' as const,
        title: 'Family',
        options: countOptions(products, productFamily),
      },
      {
        key: 'purchase' as const,
        title: 'Purchase Type',
        options: countOptions(products, (product) => purchaseMode(product, quoteOnly)),
      },
    ],
    [products, quoteOnly]
  );

  const activeByKey: Record<FilterKey, string> = { subcategory, family, purchase };
  const setByKey: Record<FilterKey, (value: string) => void> = {
    subcategory: setSubcategory,
    family: setFamily,
    purchase: setPurchase,
  };
  const hasActiveFilters =
    subcategory !== 'all' || family !== 'all' || purchase !== 'all' || query.trim().length > 0;
  const visibleProducts = filtered.slice(0, visibleLimit);
  const hasMoreProducts = visibleLimit < filtered.length;

  const filterPanel = (
    <div className="space-y-6">
      <div>
        <p className="bs-kicker">Refine</p>
        <h2 className="mt-2 text-2xl font-black leading-tight text-[#111111]">
          {collectionTitle}
        </h2>
        <p className="mt-3 text-sm leading-6 text-black/60">
          {filtered.length.toLocaleString()} of {products.length.toLocaleString()} products shown.
        </p>
      </div>
      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-black/55">
          Search within collection
        </span>
        <input
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Part, SKU, model..."
          className="w-full rounded-xl border border-black/15 bg-white px-3 py-3 text-sm text-[#111111] outline-none transition focus:border-[#C49A2A] focus:ring-2 focus:ring-[#C49A2A]/20"
        />
      </label>
      {filterGroups.map((group) => (
        <section key={group.key} className="space-y-2" aria-label={group.title}>
          <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-black/55">
            {group.title}
          </h3>
          <FilterButton
            active={activeByKey[group.key] === 'all'}
            label="All"
            count={products.length}
            onClick={() => setByKey[group.key]('all')}
          />
          {group.options.slice(0, 18).map((option) => (
            <FilterButton
              key={option.value}
              active={activeByKey[group.key] === option.value}
              label={option.label}
              count={option.count}
              onClick={() => setByKey[group.key](option.value)}
            />
          ))}
        </section>
      ))}
      {hasActiveFilters ? (
        <button
          type="button"
          onClick={() => {
            setSubcategory('all');
            setFamily('all');
            setPurchase('all');
            setQuery('');
            setVisibleLimit(INITIAL_PRODUCT_LIMIT);
          }}
          className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm font-semibold text-[#111111] transition hover:bg-[#f5f3ef]"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="bs-collection-browser">
      <details className="mb-6 rounded-[1.25rem] border border-black/10 bg-[#f8f4e8] p-4 lg:hidden">
        <summary className="cursor-pointer list-none text-sm font-semibold uppercase tracking-[0.2em] text-[#111111]">
          Filter products
        </summary>
        <div className="mt-5">{filterPanel}</div>
      </details>

      <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-6 rounded-[1.25rem] border border-black/10 bg-[#f8f4e8] p-5">
            {filterPanel}
          </div>
        </aside>
        <section aria-label={`${collectionTitle} products`}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="bs-body" style={{ margin: 0 }}>
              Showing {visibleProducts.length.toLocaleString()} of {filtered.length.toLocaleString()} products
            </p>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/45">
              {collectionHandle}
            </p>
          </div>
          {filtered.length ? (
            <>
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {visibleProducts.map((product, index) => (
                  <ProductTile
                    key={product.id}
                    product={product}
                    quoteOnly={quoteOnly}
                    eager={index < 3}
                  />
                ))}
              </div>
              {hasMoreProducts ? (
                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setVisibleLimit((limit) => limit + PRODUCT_PAGE_SIZE)}
                    className="inline-flex items-center justify-center rounded-md border border-[#111111] bg-white px-5 py-3 text-sm font-semibold text-[#111111] transition hover:bg-[#f5f3ef]"
                  >
                    Load more products
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-[1.25rem] border border-black/10 bg-white p-8">
              <p className="bs-body">No products match those filters yet.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
