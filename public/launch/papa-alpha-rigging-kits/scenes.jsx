// scenes.jsx — the seven scenes of the Roger Wilco / Papa-Alpha launch spot.
// Each scene reads localTime via useSprite() (it is wrapped in <Sprite start end>).

const { BRAND: B, FONTS: F, seg: SEG, GridBG: Grid, Kicker: Kick, RedPill: Pill, CheckMark: Check } = window;
const EZ = window.Easing, CLP = window.clamp, INT = window.interpolate;

const ABS = { position: 'absolute' };
const CENTER = { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                 justifyContent: 'center' };

// reveal a block upward with slide + fade (no clipping mask — safe for multi-line)
function Reveal({ t, a, b, dy = 28, children, ease = EZ.easeOutCubic, style = {} }) {
  const p = SEG(t, a, b, ease);
  return (
    <div style={{ transform: `translateY(${(1 - p) * dy}px)`, opacity: p, willChange: 'transform,opacity', ...style }}>
      {children}
    </div>
  );
}

// framed photo with corner ticks + ken burns
function PhotoPanel({ src, t, w, h, kbFrom = 1.06, kbTo = 1.16, panX = 0, panY = 0, caption, entry = 0 }) {
  const appear = SEG(t, entry, entry + 0.7, EZ.easeOutCubic);
  const hold = CLP((t - entry) / 5.0, 0, 1);
  const sc = kbFrom + (kbTo - kbFrom) * hold;
  return (
    <div style={{ position: 'absolute', width: w, height: h, opacity: appear,
                  transform: `translateY(${(1 - appear) * 24}px)`, willChange: 'transform,opacity' }}>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: B.ink2,
                    boxShadow: '0 30px 80px rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.10)' }}>
        <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover',
              transform: `scale(${sc}) translate(${panX * hold}px, ${panY * hold}px)`,
              transformOrigin: 'center', display: 'block' }} />
        <div style={{ position: 'absolute', inset: 0,
              background: 'linear-gradient(180deg, rgba(12,13,15,0) 55%, rgba(12,13,15,0.65))' }} />
      </div>
      {/* corner ticks */}
      {['tl','tr','bl','br'].map(p => {
        const s = { position: 'absolute', width: 22, height: 22 };
        if (p[0] === 't') s.top = -1; else s.bottom = -1;
        if (p[1] === 'l') s.left = -1; else s.right = -1;
        const fx = p[1] === 'r' ? -1 : 1, fy = p[0] === 'b' ? -1 : 1;
        return <div key={p} style={{ ...s, transform: `scale(${fx},${fy})` }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: 22, height: 2, background: B.red }} />
          <div style={{ position: 'absolute', top: 0, left: 0, width: 2, height: 22, background: B.red }} />
        </div>;
      })}
      {caption && <div style={{ position: 'absolute', left: 14, bottom: 12, fontFamily: F.mono,
            fontSize: 13, letterSpacing: '0.16em', color: 'rgba(242,240,236,0.78)', opacity: appear }}>
        {caption}
      </div>}
    </div>
  );
}

// ── SCENE 1 · HOOK ───────────────────────────────────────────────────────────
function SceneHook() {
  const { localTime: t } = window.useSprite();
  const ul = SEG(t, 1.9, 2.7, EZ.easeInOutCubic); // underline sweep
  const exit = SEG(t, 3.9, 4.3, EZ.easeInCubic);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - exit,
                  transform: `translateY(${-exit * 24}px)` }}>
      <Grid drift hot />
      <div style={{ ...CENTER, paddingLeft: 150 }}>
        <Reveal t={t} a={0.25} b={0.85} style={{ marginBottom: 30 }}>
          <Kick>Field Reference — Rigging Bay</Kick>
        </Reveal>
        <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 138, lineHeight: 0.97,
                      letterSpacing: '0.005em', color: B.off, textTransform: 'uppercase' }}>
          <Reveal t={t} a={0.65} b={1.25} dy={48}><div>Rigging a Piper</div></Reveal>
          <Reveal t={t} a={0.95} b={1.55} dy={48}><div>shouldn’t be</div></Reveal>
          <Reveal t={t} a={1.35} b={1.95} dy={48} style={{ width: 'fit-content' }}>
            <div style={{ position: 'relative', color: B.red, paddingBottom: 8 }}>
              guesswork.
              <div style={{ position: 'absolute', left: 0, bottom: 0, height: 8, width: `${ul * 100}%`,
                            background: B.red, boxShadow: `0 0 22px ${B.redGlow}` }} />
            </div>
          </Reveal>
        </div>
        <Reveal t={t} a={2.5} b={3.1} style={{ marginTop: 40 }}>
          <div style={{ fontFamily: F.body, fontWeight: 400, fontSize: 30, color: B.mute, maxWidth: 880,
                        letterSpacing: '0.01em' }}>
            Borrowed straightedges. Improvised jigs. Tolerances you can only hope are right.
          </div>
        </Reveal>
      </div>
    </div>
  );
}

