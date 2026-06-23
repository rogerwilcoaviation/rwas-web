// brand.jsx — Roger Wilco / Papa-Alpha launch video shared visual system
// Exports brand tokens + reusable scene chrome (grid, HUD frame, red swipe, etc.)

const BRAND = {
  red:     '#E1241A',
  redDeep: '#A2120B',
  redGlow: 'rgba(225,36,26,0.55)',
  ink:     '#0C0D0F',
  ink2:    '#121417',
  panel:   '#171A1E',
  off:     '#F2F0EC',
  mute:    '#888F96',
  muteDim: 'rgba(242,240,236,0.42)',
  steel:   '#2A2F35',
  line:    'rgba(255,255,255,0.07)',
  lineHot: 'rgba(225,36,26,0.22)',
};

const FONTS = {
  display: "'Oswald', 'Arial Narrow', sans-serif",
  body:    "'Archivo', system-ui, sans-serif",
  mono:    "'JetBrains Mono', ui-monospace, monospace",
};

// quick easing refs
const E = window.Easing;
const cl = window.clamp;
// segment helper: returns eased 0..1 across [a,b] of localTime
function seg(t, a, b, ease = E.easeOutCubic) {
  if (b <= a) return t >= b ? 1 : 0;
  return ease(cl((t - a) / (b - a), 0, 1));
}

// ── Engineering blueprint background ─────────────────────────────────────────
function GridBG({ drift = true, hot = false }) {
  const time = window.useTime();
  const dx = drift ? (time * 6) % 80 : 0;
  const minor = BRAND.line;
  const major = 'rgba(255,255,255,0.05)';
  return (
    <div style={{ position: 'absolute', inset: 0, background: BRAND.ink, overflow: 'hidden' }}>
      {/* fine grid */}
      <div style={{
        position: 'absolute', inset: '-80px',
        backgroundImage: `linear-gradient(${minor} 1px, transparent 1px), linear-gradient(90deg, ${minor} 1px, transparent 1px)`,
        backgroundSize: '80px 80px',
        transform: `translate(${-dx}px, ${-dx * 0.5}px)`,
      }} />
      {/* major grid */}
      <div style={{
        position: 'absolute', inset: '-80px',
        backgroundImage: `linear-gradient(${major} 1.5px, transparent 1.5px), linear-gradient(90deg, ${major} 1.5px, transparent 1.5px)`,
        backgroundSize: '320px 320px',
        transform: `translate(${-dx}px, ${-dx * 0.5}px)`,
      }} />
      {/* red datum axes */}
      {hot && <React.Fragment>
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1.5, background: BRAND.lineHot }} />
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1.5, background: BRAND.lineHot }} />
      </React.Fragment>}
      {/* vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(120% 80% at 50% 42%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.55) 100%)',
      }} />
      {/* faint grain via top sheen */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0) 30%)',
      }} />
    </div>
  );
}

// ── Corner registration marks + thin inset frame (persistent chrome) ─────────
function CornerTick({ pos }) {
  const v = { left: pos.includes('l') ? 0 : 'auto', right: pos.includes('r') ? 0 : 'auto',
              top: pos.includes('t') ? 0 : 'auto', bottom: pos.includes('b') ? 0 : 'auto' };
  const flipX = pos.includes('r') ? -1 : 1;
  const flipY = pos.includes('b') ? -1 : 1;
  return (
    <div style={{ position: 'absolute', ...v, width: 34, height: 34, transform: `scale(${flipX},${flipY})` }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 34, height: 2, background: BRAND.red }} />
      <div style={{ position: 'absolute', left: 0, top: 0, width: 2, height: 34, background: BRAND.red }} />
    </div>
  );
}

