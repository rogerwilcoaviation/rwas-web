# Avionics Sales Film Production Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a truthful 75-90 second RWAS avionics customer-journey film and accessible cutdowns that match the approved webpage and operating workflow.

**Architecture:** Lock the voiceover and shot map before editing, organize owned footage into a reproducible project, generate a captioned 16:9 master, then derive platform cutdowns. The film is a marketing explanation only and cannot show or imply an RTS, inspection, capability, schedule, or approval that did not occur.

**Tech Stack:** Existing RWAS-owned MP4/WebM assets, DaVinci Resolve or equivalent NLE, FFmpeg/ffprobe for verification and delivery transcodes, WebVTT captions

## Global Constraints

- Runtime is 75-90 seconds for the master.
- Story order is Vision, Discovery, Engineering, Commitment, Craftsmanship, Verification, Delivery, Supported.
- Location is `KYKN · Yankton, South Dakota`; no Sioux Falls or KFSD references.
- Manufacturer-neutral message with Garmin examples only where footage and configuration make them applicable.
- Do not show a customer concept as approved engineering, a completed installation as RTS, or a delivery scene before authorized RTS.
- No unverified customer aircraft, faces, N-numbers, records, screens, signatures, or testimonials appear without documented media approval.
- No customer credentials, technical records, or internal-only notes appear on screen.
- Captions are required; music never masks narration or safety-critical dialogue.
- Publishing requires a separate final owner approval after review of picture, audio, captions, and claims.

---

## File Structure

- `docs/media/avionics-sales-film-script.md` — final narration, supers, scene durations, claim basis, and approval checklist.
- `docs/media/avionics-sales-film-shot-list.md` — exact shot capture and media-release log.
- `media/avionics-sales-film/source/` — copied, read-only source media with checksum manifest.
- `media/avionics-sales-film/project/` — NLE project and edit interchange.
- `media/avionics-sales-film/captions/rwas-avionics-journey-en.vtt` — English captions.
- `media/avionics-sales-film/exports/rwas-avionics-journey-16x9-master.mp4` — 1080p caption-ready master.
- `media/avionics-sales-film/exports/rwas-avionics-journey-16x9-captioned.mp4` — open-caption version.
- `media/avionics-sales-film/exports/rwas-avionics-journey-9x16-30s.mp4` — vertical cutdown.
- `media/avionics-sales-film/exports/rwas-avionics-journey-1x1-30s.mp4` — square cutdown.
- `scripts/verify-avionics-sales-film.sh` — duration, dimensions, codec, audio, and caption checks.

### Task 1: Lock the Narration and Claims

**Files:**
- Create: `docs/media/avionics-sales-film-script.md`
- Create: `scripts/verify-avionics-sales-film.sh`

**Interfaces:**
- Consumes: approved customer lifecycle design and public webpage narrative.
- Produces: time-coded narration and supers with a claim-basis column.

- [ ] **Step 1: Create a failing script-verification command**

```bash
test -f docs/media/avionics-sales-film-script.md
grep -q 'Every great panel begins with the way you fly' docs/media/avionics-sales-film-script.md
grep -q 'authorized return to service' docs/media/avionics-sales-film-script.md
! grep -Eqi 'Sioux Falls|KFSD|guaranteed|automatic RTS' docs/media/avionics-sales-film-script.md
```

- [ ] **Step 2: Run and verify the script file is absent**

Run: `bash scripts/verify-avionics-sales-film.sh --script`

Expected: FAIL because the script does not exist.

- [ ] **Step 3: Write the final 75-90 second voiceover**

```text
Every great panel begins with the way you fly. At RWAS, one Project Advisor helps turn your mission, aircraft, and ideas into a clear avionics vision. We review compatibility, eligibility, structure, electrical requirements, interfaces, and the approved-data path before the plan becomes a proposal. You see the scope, assumptions, milestones, and choices—and additional billable work waits for your documented approval. Then skilled hands receive, inspect, fabricate, wire, install, configure, and record the work using current data and required in-process inspections. Installation is only one milestone. RWAS completes the applicable checkout, final inspection, aircraft records, and authorized return to service. At delivery, we transfer understanding: documents, configuration, connected services, operating orientation, and an applicable familiarization demonstration. And support continues at 48 hours, 30 days, 90 days, and beyond. From vision to flight—Roger Wilco Aviation Services, KYKN, Yankton.
```

Use on-screen supers `MISSION BEFORE EQUIPMENT`, `CLEAR SCOPE · CONTROLLED CHANGES`, `TESTED · INSPECTED · DOCUMENTED`, and `SUPPORTED AFTER DELIVERY`. Add a claim-basis table that maps each sentence to the approved lifecycle section.

- [ ] **Step 4: Verify word count and prohibited claims**