// ── SCENE 2 · TAGLINE ──────────────────────────────────────────────────────────
function SceneTagline() {
  const { localTime: t } = window.useSprite();
  const pop = SEG(t, 1.25, 1.75, EZ.easeOutBack);
  const exit = SEG(t, 3.2, 3.6, EZ.easeInCubic);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - exit }}>
      <Grid drift={false} />
      <div style={{ ...CENTER, alignItems: 'center', textAlign: 'center' }}>
        <Reveal t={t} a={0.2} b={0.7}><Kick style={{ marginBottom: 40 }}>Introducing</Kick></Reveal>
        <Reveal t={t} a={0.45} b={1.05} dy={44}>
          <div style={{ fontFamily: F.display, fontWeight: 600, fontSize: 116, lineHeight: 1.0, whiteSpace: 'nowrap',
                        color: B.off, textTransform: 'uppercase', letterSpacing: '0.01em' }}>
            Everything Needed.
          </div>
        </Reveal>
        <div style={{ marginTop: 28, transform: `scale(${0.7 + pop * 0.3})`, opacity: CLP(pop * 1.4, 0, 1),
                      transformOrigin: 'center' }}>
          <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 196, lineHeight: 0.92,
                        color: B.red, textTransform: 'uppercase', letterSpacing: '0.01em',
                        textShadow: `0 0 60px ${B.redGlow}` }}>
            One&nbsp;Kit.
          </div>
        </div>
        <Reveal t={t} a={2.0} b={2.6} style={{ marginTop: 36 }}>
          <div style={{ fontFamily: F.mono, fontSize: 20, letterSpacing: '0.34em', color: B.mute }}>
            THE&nbsp;&nbsp;COMPLETE&nbsp;&nbsp;PIPER&nbsp;&nbsp;RIGGING&nbsp;&nbsp;KIT
          </div>
        </Reveal>
      </div>
    </div>
  );
}

// ── SCENE 3 · PRODUCT REVEAL ─────────────────────────────────────────────────
function callout(t, a, label, top, left, lineW, dir) {
  const p = SEG(t, a, a + 0.5, EZ.easeOutCubic);
  return (
    <div key={label} style={{ position: 'absolute', top, left, opacity: p, willChange: 'opacity' }}>
      <div style={{ display: 'flex', alignItems: 'center', flexDirection: dir === 'l' ? 'row-reverse' : 'row', gap: 0 }}>
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: B.red, flexShrink: 0,
                      boxShadow: `0 0 12px ${B.redGlow}` }} />
        <div style={{ height: 2, width: lineW * p, background: B.red }} />
        <div style={{ fontFamily: F.mono, fontSize: 17, letterSpacing: '0.2em', color: B.off,
                      whiteSpace: 'nowrap', padding: dir === 'l' ? '0 14px 0 0' : '0 0 0 14px' }}>
          {label}
        </div>
      </div>
    </div>
  );
}
function SceneProduct({ img }) {
  const { localTime: t } = window.useSprite();
  const appear = SEG(t, 0.15, 0.95, EZ.easeOutCubic);
  const hold = CLP(t / 5.4, 0, 1);
  const sc = 0.86 + appear * 0.14 + hold * 0.06;
  const exit = SEG(t, 5.1, 5.5, EZ.easeInCubic);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - exit }}>
      <Grid drift hot />
      {/* red glow halo behind product */}
      <div style={{ position: 'absolute', right: 200, top: '50%', width: 900, height: 620,
                    transform: 'translateY(-50%)', opacity: appear * 0.8,
                    background: 'radial-gradient(closest-side, rgba(225,36,26,0.28), rgba(225,36,26,0) 72%)' }} />
      {/* product */}
      <div style={{ position: 'absolute', right: 110, top: '50%', width: 1020,
                    transform: `translateY(-50%) translateX(${(1 - appear) * 70}px)`, opacity: appear }}>
        <img src={img} alt="" style={{ width: '100%', display: 'block',
              transform: `scale(${sc}) rotate(${-2 + appear * 2}deg)`, transformOrigin: 'center',
              filter: 'drop-shadow(0 40px 60px rgba(0,0,0,0.6))' }} />
      </div>
      {/* callouts */}
      {/* title block */}
      <div style={{ position: 'absolute', left: 150, top: '50%', transform: 'translateY(-50%)' }}>
        <Reveal t={t} a={0.4} b={1.0}><Kick style={{ marginBottom: 22 }}>Now Available</Kick></Reveal>
        <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 110, lineHeight: 0.94,
                      textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          <Reveal t={t} a={0.6} b={1.2} dy={40}><div style={{ color: B.red }}>Papa-Alpha</div></Reveal>
          <Reveal t={t} a={0.85} b={1.45} dy={40}><div style={{ color: B.off }}>Rigging Kits</div></Reveal>
        </div>
        <Reveal t={t} a={1.3} b={1.9} style={{ marginTop: 26 }}>
          <div style={{ fontFamily: F.body, fontWeight: 500, fontSize: 28, color: B.mute, maxWidth: 520 }}>
            Purpose-built, model-specific reference tools — engineered to factory rigging spec.
          </div>
        </Reveal>
      </div>
    </div>
  );
}