function FrameChrome({ inset = 56, rightLabel = '', sceneNo = '01' }) {
  return (
    <div style={{ position: 'absolute', inset, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, border: '1px solid rgba(255,255,255,0.10)' }} />
      <CornerTick pos="tl" /><CornerTick pos="tr" /><CornerTick pos="bl" /><CornerTick pos="br" />
      {/* top-left id */}
      <div style={{ position: 'absolute', left: 16, top: -34, display: 'flex', alignItems: 'center', gap: 10,
                    whiteSpace: 'nowrap', fontFamily: FONTS.mono, fontSize: 14, letterSpacing: '0.18em', color: BRAND.muteDim }}>
        <span style={{ width: 7, height: 7, background: BRAND.red, borderRadius: '50%',
                       boxShadow: `0 0 8px ${BRAND.redGlow}` }} />
        RWA · PAPA-ALPHA SYSTEM
      </div>
      {/* top-right scene id */}
      <div style={{ position: 'absolute', right: 16, top: -34, fontFamily: FONTS.mono, fontSize: 14,
                    letterSpacing: '0.18em', color: BRAND.muteDim }}>
        REF {sceneNo} / 07
      </div>
      {/* bottom-left */}
      <div style={{ position: 'absolute', left: 16, bottom: -34, whiteSpace: 'nowrap', fontFamily: FONTS.mono, fontSize: 14,
                    letterSpacing: '0.18em', color: BRAND.muteDim }}>
        PIPER-SPECIFIC RIGGING SOLUTIONS
      </div>
      {/* bottom-right rotating label */}
      <div style={{ position: 'absolute', right: 16, bottom: -34, fontFamily: FONTS.mono, fontSize: 14,
                    letterSpacing: '0.18em', color: BRAND.muteDim }}>
        {rightLabel}
      </div>
    </div>
  );
}

// ── Red diagonal swipe (transition energy at scene boundaries) ───────────────
function Swipe({ start, dur = 0.62 }) {
  const time = window.useTime();
  const p = cl((time - start) / dur, 0, 1);
  if (p <= 0 || p >= 1) return null;
  // bar sweeps left -> right; covers screen at p~0.5
  const x = interpolate([0, 1], [-160, 160], E.easeInOutCubic)(p);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 60 }}>
      <div style={{
        position: 'absolute', top: '-20%', height: '140%', width: '160%', left: 0,
        transform: `translateX(${x}%) skewX(-12deg)`,
        background: `linear-gradient(90deg, rgba(225,36,26,0) 0%, ${BRAND.redDeep} 12%, ${BRAND.red} 50%, ${BRAND.redDeep} 88%, rgba(225,36,26,0) 100%)`,
      }} />
      <div style={{
        position: 'absolute', top: '-20%', height: '140%', width: 4, left: 0,
        transform: `translateX(${x + 78}%) skewX(-12deg)`,
        background: BRAND.off, boxShadow: '0 0 24px rgba(255,255,255,0.6)',
      }} />
    </div>
  );
}

// ── Small UI atoms ────────────────────────────────────────────────────────────
function Kicker({ children, color = BRAND.red, style = {} }) {
  return (
    <div style={{ fontFamily: FONTS.mono, fontSize: 19, letterSpacing: '0.42em', color,
                  textTransform: 'uppercase', ...style }}>
      {children}
    </div>
  );
}

// red callout pill
function RedPill({ children, style = {} }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, background: BRAND.red,
                  color: BRAND.off, fontFamily: FONTS.display, fontWeight: 600, fontSize: 40,
                  letterSpacing: '0.04em', padding: '14px 36px', textTransform: 'uppercase', whiteSpace: 'nowrap',
                  clipPath: 'polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%)', ...style }}>
      {children}
    </div>
  );
}

// animated stat check row
function CheckMark({ s }) { // s: 0..1 draw progress
  const dash = 1 - s;
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" style={{ flexShrink: 0 }}>
      <rect x="2" y="2" width="36" height="36" fill="none" stroke={BRAND.red} strokeWidth="2"
            strokeDasharray="144" strokeDashoffset={144 * (1 - cl(s * 1.3, 0, 1))} />
      <path d="M11 21 L17 27 L29 13" fill="none" stroke={BRAND.red} strokeWidth="3.4"
            strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray="32" strokeDashoffset={32 * cl(1 - (s - 0.2) / 0.8, 0, 1)} />
    </svg>
  );
}

Object.assign(window, { BRAND, FONTS, seg, GridBG, FrameChrome, CornerTick, Swipe, Kicker, RedPill, CheckMark });
