#!/usr/bin/env python3
"""
sitemap_health_check.py — Sitemap integrity check for rogerwilcoaviation.com.

Fetches https://www.rogerwilcoaviation.com/sitemap.xml and tests every URL for:
  - HTTP status (expect 200)
  - Redirect count (expect 0 — sitemap URLs should be canonical)
  - Response time

Writes a dated log and posts a summary to Teams chat 48:notes.
Defaults: silent on all-clean. Posts alerts whenever ANY URL redirects or fails.
Use --always for a weekly heartbeat post confirming the check is alive.

Usage:
  python3 sitemap_health_check.py             # check; post only on issues
  python3 sitemap_health_check.py --always    # check; always post (weekly cadence)
  python3 sitemap_health_check.py --dry-run   # check; print summary; no Teams post
"""
import argparse
import re
import subprocess
import sys
import time
import urllib.request
from datetime import datetime
from pathlib import Path

SITEMAP_URL = "https://www.rogerwilcoaviation.com/sitemap.xml"
TEAMS_SCRIPT = Path.home() / ".openclaw/workspace/skills/teams/scripts/teams.py"
TARGET_CHAT = "48:notes"  # Jerry notes chat → John
LOG_DIR = Path.home() / "projects/rwas-web/logs/sitemap-health"
UA = "RWAS-HealthCheck/1.0"
TIMEOUT = 15


def fetch_sitemap():
    req = urllib.request.Request(SITEMAP_URL, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return r.read().decode("utf-8")


def extract_urls(xml):
    return re.findall(r"<loc>([^<]+)</loc>", xml)


def check_url(url):
    """Returns (final_url, status, redirect_count, elapsed_ms, error|None)."""
    start = time.time()
    try:
        r = subprocess.run(
            ["curl", "-sIL", "-o", "/dev/null",
             "-w", "%{http_code}|%{num_redirects}|%{url_effective}",
             "--max-time", str(TIMEOUT), "-A", UA, url],
            capture_output=True, text=True, timeout=TIMEOUT + 5
        )
        ms = int((time.time() - start) * 1000)
        if r.returncode != 0:
            return (url, 0, 0, ms, f"curl exit {r.returncode}")
        parts = r.stdout.strip().split("|")
        if len(parts) != 3:
            return (url, 0, 0, ms, f"bad curl output: {r.stdout!r}")
        return (parts[2], int(parts[0]), int(parts[1]), ms, None)
    except Exception as e:
        return (url, 0, 0, int((time.time() - start) * 1000), str(e))


def classify(results):
    clean, redirects, broken = [], [], []
    for src, (final, code, rc, ms, err) in results:
        if err or code == 0 or code >= 400:
            broken.append((src, final, code, rc, ms, err))
        elif code != 200 or rc > 0:
            redirects.append((src, final, code, rc, ms, err))
        else:
            clean.append((src, final, code, rc, ms, err))
    return clean, redirects, broken


def build_summary(total, clean, redirects, broken):
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    if broken:
        status = "❌ BROKEN"
    elif redirects:
        status = "⚠️ REDIRECTS"
    else:
        status = "✅ CLEAN"
    lines = [
        f"**RWAS Sitemap Health — {now}**",
        f"{status}  ·  {len(clean)}/{total} URLs direct 200",
        "",
    ]
    if broken:
        lines.append(f"**Broken ({len(broken)}):**")
        for src, final, code, rc, ms, err in broken:
            msg = err if err else f"HTTP {code}"
            lines.append(f"- {src} → {msg}")
        lines.append("")
    if redirects:
        lines.append(f"**Redirects ({len(redirects)}):**")
        for src, final, code, rc, ms, _ in redirects:
            lines.append(f"- {src} → {final} ({rc} hop{'s' if rc != 1 else ''})")
        lines.append("")
    if not broken and not redirects:
        lines.append(f"All {total} sitemap URLs return direct 200. No action needed.")
    return "\n".join(lines)


def write_log(summary, results):
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    log = LOG_DIR / (datetime.now().strftime("%Y-%m-%d") + ".log")
    with log.open("a") as f:
        f.write(f"\n===== {datetime.now().isoformat()} =====\n")
        f.write(summary + "\n\nFull results:\n")
        for src, (final, code, rc, ms, err) in results:
            suffix = f" ERROR: {err}" if err else ""
            f.write(f"  {code} redirects={rc} {ms}ms {src} → {final}{suffix}\n")
    return log


def post_to_teams(text):
    try:
        r = subprocess.run(
            ["python3", str(TEAMS_SCRIPT), "chat-send", TARGET_CHAT, text],
            capture_output=True, text=True, timeout=30
        )
        return r.returncode == 0, (r.stdout + r.stderr).strip()
    except Exception as e:
        return False, str(e)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--always", action="store_true",
                    help="Post to Teams even when all clean (use for weekly heartbeat)")
    ap.add_argument("--dry-run", action="store_true",
                    help="Print summary, don't post")
    args = ap.parse_args()

    xml = fetch_sitemap()
    urls = extract_urls(xml)
    results = [(u, check_url(u)) for u in urls]
    clean, redirects, broken = classify(results)
    summary = build_summary(len(urls), clean, redirects, broken)
    log = write_log(summary, results)

    print(summary)
    print(f"\nLog: {log}")

    has_issues = bool(redirects or broken)
    if args.dry_run:
        print("(--dry-run: no post)")
        return 1 if has_issues else 0

    if has_issues or args.always:
        ok, out = post_to_teams(summary)
        print(f"\nTeams post: {'OK' if ok else 'FAILED'}")
        if not ok:
            print(out)
    else:
        print("\nNo issues. Silent (use --always for heartbeat).")

    return 1 if has_issues else 0


if __name__ == "__main__":
    sys.exit(main())
