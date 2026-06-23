export const PAPA_ALPHA_LAUNCH_URL = '/launch/papa-alpha-rigging-kits';

export function PapaAlphaLaunchFrame() {
  return (
    <div
      style={{
        aspectRatio: '16 / 9',
        overflow: 'hidden',
        border: '1px solid rgba(46, 38, 30, 0.24)',
        background: '#0c0d0f',
      }}
    >
      <iframe
        src={PAPA_ALPHA_LAUNCH_URL}
        title="Roger Wilco Complete Piper Rigging Kits launch animation"
        allow="autoplay; fullscreen"
        style={{ display: 'block', width: '100%', height: '100%', border: 0 }}
      />
    </div>
  );
}
