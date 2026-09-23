#!/usr/bin/env python3
"""RWAS monthly Search Console digest.

Compares the newest 28-day GSC baseline in logs/gsc-baseline/ with the most
recent earlier window that does not overlap it, and writes a one-page
Markdown digest to logs/gsc-digest/<end-date>.md. Designed to run from launchd
every Monday after the weekly pull; it only does work on the third Monday of
the month unless FORCE=1 is set.

Automated exact-quote lookups (queries wrapped in quotes or longer than 80
characters) are reported separately and excluded from the human totals.
"""
import json, os, re, subprocess, sys
from datetime import date, datetime

REPO = os.environ.get("RWAS_WEB_DIR", os.path.expanduser("~/projects/rwas-web"))
BASE = os.path.join(REPO, "logs", "gsc-baseline")
OUT = os.path.join(REPO, "logs", "gsc-digest")
SITE = "https://www.rogerwilcoaviation.com"
BRAND = re.compile(r"roger wilco|rwas|wilco aviation")
TRACKED_PAGES = [
    "/blog/repair-station-vs-ap-mechanic-what-aircraft-owners-should-know-20260414",
    "/blog/mandatory-service-bulletins-are-they-really-mandatory-20260415",
    "/", "/garmin", "/shop-capabilities", "/panel-planner", "/services",
]
TARGET_QUERIES = [
    "part 145 repair station", "what is a part 145 repair station", "145 repair station",
    "faa repair station", "faa part 145 repair station", "are service bulletins mandatory",
    "service bulletins", "faa service bulletins", "garmin avionics installation",
    "garmin avionics dealer", "gfc 500 installation", "g3x touch installation",
]

def third_monday(d):
    return d.weekday() == 0 and 15 <= d.day <= 21

def windows():
    out = []
    for name in os.listdir(BASE):
        m = re.fullmatch(r"(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})", name)
        if m:
            out.append((date.fromisoformat(m[1]), date.fromisoformat(m[2]), name))
    return sorted(out, key=lambda w: w[1])

def rows(win, name):
    path = os.path.join(BASE, win, f"{name}.json")
    if not os.path.exists(path):
        return []
    data = json.load(open(path))
    return data if isinstance(data, list) else data.get("rows", [])

def is_quote_lookup(q):
    return '"' in q or len(q) > 80

def totals(qrows):
    human = [r for r in qrows if not is_quote_lookup(r["query"])]
    nb = [r for r in human if not BRAND.search(r["query"])]
    s = lambda rs, k: sum(r[k] for r in rs)
    return {
        "human_imp": s(human, "impressions"), "human_clk": s(human, "clicks"),
        "nonbrand_imp": s(nb, "impressions"), "nonbrand_clk": s(nb, "clicks"),
        "quote_imp": s(qrows, "impressions") - s(human, "impressions"),
    }

def fmt_delta(new, old, lower_is_better=False, pct=False):
    if old is None:
        return "new"
    diff = new - old
    if abs(diff) < 1e-9:
        return "="
    good = diff < 0 if lower_is_better else diff > 0
    arrow = "▲" if good else "▼"
    return f"{arrow} {diff:+.1f}" if isinstance(diff, float) else f"{arrow} {diff:+d}"

def main():
    today = date.today()
    if not third_monday(today) and os.environ.get("FORCE") != "1":
        print("not third Monday; skipping"); return
    ws = windows()
    if not ws:
        print("no baselines"); return
    cur = ws[-1]
    prior = [w for w in ws if w[1] < cur[0]]
    prev = prior[-1] if prior else None
    cq, pq = rows(cur[2], "queries"), rows(prev[2], "queries") if prev else []
    norm = lambda u: u.replace(SITE, "").rstrip("/") or "/"
    cp = {norm(r["page"]): r for r in rows(cur[2], "pages")}
    pp = {norm(r["page"]): r for r in rows(prev[2], "pages")} if prev else {}
    ct, pt = totals(cq), totals(pq) if prev else None
    L = [f"# RWAS Search Console digest — {cur[0]} to {cur[1]}",
         f"Compared with {prev[0]} to {prev[1]}" if prev else "No earlier window to compare.", ""]
    L.append("## Totals (human searches)")
    for k, label in [("human_imp", "Impressions"), ("human_clk", "Clicks"),
                     ("nonbrand_imp", "Non-brand impressions"), ("nonbrand_clk", "Non-brand clicks")]:
        L.append(f"- {label}: {ct[k]:,} ({fmt_delta(ct[k], pt[k] if pt else None)})")
    L.append(f"- Automated exact-quote lookups excluded: {ct['quote_imp']:,} impressions")
    L += ["", "## Tracked pages", "| Page | Impr | Clicks | Pos | Pos change |", "|---|---|---|---|---|"]
    pages = TRACKED_PAGES + sorted(p for p in cp if p.startswith("/services/"))
    for p in pages:
        r = cp.get(p)
        if not r:
            L.append(f"| {p} | 0 | 0 | – | – |"); continue
        o = pp.get(p)
        L.append(f"| {p} | {r['impressions']} | {r['clicks']} | {r['position']:.1f} | "
                 f"{fmt_delta(r['position'], o['position'] if o else None, lower_is_better=True)} |")
    qi = {r["query"]: r for r in cq}; qo = {r["query"]: r for r in pq}
    L += ["", "## Target queries", "| Query | Impr | Clicks | Pos | Pos change |", "|---|---|---|---|---|"]
    for q in TARGET_QUERIES:
        r = qi.get(q)
        if not r:
            L.append(f"| {q} | 0 | 0 | – | – |"); continue
        o = qo.get(q)
        L.append(f"| {q} | {r['impressions']} | {r['clicks']} | {r['position']:.1f} | "
                 f"{fmt_delta(r['position'], o['position'] if o else None, lower_is_better=True)} |")
    sd = [r for r in cq if not is_quote_lookup(r["query"]) and not BRAND.search(r["query"])
          and 4 <= r["position"] <= 20 and r["impressions"] >= 10]
    L += ["", "## Striking distance (positions 4–20, 10+ impressions)"]
    for r in sorted(sd, key=lambda r: -r["impressions"])[:12]:
        L.append(f"- {r['query']} — {r['impressions']} impr, pos {r['position']:.1f}")
    L += ["", "## Review checklist",
          "- Count quote emails in service@rwas.team this window by subject tag `[src:...]`.",
          "- Pick 1–2 striking-distance pages to improve.",
          "- Note anything that dropped more than 5 positions."]
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"{cur[1]}.md")
    open(path, "w").write("\n".join(L) + "\n")
    print(path)
    notify = os.path.expanduser("~/projects/jerry-http-relay/bin/notify-jerry")
    if os.path.exists(notify) and os.environ.get("NO_NOTIFY") != "1":
        subprocess.run([notify, "-s", f"RWAS SEO digest {cur[1]}", "-f", path,
                        "-k", f"gsc-digest-{int(datetime.now().timestamp())}"], check=False)

if __name__ == "__main__":
    sys.exit(main())