Run: `bash scripts/verify-avionics-sales-film.sh --script`

Expected: 165-205 narration words, all eight scenes present, required RTS wording present, and forbidden-copy scan clean.

- [ ] **Step 5: Commit the locked script**

```bash
git add docs/media/avionics-sales-film-script.md scripts/verify-avionics-sales-film.sh
git commit -m "docs: lock avionics customer journey film script"
```

### Task 2: Capture and Organize Approved Footage

**Files:**
- Create: `docs/media/avionics-sales-film-shot-list.md`
- Create: `media/avionics-sales-film/source/manifest.sha256`
- Copy: `/Users/rwas/Downloads/RWAS Promo.mp4` to `media/avionics-sales-film/source/rwas-promo-reference.mp4`
- Copy: `public/videos/social/rwas-panel-fabrication-9x16-safe-20260806.mp4` to `media/avionics-sales-film/source/panel-fabrication.mp4`
- Copy: `public/videos/rwas-panel-planner-promo.mp4` to `media/avionics-sales-film/source/panel-planner.mp4`

**Interfaces:**
- Consumes: owned existing footage and newly captured shop footage.
- Produces: release-checked source library and deterministic checksum manifest.

- [ ] **Step 1: Write the exact shot list**

```markdown
1. Aircraft exterior at KYKN dawn, no unapproved N-number visible.
2. Owner and Project Advisor discussing mission beside aircraft.
3. Panel Planner concept on screen with sample/non-customer data.
4. Technician checking eligibility/manual/data index.
5. Proposal scope and documented approval using staged sample data.
6. Receiving inspection and trace document close-up.
7. Preliminary aircraft/panel inspection.
8. Panel fabrication, harness construction, wiring, installation, and in-process inspection.
9. Power-up, configuration, functional test, final-inspection record, and authorized RTS signature with all private fields obscured.
10. Delivery records, device pairing, ground orientation, aircraft departure, and advisor follow-up.
```

Each row records owner, capture date, aircraft/person release, privacy treatment, lifecycle scene, and whether it is approved for website/social use.

- [ ] **Step 2: Copy existing sources without modifying originals**

```bash
mkdir -p media/avionics-sales-film/source
cp '/Users/rwas/Downloads/RWAS Promo.mp4' media/avionics-sales-film/source/rwas-promo-reference.mp4
cp public/videos/social/rwas-panel-fabrication-9x16-safe-20260806.mp4 media/avionics-sales-film/source/panel-fabrication.mp4
cp public/videos/rwas-panel-planner-promo.mp4 media/avionics-sales-film/source/panel-planner.mp4
shasum -a 256 media/avionics-sales-film/source/*.mp4 > media/avionics-sales-film/source/manifest.sha256
```

- [ ] **Step 3: Capture missing shots and complete release evidence**

Use 4K or 1080p, 23.976/24/29.97/30 fps, locked white balance, and stable exposure. Capture five seconds of handles before and after each action. Replace any shot whose release, privacy treatment, aircraft status, or represented workflow cannot be verified.

- [ ] **Step 4: Verify source integrity and coverage**

Run: `shasum -a 256 -c media/avionics-sales-film/source/manifest.sha256 && bash scripts/verify-avionics-sales-film.sh --sources`

Expected: all checksums pass and every one of the ten shot-list rows has an approved source or a documented exclusion.

- [ ] **Step 5: Commit metadata, not large camera originals**

```bash
git add docs/media/avionics-sales-film-shot-list.md media/avionics-sales-film/source/manifest.sha256
git commit -m "docs: define approved avionics film source library"
```

### Task 3: Edit, Mix, Caption, and Export the Master

**Files:**
- Create: `media/avionics-sales-film/project/rwas-avionics-journey.drp` or equivalent NLE project
- Create: `media/avionics-sales-film/captions/rwas-avionics-journey-en.vtt`
- Create: `media/avionics-sales-film/exports/rwas-avionics-journey-16x9-master.mp4`
- Create: `media/avionics-sales-film/exports/rwas-avionics-journey-16x9-captioned.mp4`
- Modify: `scripts/verify-avionics-sales-film.sh`

**Interfaces:**
- Consumes: locked narration, approved source manifest, shot list, and RWAS visual identity.
- Produces: 1920x1080 H.264 master, AAC stereo audio, and complete WebVTT captions.

- [ ] **Step 1: Build the eight-scene timeline**

```text
00:00-00:08 Vision
00:08-00:18 Discovery
00:18-00:28 Engineering
00:28-00:36 Commitment
00:36-00:53 Craftsmanship
00:53-01:05 Verification
01:05-01:18 Delivery
01:18-01:28 Supported and RWAS end card
```

If narration finishes earlier than 75 seconds, lengthen visual breathing room rather than adding claims. If it exceeds 90 seconds, tighten pauses and redundant visuals without removing authority language.

