# RWAS SEO and answer-engine review — November 2, 2026

## Evidence collected

- The live SEO smoke check passed 1,899 sitemap URLs.
- A separate fetch of all 1,899 sitemap pages found zero non-200 responses, missing titles or descriptions, duplicate titles or descriptions, missing or multiple H1s, skipped heading levels, invalid JSON-LD, missing Open Graph images, or noindex directives.
- Search Console's page export for October 4–31 recorded 478 clicks and 16,499 impressions. Products accounted for 301 clicks and 8,133 impressions; blog pages accounted for 54 clicks and 5,682 impressions. Search Console totals can differ across dimensions because of privacy filtering.
- A mobile PageSpeed Insights homepage sample scored 90 for performance, with 3.53-second lab LCP and 0.052 CLS. The API returned no URL-level or origin-level field metrics, so this is not a field Core Web Vitals assessment.
- The site's robots file allows OAI-SearchBot and PerplexityBot. It separately disallows Google-Extended; this is a training/data policy choice and was preserved. Google Search's [AI features guidance](https://developers.google.com/search/docs/appearance/ai-features) explains that standard search practices remain relevant; allowing a crawler or publishing structured data does not guarantee inclusion in AI answers.
- Test requests using Googlebot, Bingbot, OAI-SearchBot, GPTBot, PerplexityBot, and ClaudeBot user-agent strings received HTTP 200 and recognizable homepage content. User-agent spoofing is a limited diagnostic and does not prove verified crawler access, indexing, or citations.
- The existing service FAQ is both visible and emitted as FAQPage structured data. The site explicitly states that RWAS does not perform pre-buy inspections or vet aircraft, but that distinction was not included in the service FAQ.

## Changes

- Added the pre-buy question and a direct, policy-consistent answer to the shared service FAQ, keeping visible content and JSON-LD aligned. The seven previously approved answers remain unchanged.
- Clarified that the AI discovery file describes independent pre-buy facility recommendations, and corrected its Papa-Alpha collection description.
- Removed an unverified 24/7 availability claim for the website assistant from the AI discovery file.
- Verified the visible FAQ answer, matching FAQPage JSON-LD, and updated `llms.txt` on the live site. Local lint, the approved-FAQ regression, SEO regressions, Cloudflare build, and 1,899-URL SEO artifact check passed. The [production deployment workflow](https://github.com/rogerwilcoaviation/rwas-web/actions/runs/41549581068) passed.

## Remaining assessment

### Follow-up: November 2, 2026

Four public web searches were run for a Yankton avionics shop, GFC 500 installation in South Dakota, Piper rigging tools, and Roger Wilco reviews. The results included RWAS's location and Papa-Alpha pages. These are ordinary search results; they are not measurements of AI-generated answers and their placement must not be interpreted as AI recommendation ranking.

Independent sources found in this targeted sample include [Aircraft Spruce's Papa-Alpha kit listing](https://www.aircraftspruce.com/catalog/topages/rw-rigging-tool-kits.php), [Electronics International's dealer directory](https://iflyei.com/dealers/), and [Yankton city records](https://www.cityofyankton.org/home/showpublisheddocument/10255/637874236751400000). These establish independently discoverable mentions, not a complete backlink inventory or evidence that any particular assistant cites them.

Citation consistency remains an issue: [AEA](https://aea.net/memberdetails.asp?ID=3310) lists 700 E. 31st Street and airport KFSD, while [Insight Avionics](https://www.insightavionics.com/Dealers/dealers%20us.htm) lists that old address and an older phone number. The [RWAS location page](https://www.rogerwilcoaviation.com/locations/yankton) identifies 3309 Douglas Avenue Unit #3, Yankton, SD 57078 and KYKN. Authorized directory account holders should correct and verify those records; historical government documents should not be altered.

Some search-engine cached results still describe pre-buy support on the location page. The current live page and current source were checked separately and no longer contain that wording. The cached result may persist until recrawled; do not treat it as proof that the current page offers pre-buy inspections.

Direct independent prompt tests across ChatGPT, Gemini, Claude, and Perplexity could not be completed: browser use is disabled in Work settings and no connected answer-engine tools were available. An external backlink inventory and real-user Core Web Vitals also remain unavailable. No cross-platform AI visibility score or ranking improvement is claimed. Enable browser access or supply an authorized answer-engine research connector to finish the prompt tests. External directory corrections remain subject to account access. The earlier detailed audit is in `docs/seo/seo-audit-2026-10-23.md`.
