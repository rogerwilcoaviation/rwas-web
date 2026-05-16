#!/usr/bin/env python3
"""
Post-build CSS deferral for rwas-web.

Two stylesheets are deferred via the media=print swap pattern:

  1. Broadsheet bundle (~56KB): identified by the `--font-display:` token from
     broadsheet-tokens.css. Below-fold typography/figure styling, safe to defer.

  2. Tailwind bundle (~144KB): identified by the `--tw-border-spacing-x:` token
     from Tailwind preflight. Render-blocking critical CSS for above-the-fold
     layout is EXTRACTED from this bundle at build time and inlined in <head>
     to prevent FOUC. The rest defers.

Critical CSS extraction:
  - Everything from byte 0 to the first .container{ selector (~11.5KB of
    preflight + global resets + html/body/headings/forms + :root vars + .dark
    vars) — these MUST be applied before first paint.
  - Plus targeted rules for ~35 universal Tailwind utility classes used
    above-the-fold across representative pages (flex, w-full, min-h-screen,
    items-stretch, etc.).
  - Total inlined: ~13KB raw, ~3KB after gzip in HTTP transit.

Replaces media=print + <noscript> fallback in HTML head. Idempotent: safe
to run twice (Cloudflare next-on-pages re-runs build hooks).

Usage: run after `next build` against the build output directory.
"""
import re, os, sys
from pathlib import Path


def _find_out_dir():
    for candidate in (".vercel/output/static", "out"):
        if Path(candidate).is_dir():
            return candidate
    return "out"


OUT = Path(os.environ.get("OUT_DIR") or _find_out_dir()).resolve()
print(f"  using OUT_DIR={OUT}")
CSS_DIR = OUT / "_next/static/css"

# ───────────────────────────────────────────────────────────────────────────
# Step 1: identify the broadsheet bundle and the Tailwind bundle.
# Broadsheet → contains `--font-display:` token from broadsheet-tokens.css.
# Tailwind   → contains `--tw-border-spacing-x:` from Tailwind preflight.
# ───────────────────────────────────────────────────────────────────────────
BROADSHEET_MARKER = "--font-display:"
TAILWIND_MARKER = "--tw-border-spacing-x"

broadsheet_filename = None
tailwind_filename = None
tailwind_src = None
for css in sorted(CSS_DIR.glob("*.css")):
    body = css.read_text(errors="replace")
    size_kb = css.stat().st_size // 1024
    if BROADSHEET_MARKER in body:
        broadsheet_filename = css.name
        print(f"  identified broadsheet bundle: {css.name} ({size_kb} KB)")
    elif TAILWIND_MARKER in body:
        tailwind_filename = css.name
        tailwind_src = body
        print(f"  identified tailwind bundle:   {css.name} ({size_kb} KB)")
    else:
        print(f"  keeping sync: {css.name} ({size_kb} KB)")

if not broadsheet_filename:
    print("ERROR: could not identify broadsheet CSS bundle")
    sys.exit(1)
if not tailwind_filename:
    print("ERROR: could not identify tailwind CSS bundle")
    sys.exit(1)

broadsheet_url = f"/_next/static/css/{broadsheet_filename}"
tailwind_url = f"/_next/static/css/{tailwind_filename}"


# ───────────────────────────────────────────────────────────────────────────
# Step 2: extract critical CSS from the Tailwind bundle.
# ───────────────────────────────────────────────────────────────────────────
CRITICAL_UTILS = [
    "flex", "flex-col", "block", "inline-block", "inline-flex", "grid", "hidden",
    "relative", "absolute",
    "w-full", "h-full", "min-h-screen",
    "max-w-7xl", "max-w-screen-xl", "max-w-screen-lg",
    "items-center", "items-stretch", "items-start", "items-end",
    "justify-between", "justify-center", "justify-start", "justify-end",
    "mb-auto", "mx-auto",
    "px-4", "px-6", "px-8", "py-2", "py-3", "py-4",
    "gap-2", "gap-3", "gap-4",
    "font-sans", "font-bold", "font-semibold",
    "text-black", "text-white",
    "text-sm", "text-base", "text-lg",
    "antialiased",
    "container",
]