// ── SCENE 4 · WHAT IT RIGS ───────────────────────────────────────────────────
const RIG_ITEMS = ['Stabilators', 'Rudders', 'Bell Cranks', 'Ailerons', 'Flaps'];
function SceneRigs({ img }) {
  const { localTime: t } = window.useSprite();
  const exit = SEG(t, 5.1, 5.5, EZ.easeInCubic);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - exit }}>
      <Grid drift />
      <div style={{ position: 'absolute', left: 150, top: '50%', transform: 'translateY(-50%)' }}>
        <Reveal t={t} a={0.2} b={0.8}><Kick style={{ marginBottom: 18 }}>One Kit Rigs It All</Kick></Reveal>
        <Reveal t={t} a={0.4} b={1.0} style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 96, lineHeight: 0.95,
                        color: B.off, textTransform: 'uppercase' }}>
            Every control<br/>surface.
          </div>
        </Reveal>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {RIG_ITEMS.map((label, i) => {
            const a = 1.1 + i * 0.32;
            const s = SEG(t, a, a + 0.5, EZ.easeOutCubic);
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 22,
                    opacity: s, transform: `translateX(${(1 - s) * -28}px)`, willChange: 'transform,opacity' }}>
                <Check s={SEG(t, a, a + 0.55, EZ.easeOutCubic)} />
                <div style={{ fontFamily: F.display, fontWeight: 600, fontSize: 64, color: B.off,
                              textTransform: 'uppercase', letterSpacing: '0.01em', lineHeight: 1, whiteSpace: 'nowrap' }}>
                  {label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ position: 'absolute', right: 140, top: '50%', width: 760, height: 620,
                    transform: 'translateY(-50%)' }}>
        <PhotoPanel src={img} t={t} w={760} h={620} kbFrom={1.08} kbTo={1.2} panX={-18}
                    caption="FIELD USE · STABILATOR REFERENCE" entry={0.5} />
      </div>
    </div>
  );
}

// ── SCENE 5 · PRECISION ──────────────────────────────────────────────────────
function ScenePrecision({ img }) {
  const { localTime: t } = window.useSprite();
  const exit = SEG(t, 5.0, 5.4, EZ.easeInCubic);
  const lead = SEG(t, 1.6, 2.3, EZ.easeInOutCubic);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - exit }}>
      <Grid drift hot />
      {/* big photo right */}
      <div style={{ position: 'absolute', right: 130, top: '50%', width: 880, height: 520,
                    transform: 'translateY(-50%)' }}>
        <PhotoPanel src={img} t={t} w={880} h={520} kbFrom={1.1} kbTo={1.28} panY={-6}
                    caption="DIGITAL LEVEL · READOUT 0.0.0°" entry={0.2} />
        {/* dead-level callout */}
        <div style={{ position: 'absolute', left: -150, top: 150, opacity: SEG(t, 1.5, 2.0) }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 40, color: B.red,
                          letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>DEAD&nbsp;LEVEL</div>
            <div style={{ height: 2, width: lead * 160, background: B.red, marginLeft: 8 }} />
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: B.red,
                          boxShadow: `0 0 12px ${B.redGlow}` }} />
          </div>
        </div>
      </div>
      {/* left copy */}
      <div style={{ position: 'absolute', left: 150, top: '50%', transform: 'translateY(-50%)', maxWidth: 640 }}>
        <Reveal t={t} a={0.2} b={0.8}><Kick style={{ marginBottom: 22 }}>Repeatable. Verifiable.</Kick></Reveal>
        <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 104, lineHeight: 0.92,
                      textTransform: 'uppercase' }}>
          <Reveal t={t} a={0.4} b={1.0} dy={40}><div style={{ color: B.off }}>Precision tools.</div></Reveal>
          <Reveal t={t} a={0.7} b={1.3} dy={40}><div style={{ color: B.red }}>Proven results.</div></Reveal>
        </div>
        <Reveal t={t} a={1.2} b={1.8} style={{ marginTop: 28 }}>
          <div style={{ fontFamily: F.body, fontWeight: 500, fontSize: 28, color: B.mute }}>
            Hit factory tolerances the first time — and every time after.
          </div>
        </Reveal>
      </div>
    </div>
  );
}

