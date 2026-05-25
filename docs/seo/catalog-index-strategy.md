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
