'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

export type PartFinderProduct = {
  id: string;
  title: string;
  handle: string;
  vendor?: string;
  productType?: string;
  skus: string[];
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export default function PartFinder({
  products,
  scopeLabel = 'catalog',
}: {
  products: PartFinderProduct[];
  scopeLabel?: string;
}) {
  const [query, setQuery] = useState('');
  const cleanQuery = normalize(query);

  const indexed = useMemo(
    () =>
      products.map((product) => ({
        product,
        haystack: normalize(
          [
            product.title,
            product.handle,
            product.vendor,
            product.productType,
            ...product.skus,
          ]
            .filter(Boolean)
            .join(' '),
        ),
      })),
    [products],
  );

  const results = useMemo(() => {
    if (cleanQuery.length < 2) return [];
    const terms = cleanQuery.split(/\s+/).filter(Boolean);
    return indexed
      .filter(({ haystack }) => terms.every((term) => haystack.includes(term)))
      .slice(0, 12)
      .map(({ product }) => product);
  }, [cleanQuery, indexed]);

  return (
    <div className="bs-part-finder" aria-label="Find Component or Part">
      <div className="bs-part-finder__copy">
        <p className="bs-kicker">Find Component/Part</p>
        <h2 className="bs-part-finder__title">
          Search by part number, SKU, component name, or Garmin model.
        </h2>
        <p className="bs-body">
          Searching {products.length.toLocaleString('en-US')} {scopeLabel} item
          {products.length === 1 ? '' : 's'}.
        </p>
      </div>
      <label className="bs-part-finder__search">
        <span>Part/component search</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Try GTN, GDU 460, 010-02002-05, GDL, TXi…"
          autoComplete="off"
        />
      </label>
      <div className="bs-part-finder__results" aria-live="polite">
        {cleanQuery.length < 2 ? (
          <p className="bs-body">
            Enter at least two characters to search the visible catalog.
          </p>
        ) : results.length ? (
          <ul>
            {results.map((product) => {
              return (
                <li key={product.id}>
                  <Link
                    href={`/products/${encodeURIComponent(product.handle)}`}
                  >
                    <span>
                      <strong>{product.title}</strong>
                      <em>
                        {[
                          product.skus.filter(Boolean).join(' / '),
                          product.productType,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </em>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="bs-body">
            No exact catalog match found. Try a shorter part number or component
            family.
          </p>
        )}
      </div>
    </div>
  );
}
