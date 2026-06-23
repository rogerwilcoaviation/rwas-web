# Handoff: Roger Wilco — "Complete Piper Rigging Kits" Launch Video

## Overview
A **33-second animated launch/announcement video**, rendered entirely in the browser, promoting Roger Wilco Aviation Services' **Complete Piper Rigging Kits** (the red "Papa-Alpha" precision tooling, sold through Aircraft Spruce). It is a single 1920×1080 (16:9) timeline composed of **7 sequential scenes** connected by red diagonal "swipe" transitions, over a persistent engineering-blueprint background with corner registration marks (HUD chrome).

The piece autoplays on load and exposes play/pause + a scrubber. It is motion-design output (a continuous timeline), **not** a slide deck or a typical web page.

## About the Design Files
The files in this bundle are **design references created in HTML/React** — a working prototype showing the intended look, motion, and timing. They are **not** meant to be dropped into production as-is. The task is to **recreate this animated piece in the target environment** using its established patterns:
- If the goal is a **reusable in-app/web animation**, rebuild it in the codebase's framework (React + a real animation lib like Framer Motion / GSAP, or Lottie) following its conventions.
- If the goal is a **distributable video** (the most common ask here — for social, email, PowerPoint embed, trade-show loop), the correct deliverable is an **MP4/WebM**: render this timeline and screen-capture/encode it. See "Intended Final Output" below.

If no environment exists yet, the prototype's own stack (React 18 + a small timeline engine) is a reasonable basis, but a dedicated motion tool (After Effects/Lottie) or headless capture (Puppeteer + ffmpeg) will produce a more portable result.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, layout, motion timing, and easing are all specified and intended to be matched. Recreate pixel- and timing-accurately.

## Intended Final Output
The customer's end users could not see motion in PowerPoint (PPTX holds only still frames) and asked for a link that plays. The durable, portable answer is a **video file**:
1. Open `Roger Wilco - Piper Rigging Kit Launch.html` full-screen at 1920×1080.
2. Capture the 33s timeline — either screen-record, or headless via Puppeteer driving `window.__deckSeek(t)` (a global the prototype exposes) frame-by-frame and pipe PNGs to `ffmpeg` at 30fps.
3. Encode H.264 MP4 (and optionally WebM). That file plays everywhere — email, social, embedded as a playing video inside PowerPoint.
A self-contained offline HTML version also exists (`Roger Wilco Launch Video (standalone).html`) that animates on double-click in any browser with no internet.

## Canvas & Scaling
- **Design canvas:** 1920 × 1080 px, fixed. Duration **33s**.
- The engine renders the canvas at native size and scales it with CSS `transform: scale()` to fit the viewport, letterboxing on black. Playback controls live outside the scaled canvas.
- Timeline position persists to `localStorage` under key `rwa-papa-alpha:t` (so a refresh resumes in place).

## Design Tokens

