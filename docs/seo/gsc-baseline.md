# Search Console Baseline

Purpose: export the data needed before making catalog-pruning or content-expansion decisions.

## Run

The script expects an OAuth access token with Search Console access for:

`https://www.rogerwilcoaviation.com/`

```bash
GSC_ACCESS_TOKEN="ya29..." npm run seo:gsc-baseline
```

Optional controls:

```bash
GSC_DAYS=90 GSC_OUTPUT_DIR=logs/gsc-baseline npm run seo:gsc-baseline
```

Outputs are written under:

`logs/gsc-baseline/YYYY-MM-DD_YYYY-MM-DD/`

Files:

- `queries.csv` and `queries.json`
- `pages.csv` and `pages.json`
- `query-pages.csv` and `query-pages.json`
- `countries.csv` and `countries.json`
- `devices.csv` and `devices.json`
- `manifest.json`

## Decisions To Make From The Export

1. Queries with high impressions, low CTR, and positions 4-15 become title/meta/content tune candidates.
2. Pages with impressions but poor CTR need SERP snippet work or stronger internal links.
3. Product pages with zero impressions over 90 days become prune/noindex candidates unless they serve a business reason.
4. Service/location queries with impressions on the wrong page become new internal-link or landing-page candidates.
5. Branded queries should be separated from non-branded commercial queries before judging acquisition performance.

## Why This Exists

Technical SEO is now mostly in maintenance mode. Search Console query data is the next gate so RWAS does not prune useful product URLs or write pages for queries that nobody searches.