// ── SCENE 6 · BRAND ──────────────────────────────────────────────────────────
function SceneBrand({ logo }) {
  const { localTime: t } = window.useSprite();
  const ap = SEG(t, 0.2, 1.1, EZ.easeOutCubic);
  const exit = SEG(t, 3.1, 3.5, EZ.easeInCubic);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - exit }}>
      <Grid drift={false} hot />
      <div style={{ ...CENTER, alignItems: 'center', textAlign: 'center' }}>
        <div style={{ opacity: ap, transform: `scale(${0.82 + ap * 0.18})`, transformOrigin: 'center' }}>
          <img src={logo} alt="Roger Wilco Aviation Services" style={{ width: 300, height: 300,
                filter: `brightness(0) invert(1) drop-shadow(0 0 36px ${B.redGlow})`, display: 'block' }} />
        </div>
        <Reveal t={t} a={1.0} b={1.6} style={{ marginTop: 8 }}>
          <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 92, color: B.off,
                        textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1 }}>
            Roger&nbsp;Wilco
          </div>
        </Reveal>
        <Reveal t={t} a={1.3} b={1.9} style={{ marginTop: 10 }}>
          <div style={{ fontFamily: F.mono, fontSize: 24, letterSpacing: '0.5em', color: B.red,
                        textTransform: 'uppercase', paddingLeft: '0.5em' }}>
            Aviation Services
          </div>
        </Reveal>
      </div>
    </div>
  );
}

// ── SCENE 7 · CTA ────────────────────────────────────────────────────────────
function SceneCTA({ logo }) {
  const { localTime: t } = window.useSprite();
  const pill = SEG(t, 0.6, 1.15, EZ.easeOutBack);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Grid drift hot />
      <div style={{ ...CENTER, alignItems: 'center', textAlign: 'center' }}>
        <Reveal t={t} a={0.15} b={0.7}>
          <img src={logo} alt="" style={{ width: 120, height: 120, marginBottom: 10,
                filter: `brightness(0) invert(1) drop-shadow(0 0 22px ${B.redGlow})` }} />
        </Reveal>
        <Reveal t={t} a={0.3} b={0.85} style={{ marginBottom: 34 }}>
          <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 96, lineHeight: 0.98, whiteSpace: 'nowrap',
                        color: B.off, textTransform: 'uppercase', letterSpacing: '0.01em' }}>
            Complete Piper<br/>Rigging Kits
          </div>
        </Reveal>
        <div style={{ transform: `scale(${0.8 + pill * 0.2})`, opacity: CLP(pill * 1.4, 0, 1) }}>
          <Pill>Available Through Aircraft Spruce</Pill>
        </div>
        <Reveal t={t} a={1.5} b={2.1} style={{ marginTop: 38 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 26, whiteSpace: 'nowrap', fontFamily: F.mono,
                        fontSize: 26, letterSpacing: '0.12em', color: B.off }}>
            <span>rogerwilcoaviation.com</span>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: B.red }} />
            <span>605-299-8178</span>
          </div>
        </Reveal>
        <Reveal t={t} a={2.1} b={2.7} style={{ marginTop: 26 }}>
          <div style={{ fontFamily: F.display, fontWeight: 500, fontSize: 34, color: B.mute, whiteSpace: 'nowrap',
                        textTransform: 'uppercase', letterSpacing: '0.16em' }}>
            Everything Needed. <span style={{ color: B.red }}>One Kit.</span>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

Object.assign(window, {
  SceneHook, SceneTagline, SceneProduct, SceneRigs, ScenePrecision, SceneBrand, SceneCTA,
});