### Colors
| Token | Hex | Use |
|---|---|---|
| red | `#E1241A` | Primary brand red — accents, key words, datum lines, pill |
| redDeep | `#A2120B` | Swipe gradient edges, shadowed red |
| redGlow | `rgba(225,36,26,0.55)` | Glow/text-shadow behind red elements |
| ink | `#0C0D0F` | Primary background |
| ink2 | `#121417` | Photo-panel backing |
| panel | `#171A1E` | Panel surfaces |
| off (white) | `#F2F0EC` | Primary light text (warm off-white, NOT pure #fff) |
| mute | `#888F96` | Secondary/body text |
| muteDim | `rgba(242,240,236,0.42)` | Chrome labels |
| steel | `#2A2F35` | Misc industrial accent |
| line | `rgba(255,255,255,0.07)` | Fine grid lines |
| lineHot | `rgba(225,36,26,0.22)` | Red datum axes on grid |

### Typography
Three Google Fonts:
- **Oswald** (display) — weights 400/500/600/700. All headlines, big type. Condensed, uppercase, tight tracking. Fallback `'Arial Narrow', sans-serif`.
- **Archivo** (body) — weights 400/500/600/700. Sub-copy / supporting sentences. Fallback `system-ui, sans-serif`.
- **JetBrains Mono** (mono) — weights 400/500. Kickers, HUD chrome labels, callouts, CTA contact line. Wide letter-spacing. Fallback `ui-monospace, monospace`.

Headlines are uppercase, `line-height` ~0.92–1.0, `letter-spacing` ~0.01em. Kickers/mono are uppercase with `letter-spacing` 0.34–0.5em.

### Motion / Easing
- Easing functions used: `easeOutCubic` (most reveals), `easeInOutCubic` (sweeps/swipes), `easeOutBack` (pops — tagline "One Kit.", CTA pill), `easeInCubic` (scene exits).
- **Reveal** pattern: each text block slides up `~28–48px` and fades in over its `[a,b]` window; staggered per line by ~0.25–0.32s.
- **Scene exits:** fade + slight upward drift over the last ~0.4s.
- **Swipe transition:** a skewed (`-12deg`) red gradient bar sweeps left→right across the full frame at each scene boundary (~0.62s), with a bright white leading edge. Swipe start times below.
- **Ken Burns:** photo panels slowly scale (e.g. 1.08→1.20) and pan a few px over their dwell.
- **Grid drift:** blueprint grid translates slowly (~6px/s) for parallax life; some scenes static.

## Timeline / Scenes
Seven scenes on one timeline. Windows are `[start, end]` in seconds. Swipe transitions fire at each boundary.

| # | Scene | Window (s) | Swipe at |
|---|---|---|---|
| 01 | Hook | 0 – 4.3 | — |
| 02 | Tagline | 4.3 – 8.0 | 4.3 |
| 03 | Product reveal | 8.0 – 13.5 | 8.0 |
| 04 | What it rigs | 13.5 – 19.0 | 13.5 |
| 05 | Precision | 19.0 – 24.3 | 19.0 |
| 06 | Brand | 24.3 – 27.8 | 24.3 |
| 07 | CTA / end card | 27.8 – 33.0 | 27.8 |

Representative "rest frame" timestamps (used for the still-image/PPTX export): 3.6, 7.0, 11.8, 17.8, 22.6, 26.6, 31.8.

### Persistent chrome (all scenes)
Inset frame at 56px with a 1px `rgba(255,255,255,0.10)` border; red L-shaped **corner registration ticks** (34px, 2px stroke, `#E1241A`) at all four corners. Mono labels just outside the frame:
- Top-left: red dot (7px, glowing) + `RWA · PAPA-ALPHA SYSTEM`
- Top-right: `REF 0X / 07` (current scene number)
- Bottom-left: `PIPER-SPECIFIC RIGGING SOLUTIONS`
- Bottom-right: rotating per-scene label (`REV A · 2026`, `INTRODUCING`, `PA-SERIES KIT`, `5 CONTROL SURFACES`, `TOLERANCE ±0.0°`, `EST. RWA`, `ORDER NOW`).
Background everywhere: **GridBG** — `#0C0D0F` base, fine 80px grid (`rgba(255,255,255,0.07)`), major 320px grid (`rgba(255,255,255,0.05)`), optional red datum cross (`lineHot`), radial vignette darkening the edges, subtle top sheen.

### Scene 01 — Hook
Left-aligned (padding-left 150px), vertically centered.
- Kicker (mono): `Field Reference — Rigging Bay`
- Headline (Oswald 700, **138px**, line-height 0.97, uppercase), three lines revealed in sequence:
  `Rigging a Piper` / `shouldn't be` / **`guesswork.`** (last line in red `#E1241A`, with an animated red underline that sweeps L→R, 8px tall, glowing).
- Sub-copy (Archivo 400, 30px, `#888F96`, max-width 880): "Borrowed straightedges. Improvised jigs. Tolerances you can only hope are right."
- Grid drifts, red datum cross visible. Scene fades/drifts out at ~3.9–4.3s.

### Scene 02 — Tagline
Centered, text-align center, static grid.
- Kicker (mono): `Introducing`
- Line 1 (Oswald 600, 116px, off-white, uppercase, nowrap): `Everything Needed.`
- Line 2 (Oswald 700, **196px**, red, uppercase, glow): `One Kit.` — pops in with `easeOutBack` (scale 0.7→1.0).
- Mono caption: `THE  COMPLETE  PIPER  RIGGING  KIT` (wide tracking).

### Scene 03 — Product reveal
Split layout. Product photo enters from the right (slides in + scales 0.86→~1.0, slight rotate -2°→0°), with a red radial glow halo behind it and a drop shadow. Grid drifts, red datum cross on.
- Left title block (vertically centered, left 150px):
  - Kicker (mono): `Now Available`
  - Headline (Oswald 700, 110px, line-height 0.94, uppercase, nowrap): `Papa-Alpha` (red) / `Rigging Kits` (off-white), lines staggered.
  - Sub-copy (Archivo 500, 28px, mute, max-width 520): "Purpose-built, model-specific reference tools — engineered to factory rigging spec."
- Product image: `assets/raw_2_684x516.png`, ~1020px wide, right ~110px, vertically centered.

### Scene 04 — What it rigs
Split layout. Left: copy + animated checklist. Right: framed in-use photo panel.
- Kicker (mono): `One Kit Rigs It All`
- Headline (Oswald 700, 96px, uppercase): `Every control surface.`
- Checklist (5 rows, staggered ~0.32s apart). Each row: an animated **CheckMark** SVG (40px: a red square outline that draws in via `stroke-dashoffset`, then a red check path draws) + label (Oswald 600, 64px, off-white, uppercase, nowrap). Rows: **Stabilators, Rudders, Bell Cranks, Ailerons, Flaps**. Each row also slides in from left (-28px) + fades.
- Photo panel (right, 760×620): `assets/raw_0_683x556.png`, Ken Burns, corner ticks, caption `FIELD USE · STABILATOR REFERENCE`.

### Scene 05 — Precision
Split layout, copy left / large photo right. Grid drifts, red datum cross on.
- Kicker (mono): `Repeatable. Verifiable.`
- Headline (Oswald 700, 104px, uppercase): `Precision tools.` (off-white) / `Proven results.` (red), staggered.
- Sub-copy (Archivo 500, 28px, mute): "Hit factory tolerances the first time — and every time after."
- Photo panel (right, 880×520): `assets/raw_1_385x209.png`, Ken Burns, caption `DIGITAL LEVEL · READOUT 0.0.0°`.
- Overlaid callout near photo: `DEAD LEVEL` (Oswald 700, 40px, red) with a leader line (2px red) that draws out to a glowing red dot.

### Scene 06 — Brand
Centered, static grid + red datum cross.
- Logo: `assets/raw_3_256x256.png` (transparent RW biplane monogram) rendered at 300px, **knocked out to white** via CSS `filter: brightness(0) invert(1)` plus red glow drop-shadow. Scales/fades in.
- Wordmark (Oswald 700, 92px, off-white, uppercase, tracking 0.06em): `Roger Wilco`
- Sub (mono, 24px, red, tracking 0.5em, uppercase): `Aviation Services`

### Scene 07 — CTA / end card
Centered, grid drifts, red datum cross on. Does **not** fade out (final hold).
- Logo (same white-knockout monogram) at 120px.
- Headline (Oswald 700, 96px, line-height 0.98, off-white, uppercase, nowrap): `Complete Piper` / `Rigging Kits`.
- **RedPill** (Oswald 600, 40px, white on `#E1241A`, uppercase, with an angled `clip-path` cut on the right edge — `polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%)`): `Available Through Aircraft Spruce`. Pops in `easeOutBack`.
- Contact line (mono, 26px, off-white, flex row, nowrap): `rogerwilcoaviation.com` • (6px red dot) • `605-299-8178`.
- Closing line (Oswald 500, 34px, mute, tracking 0.16em, uppercase): `Everything Needed.` + `One Kit.` (the second phrase in red).

## State Management
The prototype's only runtime state is the **timeline clock** (current time in seconds) plus play/playing flags, held by a small timeline engine (`animations.jsx`) and persisted to `localStorage` (`rwa-papa-alpha:t`). All scene visuals are pure functions of `localTime` (time relative to the scene's start). There is no data fetching. For a production rebuild, drive everything from a single normalized clock; each scene reads `t` and maps it through the easing/segment helpers.

