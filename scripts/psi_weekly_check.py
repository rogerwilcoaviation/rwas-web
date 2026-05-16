#!/usr/bin/env python3
"""
psi_weekly_check.py — Core Web Vitals regression check for rogerwilcoaviation.com.

Pulls mobile PSI scores for 3 representative URLs (homepage, top blog, top
product). Compares against thresholds and against the most recent baseline.
Posts to Teams when scores drop below threshold OR drop more than 10 points
versus the last run. Defaults to silent on healthy.

Usage:
  python3 psi_weekly_check.py             # check; post only on regression
  python3 psi_weekly_check.py --always    # post heartbeat regardless
  python3 psi_weekly_check.py --dry-run   # print, no Teams
"""
import argparse, json, os, sys, time, urllib.parse, urllib.request
from datetime import datetime
from pathlib import Path
import subprocess

KEY_PATH    = Path.home() / ".openclaw/workspace/secrets/psi_api_key"
TEAMS_SCRIPT = Path.home() / ".openclaw/workspace/skills/teams/scripts/teams.py"
TARGET_CHAT  = "48:notes"
LOG_DIR      = Path.home() / "projects/rwas-web/logs/psi-weekly"
BASELINE_DIR = Path.home() / "projects/rwas-web/logs/psi-baseline"

# Three URLs, one per page type. Mobile only — that's what Google ranks on.
TARGETS = [
    ("homepage",     "/"),
    ("blog-article", "/blog/mandatory-service-bulletins-are-they-really-mandatory-20260415"),
    ("product",      "/products/rigging-kit"),
]

# Score below this = alert
SCORE_FLOOR = 50
# Drop more than this vs prior run = alert
SCORE_DROP_THRESHOLD = 10
# LCP above this = alert (Google "poor" threshold)
LCP_CEILING_S = 4.0
# CLS above this = alert
CLS_CEILING = 0.25


def fetch_psi(url, api_key):
    qs = urllib.parse.urlencode({
        "url": url,
        "strategy": "mobile",
        "key": api_key,
        "category": "performance",
    })
    full = f"https://www.googleapis.com/pagespeedonline/v5/runPagespeed?{qs}"
    with urllib.request.urlopen(full, timeout=120) as r:
        return json.loads(r.read())


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


def latest_baseline():
    """Find the most recent baseline JSON for this label set."""
    if not BASELINE_DIR.exists():
        return None
    files = sorted(BASELINE_DIR.glob("baseline_*.json"))
    if not files:
        return None
    return json.loads(files[-1].read_text())


def find_prior_metric(baseline, label):
    if not baseline:
        return None
    entry = baseline.get(label, {})
    return entry.get("mobile") if isinstance(entry.get("mobile"), dict) and "score" in entry.get("mobile", {}) else None


def classify(label, current, prior):
    """Returns list of alert strings, empty if clean."""
    alerts = []
    if current["score"] is not None and current["score"] < SCORE_FLOOR:
        alerts.append(f"score {current['score']} < {SCORE_FLOOR}")
    if current["lcp_s"] > LCP_CEILING_S:
        alerts.append(f"LCP {current['lcp_s']:.1f}s > {LCP_CEILING_S}s")
    if current["cls"] > CLS_CEILING:
        alerts.append(f"CLS {current['cls']:.2f} > {CLS_CEILING}")
    if prior and current["score"] is not None and prior.get("score") is not None:
        drop = prior["score"] - current["score"]
        if drop > SCORE_DROP_THRESHOLD:
            alerts.append(f"score dropped {drop} pts (was {prior['score']}, now {current['score']})")
    return alerts


def post_teams(message, dry_run=False):
    if dry_run:
        print(f"\n[DRY RUN — would post to Teams {TARGET_CHAT}]\n{message}")
        return
    try:
        subprocess.run(
            ["python3", str(TEAMS_SCRIPT), "chat-send", "--chat-id", TARGET_CHAT, "--text", message],
            check=True, capture_output=True, text=True, timeout=30,
        )
    except subprocess.CalledProcessError as e:
        print(f"Teams post failed: {e.stderr}", file=sys.stderr)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--always", action="store_true", help="Post even when healthy")
    ap.add_argument("--dry-run", action="store_true", help="Print Teams message instead of posting")
    args = ap.parse_args()

    if not KEY_PATH.exists():
        print(f"FATAL: PSI API key not found at {KEY_PATH}", file=sys.stderr)
        sys.exit(2)
    api_key = KEY_PATH.read_text().strip()

    baseline = latest_baseline()
    now = datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
    results = {"_meta": {"timestamp": now}}
    all_alerts = []
    summary_lines = []

    for label, path in TARGETS:
        url = f"https://www.rogerwilcoaviation.com{path}"
        try:
            psi_response = fetch_psi(url, api_key)
            metrics = extract(psi_response)
        except Exception as e:
            results[label] = {"error": f"{type(e).__name__}: {e}"}
            all_alerts.append(f"{label}: PSI API error — {e}")
            summary_lines.append(f"{label:<14} ERROR: {e}")
            continue
        results[label] = {"path": path, "mobile": metrics}
        prior = find_prior_metric(baseline, label)
        alerts = classify(label, metrics, prior)
        score = metrics["score"]
        prior_score = prior.get("score") if prior else None
        delta = f"  (was {prior_score})" if prior_score is not None and prior_score != score else ""
        line = f"{label:<14} {score:3d}/100{delta}  LCP={metrics['lcp_s']:.1f}s  CLS={metrics['cls']:.3f}"
        if alerts:
            line += "  ⚠️ " + "; ".join(alerts)
            all_alerts.extend([f"{label}: {a}" for a in alerts])
        summary_lines.append(line)
        time.sleep(2)

    LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_path = LOG_DIR / f"psi_{datetime.now().strftime('%Y-%m-%d')}.json"
    log_path.write_text(json.dumps(results, indent=2))

    print(f"PSI weekly check — {now}")
    print("\n".join(summary_lines))
    print(f"\nLog: {log_path}")

    should_post = args.always or all_alerts
    if should_post:
        emoji = "⚠️" if all_alerts else "✅"
        msg = f"{emoji} **RWAS PSI weekly check** — {now}\n```\n" + "\n".join(summary_lines) + "\n```"
        if all_alerts:
            msg += "\n**Alerts:**\n• " + "\n• ".join(all_alerts)
        post_teams(msg, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
