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
  - Plus targeted Tailwind utility classes used above-the-fold across
    representative pages. This includes responsive grid/card utilities wrapped
    in @media rules, because collection pages reflow without them.
  - Total inlined: small compared with the original 144KB Tailwind bundle, and
    still removes that bundle from the render-blocking path.

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
    "relative", "absolute", "overflow-hidden",
    "w-full", "h-full", "min-h-screen",
    "max-w-7xl",
    "items-center", "items-stretch", "items-start", "items-end",
    "justify-between", "justify-center", "justify-start", "justify-end",
    "mb-auto", "mx-auto",
    "px-4", "px-6", "px-8", "py-2", "py-3", "py-4",
    "p-6", "gap-2", "gap-3", "gap-4", "gap-6", "gap-8",
    "font-sans", "font-bold", "font-semibold",
    "text-black", "text-white",
    "text-sm", "text-base", "text-lg",
    "object-contain",
    "antialiased",
    "container",
    # Collection and product-card grids. These rules prevent deferred Tailwind
    # from changing product-card image size after first paint, which pushes LCP
    # later on heavy collection pages.
    "grid-cols-1", "md:grid-cols-2", "xl:grid-cols-3",
    "aspect-[4/3]", "bg-[#f5f3ef]",
]

EXTRA_CRITICAL_SELECTORS = [
    # Tailwind serializes comma in arbitrary values as "\2c " rather than "\,".
    r".lg\:grid-cols-\[280px_minmax\(0\2c 1fr\)\]",
]


def _find_utility_start(src: str) -> int:
    m = re.search(r"\.\\!container\{", src)
    if not m:
        m = re.search(r"\.container\{", src)
    if not m:
        return -1
    return m.start()


def _css_class_selector(cls: str) -> str:
    """Return the emitted Tailwind CSS selector fragment for a class name."""
    safe = []
    for ch in cls:
        if ch.isalnum() or ch in ("_", "-"):
            safe.append(ch)
        else:
            safe.append("\\" + ch)
    return "." + "".join(safe)


def _split_top_level_rules(src: str):
    """Yield (prelude, body) pairs for top-level CSS blocks.

    The built Tailwind CSS is minified to one line, so line-oriented parsing is
    not useful. This light parser only needs balanced braces; it does not try to
    understand CSS values.
    """
    i = 0
    n = len(src)
    while i < n:
        start = i
        open_idx = src.find("{", i)
        if open_idx < 0:
            return
        prelude = src[start:open_idx]
        depth = 1
        j = open_idx + 1
        while j < n and depth:
            if src[j] == "{":
                depth += 1
            elif src[j] == "}":
                depth -= 1
            j += 1
        if depth == 0:
            yield prelude, src[open_idx + 1:j - 1]
        i = j


def _extract_matching_rules(src: str, selector: str) -> list[str]:
    """Find a utility rule by selector, preserving enclosing @media blocks."""
    matches = []
    for prelude, body in _split_top_level_rules(src):
        prelude = prelude.strip()
        if not prelude:
            continue
        if prelude.startswith("@media") or prelude.startswith("@supports"):
            nested = _extract_matching_rules(body, selector)
            if nested:
                matches.append(prelude + "{" + "".join(nested) + "}")
            continue
        if selector in prelude:
            matches.append(prelude + "{" + body + "}")
    return matches


def extract_critical(tw_src: str) -> str:
    util_start = _find_utility_start(tw_src)
    if util_start < 0:
        raise RuntimeError("could not locate utility boundary in Tailwind bundle")
    preflight_globals = tw_src[:util_start]
    utility_block = tw_src[util_start:]
    rules = []
    missing = []
    seen_rules = set()
    for cls in CRITICAL_UTILS:
        selector = _css_class_selector(cls)
        found = _extract_matching_rules(utility_block, selector)
        if found:
            for rule in found:
                if rule not in seen_rules:
                    seen_rules.add(rule)
                    rules.append(rule)
        else:
            missing.append(cls)
    for selector in EXTRA_CRITICAL_SELECTORS:
        for rule in _extract_matching_rules(utility_block, selector):
            if rule not in seen_rules:
                seen_rules.add(rule)
                rules.append(rule)
    if missing:
        print(f"  WARNING: critical utility rules missing: {missing}")
    # Visual safety net: rules that live in the deferred broadsheet bundle but
    # affect first paint and LCP. PSI consistently reports the masthead brand
    # text as the LCP node on mobile pages, so keep the masthead's first-frame
    # layout/type styles inline while the full broadsheet bundle loads async.
    SAFETY_NET = (
        ".bs-body-cream{background:#F4EFE3}"
        "html,body{background:#F4EFE3;margin:0}"
        ".broadsheet{background:#F4EFE3;width:100%;color:#0F1418;font-family:var(--font-source-serif),Georgia,serif;font-size:15px;line-height:1.55;min-height:100vh;position:relative;isolation:isolate}"
        ".broadsheet>*{position:relative;z-index:1}"
        ".broadsheet .bs-masthead{background:#FBF7EC;border-top:1px solid #9E7826;border-bottom:6px double #9E7826;padding:22px 28px 18px}"
        ".broadsheet .bs-masthead__inner{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:auto 1fr auto;gap:24px;align-items:center}"
        ".broadsheet .bs-masthead__logo{height:84px;width:auto}"
        ".broadsheet .bs-masthead__titles{text-align:center}"
        ".broadsheet .bs-masthead__brand{font-family:var(--font-playfair),Georgia,serif;font-weight:900;font-size:40px;line-height:1;letter-spacing:.01em;margin:0;color:#0F1418}"
        ".broadsheet .bs-masthead__tagline{font-family:var(--font-inter),system-ui,sans-serif;font-size:10px;letter-spacing:.28em;text-transform:uppercase;color:#2A333C;margin-top:8px}"
        ".broadsheet .bs-masthead__cert{text-align:right;font-family:var(--font-inter),system-ui,sans-serif;font-size:11px;letter-spacing:.22em;text-transform:uppercase;line-height:1.6}"
        ".broadsheet .bs-masthead__cert-main{color:#0F1418;font-weight:700}"
        ".broadsheet .bs-masthead__cert-location{color:#2A333C}"
        "@media(max-width:900px){.broadsheet .bs-masthead__inner{grid-template-columns:1fr;text-align:center}.broadsheet .bs-masthead__cert{text-align:center}}"
        "@media(max-width:640px){.broadsheet .bs-masthead{padding:18px 14px 14px}.broadsheet .bs-masthead__inner{gap:12px}.broadsheet .bs-masthead__logo{height:64px}.broadsheet .bs-masthead__brand{font-size:clamp(30px,9vw,36px);letter-spacing:-.01em}.broadsheet .bs-masthead__tagline,.broadsheet .bs-masthead__cert{font-size:9px;letter-spacing:.16em}}"
    )
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
