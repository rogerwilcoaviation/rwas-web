import {
  BroadsheetLayout,
  Dateline,
  Masthead,
  BroadsheetNav,
  CredentialsBar,
  BulletinBar,
  BroadsheetFooter,
  Specimen,
} from '@/components/shared/broadsheet';

const PANEL_PLANNER_URL = 'https://panelplanner.rwas.team/customer';

export const metadata = {
  title: 'Build My Panel — Garmin Panel Planner by RWAS',
  description:
    'Sketch a Garmin avionics panel concept with the RWAS customer Panel Planner. Submit your concept for RWAS review before fabrication or installation.',
  alternates: {
    canonical: 'https://www.rogerwilcoaviation.com/panel-planner',
  },
};

export default function PanelPlannerPage() {
  return (
    <BroadsheetLayout>
      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref="/panel-planner" />
      <CredentialsBar />
      <BulletinBar />

      <main className="bs-stage">
        <section className="hero-headline-group" aria-labelledby="panel-planner-hero">
          <p className="bs-script-accent">&mdash; public concept tool &mdash;</p>
          <h1 id="panel-planner-hero" className="bs-headline bs-headline--hero">
            Build your dream Garmin panel before the first screw turns.
          </h1>
          <p className="bs-subhead">
            Use the RWAS customer Panel Planner to choose an aircraft panel, place avionics, preview finish ideas such as carbon fiber or brushed aluminum, and send the concept to our shop for review.
          </p>
        </section>

        <div className="bs-hero" style={{ marginTop: '28px' }}>
          <Specimen variant="hero" as="section">
            <span className="bs-kicker">Start Here</span>
            <h2 className="bs-headline bs-headline--section">Customer Panel Planner</h2>
            <hr className="section-rule" />
            <div className="bs-body">
              <p className="bs-drop">
                The planner is made for owners to sketch the idea: avionics, layout, panel finish, and wish-list notes. RWAS then turns that sketch into a reviewed proposal with the real engineering, eligibility, clearances, structure, electrical load, fabrication, and quote work behind it.
              </p>
              <p>
                It works on phones and tablets, so you can rough out the panel while you are standing next to the airplane, drinking hangar coffee, or making questionable life choices near a parts catalog.
              </p>
            </div>
            <div className="bs-cta-row panel-planner-cta-row">
              <a href={PANEL_PLANNER_URL} className="bs-cta-primary">
                Open Panel Planner
              </a>
              <a href="/contact?reason=quote&source=panel-planner-page" className="bs-cta-secondary">
                Ask RWAS First
              </a>
            </div>
            <p className="panel-planner-note">
              Concept only &mdash; not approved for fabrication or installation until RWAS reviews it.
            </p>
          </Specimen>

          <Specimen variant="flat" as="aside" className="panel-planner-brief">
            <span className="bs-kicker">What You Can Do</span>
            <hr className="section-rule" />
            <ul className="bs-svc-list">
              <li className="bs-svc">
                <p className="bs-svc-name">Choose an aircraft panel</p>
                <p className="bs-svc-desc">Start with an available panel outline such as the measured Cessna R182 template.</p>
              </li>
              <li className="bs-svc">
                <p className="bs-svc-name">Place Garmin equipment</p>
                <p className="bs-svc-desc">Search common avionics including G500 TXi, G3X Touch, GTN, GFC, GMA, GTX, GI 275, and more.</p>
              </li>
              <li className="bs-svc">
                <p className="bs-svc-name">Preview finish ideas</p>
                <p className="bs-svc-desc">Try satin, carbon fiber, wood grain, brushed aluminum, or a custom color for UV-print concepts.</p>
              </li>
              <li className="bs-svc">
                <p className="bs-svc-name">Submit to RWAS</p>
                <p className="bs-svc-desc">Send the sketch and notes directly into the RWAS review queue.</p>
              </li>
            </ul>
          </Specimen>
        </div>

        <Specimen variant="flat" as="section" className="panel-planner-disclaimer">
          <span className="bs-kicker">Important Fine Print</span>
          <p>
            Customer concepts are planning sketches. RWAS must review airworthiness, STC/AML eligibility, instrument clearances, electrical load, structure, fabrication, placards, finish process, and final quote before any aircraft work begins.
          </p>
        </Specimen>
      </main>

      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
