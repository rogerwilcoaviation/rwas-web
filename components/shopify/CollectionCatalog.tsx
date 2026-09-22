'use client';

import { useState } from 'react';
import CollectionProductBrowser, {
  type CollectionBrowserProduct,
} from '@/components/shopify/CollectionProductBrowser';
import PartFinder, {
  type PartFinderProduct,
} from '@/components/shopify/PartFinder';

type CatalogData = {
  products: CollectionBrowserProduct[];
  finderProducts: PartFinderProduct[];
};

export default function CollectionCatalog({
  initialProducts,
  dataUrl,
  total,
  collectionTitle,
  collectionHandle,
  quoteOnly,
}: {
  initialProducts: CollectionBrowserProduct[];
  dataUrl: string;
  total: number;
  collectionTitle: string;
  collectionHandle: string;
  quoteOnly: boolean;
}) {
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  async function loadCatalog() {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(dataUrl);
      if (!response.ok) throw new Error('Catalog unavailable');
      const data: CatalogData = await response.json();
      if (
        !Array.isArray(data.products) ||
        !Array.isArray(data.finderProducts) ||
        data.products.length !== total
      )
        throw new Error('Incomplete catalog');
      setCatalog(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      {!catalog && (
        <div className="mb-6 space-y-3">
          <p className="bs-body">
            Showing the first {initialProducts.length} of {total} products. Load
            the complete catalog to search and filter every item, or use the
            complete product index below.
          </p>
          <button
            type="button"
            className="bs-cta-primary"
            onClick={loadCatalog}
            disabled={loading}
          >
            {loading ? 'Loading catalog…' : 'Search and filter all products'}
          </button>
          <p role="status">
            {error
              ? 'The catalog could not load. Please retry or use the complete product index below.'
              : loading
                ? 'Loading the complete catalog.'
                : ''}
          </p>
        </div>
      )}
      {catalog && (
        <PartFinder
          products={catalog.finderProducts}
          scopeLabel={collectionTitle}
        />
      )}
      <CollectionProductBrowser
        products={catalog?.products || initialProducts}
        collectionTitle={collectionTitle}
        collectionHandle={collectionHandle}
        quoteOnly={quoteOnly}
      />
    </>
  );
}
