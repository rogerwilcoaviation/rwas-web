export const PAPA_ALPHA_LAUNCH_URL = '/launch/papa-alpha-rigging-kits';
export const PAPA_ALPHA_LAUNCH_VIDEO_URL =
  '/launch/papa-alpha-rigging-kits/papa-alpha-rigging-kits-narrated.mp4';

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
      <video
        src={PAPA_ALPHA_LAUNCH_VIDEO_URL}
        title="Roger Wilco Complete Piper Rigging Kits launch video"
        controls
        preload="metadata"
        playsInline
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          background: '#0c0d0f',
        }}
      />
    </div>
  );
}
