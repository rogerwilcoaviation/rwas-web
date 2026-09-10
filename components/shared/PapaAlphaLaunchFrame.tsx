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
        poster="/launch/papa-alpha-rigging-kits/poster.jpg"
        aria-label="Papa-Alpha rigging kits — play narrated video with music"
        controls
        preload="metadata"
        playsInline
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          background: '#0c0d0f',
        }}
      >
        <track
          kind="captions"
          src="/launch/papa-alpha-rigging-kits/captions-en.vtt"
          srcLang="en"
          label="English"
        />
        <a href={PAPA_ALPHA_LAUNCH_VIDEO_URL}>
          Watch the narrated launch video.
        </a>
      </video>
    </div>
  );
}
