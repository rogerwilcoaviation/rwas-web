import Image from 'next/image';
import Link from 'next/link';

const PANEL_PLANNER_URL = 'https://panelplanner.rwas.team/customer';

export function PanelPlannerLaunchFrame() {
  return (
    <section
      className="panel-planner-launch"
      aria-labelledby="panel-planner-preview"
    >
      <Link
        className="panel-planner-launch__image"
        href={PANEL_PLANNER_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          src="/images/social/panel-planner-ad-v5-premium.png"
          alt="Preview of the RWAS Panel Planner showing a Garmin avionics layout in a Cessna R182 panel"
          width={1080}
          height={1350}
          sizes="(max-width: 900px) 100vw, 860px"
          loading="lazy"
        />
      </Link>
      <div className="panel-planner-launch__caption">
        <div>
          <p className="bs-kicker">Interactive planning tool</p>
          <h2 id="panel-planner-preview">
            Sketch the panel. RWAS engineers the install-ready plan.
          </h2>
        </div>
        <Link
          href={PANEL_PLANNER_URL}
          className="bs-cta-primary"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Panel Planner
        </Link>
      </div>
    </section>
  );
}
