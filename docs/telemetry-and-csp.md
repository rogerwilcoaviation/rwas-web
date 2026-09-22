# First-party metrics and CSP staging

## RUM provenance

`public/rwas-analytics.js` loads a first-party ESM bundle built from pinned `web-vitals` 6.2.2 by `scripts/build-analytics.mjs`. The library owns CLS session windows, INP interactions, hidden-page flush and bfcache reset. Unsupported APIs yield no metric rather than a fabricated zero. The wire format retains `metric`, `value` and `rating`, and adds `metricId`, `navigationType` and `measurementSource`.

These are browser field observations, not CrUX or Lighthouse scores. Synthetic fixture output is lab/test evidence only. When aggregating, retain the last observation per metricId and metric (visibility changes may emit again), separate navigation types/device classes, then calculate the 75th percentile over page-visit values—not a percentile of beacons and not an average of daily percentiles. No percentile dashboard or production field-performance claim is introduced by this change. An inferred cart-control click is `cart_open`, never evidence that a cart mutation succeeded.

Current advanced-mode route injection logs RUM to Cloudflare runtime logs; it is not a durable analytics database. Source inspection alone does not establish enabled logging, retention, deletion or sampling in production. Existing session identifier and referrer processing is unchanged. No metric DOM entries or LCP resource URLs are added to collection.

## CSP stage

The final build step enumerates exported HTML and computes SHA-256 hashes of each exact inline script body, including Next bootstrap and structured data. An advanced-mode Worker wrapper attaches a per-document `Content-Security-Policy-Report-Only` response header. This avoids Pages `_headers` limits (100 rules / 2,000 characters per line) and its lack of coverage for Function-generated responses. Existing enforcing policy is unchanged. API responses and embedded Work Order System routes are not changed.

No reporting endpoint or outside service is introduced. Violations appear in browser developer tools; there is no claim of remote violation collection. This is a compatibility observation stage, not completed strict enforcement. Before enforcement, inspect browser violations on all templates and third-party integrations, including navigation, chat, checkout UI, upload and bfcache behavior under separately authorized test fixtures. Do not delete the old enforcement policy merely because this build passes. Cloudflare challenge scripts added after export may produce report-only violations and require separate review.

## Release checks

Successful production deploys on `main`, whether push or workflow_dispatch, run `production-readonly-smoke.mjs`. It uses GET requests for documents, a referenced JavaScript asset, robots, sitemap, analytics and a deliberate missing route. It checks status, canonical and security headers. It does not call chat/intake, create carts, submit contacts/listings or exercise payments. Local mocked commerce gates remain in place. Passing this smoke proves sampled public availability only, not delivery/payment success.
