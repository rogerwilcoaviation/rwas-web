export const PANEL_PLANNER_LAUNCH_URL = '/launch/panel-planner-ad';

export function PanelPlannerLaunchFrame() {
  return (
    <section
      aria-label="Panel Planner launch advertisement"
      style={{
        width: 'min(100%, 860px)',
        margin: '30px auto 0',
      }}
    >
      <div
        style={{
          aspectRatio: '1 / 1',
          overflow: 'hidden',
          border: '1px solid rgba(46, 38, 30, 0.24)',
          background: '#0a0d12',
        }}
      >
        <iframe
          src={PANEL_PLANNER_LAUNCH_URL}
          title="RWAS Panel Planner launch advertisement"
          allow="autoplay; fullscreen"
          style={{ display: 'block', width: '100%', height: '100%', border: 0 }}
        />
      </div>
    </section>
  );
}
