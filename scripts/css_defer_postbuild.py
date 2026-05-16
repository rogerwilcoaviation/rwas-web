#!/usr/bin/env python3
"""
Post-build CSS deferral for rwas-web.

Strategy: identify the broadsheet CSS bundle in the build output (the one
containing the @import for Google Fonts — that's the broadsheet-tokens.css
+ broadsheet-chrome.css + newspaper.css merge). Convert its <link
rel=stylesheet> tag in every HTML page to use the media=print swap trick:

    <link rel="stylesheet" href="..." media="print" onload="this.media='all';this.onload=null">
    <noscript><link rel="stylesheet" href="..."></noscript>

The browser downloads the stylesheet but treats it as a print-only sheet
(non-render-blocking) until the onload event swaps media to 'all'. After
that point the styles apply and the page repaints.

Tailwind (148KB) is the LARGEST CSS file and is needed for above-the-fold
layout — keep it sync. The broadsheet bundle (~60KB) is largely below-fold
typography/figure styling, safe to defer.

Also inlines a minimal critical-CSS skeleton in the <head> to prevent the
worst of the FOUC: background color, font-family stack, layout container.

Usage: run after `next build` against the `out/` directory.
"""
import re, os, sys
from pathlib import Path

OUT = Path(os.environ.get("OUT_DIR", "out")).resolve()
CSS_DIR = OUT / "_next/static/css"

# Step 1: identify the broadsheet CSS file (contains Google Fonts @import)
BROADSHEET_MARKER = '@import url("https://fonts.googleapis.com'
broadsheet_filename = None
for css in sorted(CSS_DIR.glob("*.css")):
    head = css.read_text(errors="replace")[:300]
    size_kb = css.stat().st_size // 1024
    if BROADSHEET_MARKER in head:
        broadsheet_filename = css.name
        print(f"  identified broadsheet bundle: {css.name} ({size_kb} KB)")
    else:
        print(f"  keeping sync: {css.name} ({size_kb} KB)")

if not broadsheet_filename:
    print("ERROR: could not identify broadsheet CSS bundle")
    sys.exit(1)

broadsheet_url = f"/_next/static/css/{broadsheet_filename}"

# Step 2: minimal critical CSS skeleton — prevents the brutal FOUC.
# Newspaper background, base font stack, layout container.
SKELETON = """<style data-rwas-skeleton>html{background:#f3eada;color:#1a1612;font-family:'Source Serif 4',Georgia,serif;font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased}body{margin:0;background:#f3eada;min-height:100vh}.broadsheet{max-width:1280px;margin:0 auto;padding:clamp(16px,3vw,32px)}h1,h2,h3{font-family:'Playfair Display',Georgia,serif;margin:0}.bs-headline{font-family:'Playfair Display',Georgia,serif;font-weight:900;line-height:1.1}.bs-kicker{font-family:'Inter',system-ui,sans-serif;text-transform:uppercase;letter-spacing:.22em;font-size:.75rem;font-weight:600}img{max-width:100%;height:auto;display:block}</style>"""

# Step 3: rewrite each HTML page
def defer_link(html: str) -> tuple[str, bool]:
    """Find the broadsheet stylesheet link, replace with deferred version."""
    # Match: <link rel="stylesheet" href="/_next/static/css/<bundlefile>.css" [attrs]/>
    pattern = (
        r'<link\s+rel="stylesheet"\s+href="'
        + re.escape(broadsheet_url)
        + r'"([^>]*)/?>'
    )
    new_link = (
        f'<link rel="stylesheet" href="{broadsheet_url}" media="print" '
        f'onload="this.media=\'all\';this.onload=null" />'
        f'<noscript><link rel="stylesheet" href="{broadsheet_url}" /></noscript>'
    )
    new_html, n = re.subn(pattern, new_link, html, count=1)
    return new_html, n > 0

def inject_skeleton(html: str) -> tuple[str, bool]:
    """Insert skeleton CSS just before </head>, before any other stylesheets."""
    if "data-rwas-skeleton" in html:
        return html, False  # already injected
    # Insert before first <link rel="stylesheet"> to ensure skeleton paints first
    m = re.search(r'<link\s+rel="stylesheet"', html)
    if m:
        idx = m.start()
        return html[:idx] + SKELETON + html[idx:], True
    return html, False

print(f"\n  rewriting {broadsheet_url} → media=print swap in HTML files...")
patched = 0
no_match = 0
for html_file in OUT.rglob("*.html"):
    src = html_file.read_text(errors="replace")
    new_src, link_changed = defer_link(src)
    new_src, skel_added = inject_skeleton(new_src)
    if link_changed or skel_added:
        html_file.write_text(new_src)
        patched += 1
    else:
        no_match += 1

print(f"  patched {patched} HTML files, {no_match} skipped (no broadsheet link match)")
