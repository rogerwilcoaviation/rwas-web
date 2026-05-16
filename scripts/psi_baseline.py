#!/usr/bin/env python3
"""
Core Web Vitals baseline for RWAS — uses ~/.openclaw/workspace/secrets/psi_api_key.

Pulls mobile + desktop scores for one representative URL of each page type
on the site (homepage, blog index, blog article, collection index, collection
detail, product, garmin landing, about) so we have a starting point to
measure regressions against in the weekly health check.
"""
import json, urllib.request, urllib.parse, time, sys
from pathlib import Path

KEY_PATH = Path.home() / ".openclaw/workspace/secrets/psi_api_key"
if not KEY_PATH.exists():
    print(f"FATAL: key not found at {KEY_PATH}"); sys.exit(1)
API_KEY = KEY_PATH.read_text().strip()

TARGETS = [
    ("/",                                                                            "homepage"),
    ("/about",                                                                       "about"),
    ("/shop-capabilities",                                                           "shop-capabilities"),
    ("/garmin/",                                                                     "garmin-landing"),
    ("/blog",                                                                        "blog-index"),
    ("/blog/mandatory-service-bulletins-are-they-really-mandatory-20260415",         "blog-article"),
    ("/collections",                                                                 "collection-index"),
    ("/collections/garmin-dealer-install",                                           "collection-detail"),
    ("/products/rigging-kit",                                                        "product-papa-alpha"),
    ("/products/gtn750xi",                                                           "product-garmin"),
    ("/aircraft-for-sale",                                                           "aircraft-for-sale"),
]

def psi(url, strategy):
    qs = urllib.parse.urlencode({
        "url": f"https://www.rogerwilcoaviation.com{url}",
        "strategy": strategy,
        "key": API_KEY,
        "category": "performance",
    })
    full = f"https://www.googleapis.com/pagespeedonline/v5/runPagespeed?{qs}"
    return json.loads(urllib.request.urlopen(full, timeout=120).read())

def extract(r):
    lh = r["lighthouseResult"]
    perf = lh["categories"]["performance"]["score"]
    a = lh["audits"]
    return {
        "score":  int(perf * 100) if perf is not None else None,
        "lcp_s":  a["largest-contentful-paint"]["numericValue"] / 1000,
        "fcp_s":  a["first-contentful-paint"]["numericValue"] / 1000,
        "cls":    a["cumulative-layout-shift"]["numericValue"],
        "tbt_ms": a["total-blocking-time"]["numericValue"],
        "si_s":   a["speed-index"]["numericValue"] / 1000,
    }

def fmt(m):
    return f"{m['score']:3d}/100  LCP={m['lcp_s']:.1f}s  FCP={m['fcp_s']:.1f}s  CLS={m['cls']:.3f}  TBT={m['tbt_ms']:.0f}ms  SI={m['si_s']:.1f}s"

results = {"_meta": {"timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}}
print(f"PSI baseline — {results['_meta']['timestamp']}\n")
print(f"{'PAGE TYPE':<22} {'STRATEGY':<8} {'METRICS'}")
print("─" * 110)

for path, label in TARGETS:
    results[label] = {"path": path}
    for strategy in ("mobile", "desktop"):
        try:
            r = psi(path, strategy)
            m = extract(r)
            results[label][strategy] = m
            print(f"{label:<22} {strategy:<8} {fmt(m)}")
        except Exception as e:
            err = f"{type(e).__name__}: {str(e)[:80]}"
            results[label][strategy] = {"error": err}
            print(f"{label:<22} {strategy:<8} ERROR: {err}")
        time.sleep(2)

out = Path.home() / "projects/rwas-web/logs/psi-baseline" / f"baseline_{time.strftime('%Y-%m-%d')}.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(results, indent=2))
print(f"\nBaseline written to {out}")

# Threshold summary
mobile_scores = [v["mobile"]["score"] for k, v in results.items() if k != "_meta" and "score" in v.get("mobile", {})]
desktop_scores = [v["desktop"]["score"] for k, v in results.items() if k != "_meta" and "score" in v.get("desktop", {})]
if mobile_scores:
    print(f"\nMobile  : avg {sum(mobile_scores)/len(mobile_scores):.0f}, min {min(mobile_scores)}, max {max(mobile_scores)}")
if desktop_scores:
    print(f"Desktop : avg {sum(desktop_scores)/len(desktop_scores):.0f}, min {min(desktop_scores)}, max {max(desktop_scores)}")