Key helper: `seg(t, a, b, ease)` returns an eased 0→1 across the window `[a,b]` — the backbone of every reveal/animation. `interpolate([from,to], ease)` maps a 0→1 progress to a value range.

## Interactions & Behavior
- **Autoplay** on load; play/pause + scrubber from the timeline engine.
- No click targets within scenes — it's linear video, not interactive UI.
- A global `window.__deckSeek(seconds)` is exposed (pauses + seeks) — used for frame export and useful for any headless capture pipeline.
- `prefers-reduced-motion` / print: not specially handled in the prototype (it's a video). For a web embed, gate decorative motion behind `@media (prefers-reduced-motion: no-preference)` and show end-states otherwise.

## Assets
All in `assets/` (copied into this handoff):
- `raw_2_684x516.png` — product hero (the Papa-Alpha rigging tools, cut-out). Scene 03.
- `raw_0_683x556.png` — in-use field photo (stabilator reference). Scene 04.
- `raw_1_385x209.png` — digital level / readout photo. Scene 05.
- `raw_3_256x256.png` — RW biplane monogram, **transparent** PNG; rendered white via CSS filter. Scenes 06 & 07.
- `logo_dark.png`, `logo_white.png` — full logos on solid plates (NOT used in final video — they have baked-in backgrounds; the transparent monogram is used instead). Included for reference.
These are low-res ad crops from the source banners/print ad. **For a clean MP4, request hi-res product photography and a vector/transparent logo.**

## Files (in this bundle)
- `Roger Wilco - Piper Rigging Kit Launch.html` — entry point. Loads React + the three JSX files; defines the timeline, scene windows, swipe times, and HUD chrome labels. Exposes `window.__deckSeek`.
- `animations.jsx` — the timeline engine: `Stage`, `Sprite`, `useTime`/`useSprite`/`useTimeline`, `Easing`, `clamp`, `interpolate`. Renders the fixed canvas and scales it to fit; play/scrub controls; localStorage persistence.
- `brand.jsx` — brand tokens (`BRAND`, `FONTS`), the `seg` helper, and shared chrome: `GridBG`, `FrameChrome`/`CornerTick`, `Swipe`, `Kicker`, `RedPill`, `CheckMark`.
- `scenes.jsx` — the seven scene components + `Reveal` and `PhotoPanel` helpers.
- `assets/` — images listed above.

### Notes for a faithful rebuild
- React scripts here share global scope via `window` assignment (a prototype constraint). In a real codebase use normal ES module imports instead.
- `font-family` warm off-white is `#F2F0EC`, not pure white — keep it.
- The biplane logo MUST stay transparent and be colored via `filter: brightness(0) invert(1)` (white) — do not use the plated `logo_*.png` over dark backgrounds.
- Match the easing curves precisely; the "feel" comes from `easeOutBack` pops on the tagline + CTA pill and the consistent `easeOutCubic` reveals.
