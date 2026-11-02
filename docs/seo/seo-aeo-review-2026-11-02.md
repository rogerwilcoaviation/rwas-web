# RWAS SEO and answer-engine review — November 2, 2026

## Evidence collected

- The live SEO smoke check passed 1,899 sitemap URLs.
- Search Console's page export for October 4–31 recorded 478 clicks and 16,499 impressions. Products accounted for 301 clicks and 8,133 impressions; blog pages accounted for 54 clicks and 5,682 impressions. Search Console totals can differ across dimensions because of privacy filtering.
- The site's robots file allows OAI-SearchBot and PerplexityBot. It separately disallows Google-Extended; this is a training/data policy choice and was preserved. Google Search's [AI features guidance](https://developers.google.com/search/docs/appearance/ai-features) explains that standard search practices remain relevant; allowing a crawler or publishing structured data does not guarantee inclusion in AI answers.
- The existing service FAQ is both visible and emitted as FAQPage structured data. The site explicitly states that RWAS does not perform pre-buy inspections or vet aircraft, but that distinction was not included in the service FAQ.

## Changes

- Added the pre-buy question and a direct, policy-consistent answer to the shared service FAQ, keeping visible content and JSON-LD aligned. The seven previously approved answers remain unchanged.
- Clarified that the AI discovery file describes independent pre-buy facility recommendations, and corrected its Papa-Alpha collection description.
- Removed an unverified 24/7 availability claim for the website assistant from the AI discovery file.

## Remaining assessment

The current review includes the repository's production SEO smoke crawl, Search Console page groups, targeted public search and answer-content checks, and the changes above. It does not include a fresh full link-graph crawl, Core Web Vitals field data, an external backlink inventory, or independent prompt tests across ChatGPT, Gemini, Claude, and Perplexity. No cross-platform AI visibility score or ranking improvement is claimed. External directory corrections remain subject to account access. The earlier detailed audit is in `docs/seo/seo-audit-2026-10-23.md`.
