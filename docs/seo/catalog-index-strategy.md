# Catalog Index Strategy

Current posture: keep the catalog indexed until Search Console proves which URLs are dead weight.

RWAS has roughly 1,600 product URLs. That is not automatically a problem; Sarasota Avionics and Pacific Coast Avionics also index large avionics catalogs. The risk is not URL count by itself. The risk is thin, duplicate, or zero-demand product pages consuming crawl attention while stronger service pages compete for local/commercial intent.

## Run The Product Audit

```bash
npm run seo:catalog-audit
```

Useful variants:

```bash
CATALOG_AUDIT_LIMIT=100 npm run seo:catalog-audit
CATALOG_AUDIT_BASE_URL=https://www.rogerwilcoaviation.com CATALOG_AUDIT_LIMIT=2000 npm run seo:catalog-audit
```

Outputs:

`logs/catalog-index-audit/<timestamp>/products.csv`

The audit checks title length, meta description length, canonical, Product schema, noindex state, fallback image residue, and rough body word count.

## Full Audit Snapshot - 2026-05-25

Command:

```bash
CATALOG_AUDIT_LIMIT=2000 npm run seo:catalog-audit
```

Output:

`logs/catalog-index-audit/2026-05-25T13-07-22-413Z/`

Results:

- Audited 1,591 product URLs.
- 1,591 returned OK; zero fetch failures.
- 1,591 had valid canonicals; zero canonical misses.
- 1,591 had Product schema; zero Product schema misses.
- Zero noindex tags found.
- Zero short meta descriptions under the audit threshold.
- Five fallback images remained, all on Papa-Alpha product pages:
  - `/products/pa-28-32-34-44-aileron-and-flap-rigging-tool-1`
  - `/products/bell-crank-rigging-tool`
  - `/products/rigging-kit`
  - `/products/rudder-rigging-tool`
  - `/products/stabilator-rigging-tool`

Interpretation: catalog technical hygiene is much better than the original risk framing implied. The product-index question is now a demand and uniqueness decision to make from Search Console data, not an emergency technical cleanup. Do not prune or noindex solely because the catalog is large.

## Decision Rules

Keep indexed:

- Products with impressions/clicks in GSC.
- Papa-Alpha tools and other RWAS-owned products.
- High-margin products that support installation/service intent.
- Products with unique descriptions, clean images, Product schema, and internal links.

Improve before keeping:

- Garmin SKU pages with impressions but weak CTR.
- Pages with thin descriptions but strategic commercial value.
- Pages that should link into service pages such as Garmin installation, ADS-B, GFC 500, or G3X Touch.

Noindex or remove from sitemap:

- Products with zero GSC impressions over 90 days and no strategic reason to keep.
- Duplicate accessory variants where one collection or parent page is the better landing page.
- Pages relying on placeholder imagery and generic manufacturer copy.

Do not noindex blindly. A low-traffic SKU page that quietly brings one qualified avionics lead can be more valuable than a high-traffic blog post.