def _find_utility_start(src: str) -> int:
    m = re.search(r"\.\\!container\{", src)
    if not m:
        m = re.search(r"\.container\{", src)
    if not m:
        return -1
    return m.start()


def _find_base_rule(cls: str, src: str):
    pat = r"(?:^|[}\s])(\." + re.escape(cls) + r")\{([^{}]*)\}"
    m = re.search(pat, src)
    if not m:
        return None
    return f".{cls}{{{m.group(2)}}}"


def extract_critical(tw_src: str) -> str:
    util_start = _find_utility_start(tw_src)
    if util_start < 0:
        raise RuntimeError("could not locate utility boundary in Tailwind bundle")
    preflight_globals = tw_src[:util_start]
    utility_block = tw_src[util_start:]
    rules = []
    missing = []
    for cls in CRITICAL_UTILS:
        rule = _find_base_rule(cls, utility_block)
        if rule:
            rules.append(rule)
        else:
            missing.append(cls)
    if missing:
        print(f"  WARNING: critical utility rules missing: {missing}")
    # Visual safety net: rules that live in the deferred broadsheet bundle
    # but affect first paint. Without these the body briefly paints white.
    SAFETY_NET = ".bs-body-cream{background:#F4EFE3}"
    return preflight_globals + "".join(rules) + SAFETY_NET


critical_css = extract_critical(tailwind_src)
print(f"  extracted critical CSS: {len(critical_css):,} bytes (was {len(tailwind_src):,})")


# ───────────────────────────────────────────────────────────────────────────
# Step 3: HTML rewriting helpers.
# ───────────────────────────────────────────────────────────────────────────
CRITICAL_STYLE_OPEN = '<style data-rwas-critical>'
CRITICAL_STYLE_CLOSE = '</style>'


def defer_link(html, url):
    pattern = (
        r'<link\s+rel="stylesheet"\s+href="'
        + re.escape(url)
        + r'"([^>]*)/?>'
        + r'(?:<noscript><link\s+rel="stylesheet"\s+href="'
        + re.escape(url)
        + r'"\s*/></noscript>)?'
    )
    new_link = (
        f'<link rel="stylesheet" href="{url}" media="print" '
        f"onload=\"this.media='all';this.onload=null\" />"
        f'<noscript><link rel="stylesheet" href="{url}" /></noscript>'
    )
    new_html, n = re.subn(pattern, new_link, html, count=1)
    return new_html, n > 0


def inject_critical(html, css):
    if "data-rwas-critical" in html:
        return html, False
    style_tag = CRITICAL_STYLE_OPEN + css + CRITICAL_STYLE_CLOSE
    m = re.search(r'<link\s+rel="stylesheet"', html)
    if not m:
        return html, False
    idx = m.start()
    return html[:idx] + style_tag + html[idx:], True


# ───────────────────────────────────────────────────────────────────────────
# Step 4: rewrite every HTML file.
# ───────────────────────────────────────────────────────────────────────────
print(f"\n  deferring both bundles + inlining critical CSS in HTML files...")
patched = 0
no_match = 0
for html_file in OUT.rglob("*.html"):
    src = html_file.read_text(errors="replace")
    new_src = src
    new_src, b_changed = defer_link(new_src, broadsheet_url)
    new_src, t_changed = defer_link(new_src, tailwind_url)
    new_src, c_added = inject_critical(new_src, critical_css)
    if b_changed or t_changed or c_added:
        html_file.write_text(new_src)
        patched += 1
    else:
        no_match += 1

print(f"  patched {patched} HTML files, {no_match} skipped (no stylesheet matches)")