- [ ] **Step 2: Mix narration and music**

Target integrated loudness near -16 LUFS for web/social, true peak at or below -1 dBTP, centered intelligible narration, and music at least 12 dB below narration during speech.

- [ ] **Step 3: Author complete WebVTT captions**

```vtt
WEBVTT

00:00:00.000 --> 00:00:04.000
Every great panel begins with the way you fly.
```

Caption every spoken word and meaningful non-speech audio. Use sentence case, no more than two lines, and keep captions inside title-safe boundaries.

- [ ] **Step 4: Export clean and open-caption masters**

```bash
ffmpeg -i media/avionics-sales-film/exports/rwas-avionics-journey-16x9-master.mp4 \
  -vf "subtitles=media/avionics-sales-film/captions/rwas-avionics-journey-en.vtt" \
  -c:v libx264 -crf 18 -preset slow -c:a copy \
  media/avionics-sales-film/exports/rwas-avionics-journey-16x9-captioned.mp4
```

- [ ] **Step 5: Verify technical delivery**

Run: `bash scripts/verify-avionics-sales-film.sh --master`

Expected: duration 75-90 seconds, 1920x1080, H.264 video, AAC stereo audio, audible narration, caption file present, and prohibited-copy OCR/transcript review clean.

- [ ] **Step 6: Record owner review; do not publish yet**

Review picture, claims, customer/aircraft releases, spelling, location, RTS sequence, audio, and captions. Store approval in the shot-list review section before creating social cutdowns.

### Task 4: Create Social and Website Derivatives

**Files:**
- Create: `media/avionics-sales-film/exports/rwas-avionics-journey-9x16-30s.mp4`
- Create: `media/avionics-sales-film/exports/rwas-avionics-journey-1x1-30s.mp4`
- Create: `media/avionics-sales-film/exports/rwas-avionics-journey-poster.jpg`
- Modify: `scripts/verify-avionics-sales-film.sh`

**Interfaces:**
- Consumes: approved 16:9 master and captions.
- Produces: 1080x1920 vertical, 1080x1080 square, and 1600x900 poster deliverables.

- [ ] **Step 1: Cut a truthful 30-second sequence**

Use Vision, Discovery, Craftsmanship, Verification, and Supported. Retain `authorized return to service` in voice or on-screen text; do not collapse installation directly into flight.

- [ ] **Step 2: Reframe intentionally for vertical and square**

Keep faces, avionics, captions, and RWAS marks inside platform-safe zones. Replace shots that cannot be reframed cleanly rather than stretching or cropping away evidence context.

- [ ] **Step 3: Export derivatives**

```bash
ffmpeg -i media/avionics-sales-film/exports/rwas-avionics-journey-16x9-master.mp4 \
  -ss 00:00:18 -frames:v 1 -vf scale=1600:900 \
  media/avionics-sales-film/exports/rwas-avionics-journey-poster.jpg
```

Use the NLE for editorial reframing and open captions; use FFmpeg only for deterministic poster/export verification.

- [ ] **Step 4: Verify all derivatives**

Run: `bash scripts/verify-avionics-sales-film.sh --derivatives`

Expected: vertical is 1080x1920, square is 1080x1080, each is 25-35 seconds, audio/captions are present, and poster is 1600x900.

- [ ] **Step 5: Commit verification metadata and delivery notes**

```bash
git add scripts/verify-avionics-sales-film.sh docs/media/avionics-sales-film-script.md docs/media/avionics-sales-film-shot-list.md
git commit -m "docs: complete avionics film delivery gate"
```

### Task 5: Final Approval and Publication Handoff

**Files:**
- Modify: `docs/media/avionics-sales-film-shot-list.md`

**Interfaces:**
- Consumes: technically verified master, derivatives, caption file, claim review, and owner approval.
- Produces: approved delivery manifest for a later explicit website/social publication action.

- [ ] **Step 1: Record final approval fields**

```markdown
## Final release decision

- Owner review: approved or rejected, with date and reviewer
- Accountable Manager claim review: approved or rejected, with controlled reference
- Privacy/media releases: complete or blocked
- Captions: reviewed against narration
- Website master: approved or rejected
- Social cutdowns: approved or rejected
```

- [ ] **Step 2: Generate a delivery manifest**

Run: `shasum -a 256 media/avionics-sales-film/exports/* media/avionics-sales-film/captions/* > media/avionics-sales-film/exports/delivery-manifest.sha256`

Expected: one checksum line for each approved master, cutdown, poster, and caption file.

- [ ] **Step 3: Stop before publishing unless the owner gives explicit publication approval**

```text
Completion condition: approved media and checksums are ready for handoff. Website upload and social posting are separate external actions and must not be inferred from production approval.
```
