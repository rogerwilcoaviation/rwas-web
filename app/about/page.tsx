/* eslint-disable @next/next/no-html-link-for-pages */
/* eslint-disable @next/next/no-img-element */
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

export const metadata = {
  title: 'About — Roger Wilco Aviation Services',
  description:
    'Roger Wilco Aviation Services — FAA Part 145 Repair Station RWSR491E at Chan Gurney Municipal Airport (KYKN), Yankton, South Dakota. Full-spectrum airframe, powerplant, avionics, NDT, and fabrication.',
};

export default function AboutPage() {
  return (
    <BroadsheetLayout>
      {/* Lightbox for the N5171S panel photo — pure CSS, scoped to this page */}
      <style>{`
        .np-lightbox{display:none;position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.92);align-items:center;justify-content:center;cursor:pointer}
        .np-lightbox:target{display:flex}
        .np-lightbox img{max-width:95vw;max-height:90vh;object-fit:contain;box-shadow:0 8px 40px rgba(0,0,0,.5)}
        .np-lightbox-close{position:absolute;top:20px;right:30px;font-size:40px;color:#F4EFE3;text-decoration:none;font-weight:700;z-index:100001}
      `}</style>

      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref="/about" />
      <CredentialsBar />
      <BulletinBar />

      <main className="bs-stage">
        {/* ── HERO HEADLINE ─────────────────────────────────────────── */}
        <section className="hero-headline-group" aria-labelledby="about-hero">
          <span className="bs-kicker">About the Shop</span>
          <span className="bs-script-accent">&mdash; wheels-up since 2022 &mdash;</span>
          <h1 id="about-hero" className="bs-headline bs-headline--hero">
            Full-spectrum aviation services,
            <br />
            built on the Northern Plains.
          </h1>
          <p className="bs-subhead">
            FAA Part 145 Repair Station &middot; Certificate No. RWSR491E &middot; Chan Gurney Municipal Airport (KYKN) &middot; Yankton, South Dakota
          </p>
          <div className="bs-byline">
            Founded 2022 &nbsp;&middot;&nbsp; Avionics &middot; Airframe &middot; Powerplant &middot; NDT &middot; Fabrication &nbsp;&middot;&nbsp; Authorized Garmin Dealer
          </div>
          <div className="bs-body">
            <p>
              Roger Wilco Aviation Services is an FAA-certificated repair station providing full-spectrum airframe, powerplant, avionics, and non-destructive testing services to general aviation, corporate, and commercial operators across the Northern Plains. Operating from Chan Gurney Municipal Airport (KYKN) in Yankton, South Dakota, the station is authorized under Certificate No. RWSR491E for a complete range of maintenance, repair, and alteration work.
            </p>
          </div>
        </section>

        {/* ── TWO-COLUMN GRID ───────────────────────────────────────── */}
        <div className="about-grid">
          {/* MAIN COLUMN ---------------------------------------------- */}
          <div className="about-main">
            {/* Founder */}
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Our Founder</span>
              <h2 className="bs-headline bs-headline--section">Four Decades in Aviation</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  RWAS was founded by John Halsted, a veteran Delta Air Lines captain with more than 40 years of aviation experience spanning airline operations, aircraft maintenance, avionics systems, and flight instruction. What started as a single-hangar maintenance shop at Chan Gurney Municipal Airport in Yankton, South Dakota, has evolved into a full-service FAA-certificated repair station serving aircraft owners and operators across the upper Midwest and beyond.
                </p>
                <p>
                  Halsted earned his Airline Transport Pilot certificate at 21 and has spent the decades since building deep expertise on both sides of the cockpit, flying the line and turning wrenches. That dual perspective shapes everything RWAS does.
                </p>
                <p>
                  In its early years the shop focused on annual inspections, airframe repair, and basic avionics work for the local general-aviation fleet. When the Garmin glass-cockpit revolution reshaped the industry, Halsted saw an opportunity: bring modern avionics capability to the Northern Plains, a region where most owners had been forced to ferry their aircraft hundreds of miles to metro shops for panel upgrades. RWAS became a certified Garmin dealer and installation center, specializing in the G3X Touch suite, GTN Xi navigator series, and GFC 500 autopilot.
                </p>
              </div>
            </Specimen>

            {/* FIG. 01 — N5171S panel (clickable → lightbox) */}
            <Specimen variant="hero" as="figure" className="about-fig">
              <a href="#panel-lightbox" aria-label="Enlarge N5171S panel photo">
                <Specimen.Image
                  src="/newspaper/images/n5171s_panel.jpg"
                  alt="Custom laser-cut instrument panel for a Cessna 182RG"
                />
              </a>
              <Specimen.CaptionRule />
              <Specimen.Caption numeral="FIG. 01">
                Custom, precision laser-cut, powder coated, &amp; UV printed to perfection, single panel for a Cessna 182RG.
              </Specimen.Caption>
            </Specimen>

            {/* Lightbox target */}
            <div id="panel-lightbox" className="np-lightbox">
              <a href="#_" className="np-lightbox-close" aria-label="Close">
                &times;
              </a>
              <img
                src="/newspaper/images/n5171s_panel.jpg"
                alt="Custom laser-cut instrument panel — enlarged"
              />
            </div>

            {/* Papa-Alpha */}
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Papa-Alpha Tools</span>
              <h2 className="bs-headline bs-headline--section">Precision Rigging, Built In-House</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  One of the unique capabilities to come out of the RWAS shop is the Papa-Alpha line of precision rigging reference tools for Piper aircraft. Designed by Halsted after years of frustration with imprecise field methods for flight control rigging, the Papa-Alpha tools are CNC-machined from aircraft-grade aluminum, powder coated, and UV printed with permanent reference markings.
                </p>
                <p>
                  The tools cover stabilator, rudder, aileron, flap, and bell crank rigging for the PA-28, PA-30, PA-31, and PA-36 series &mdash; replacing the guesswork and tribal knowledge that has plagued Piper rigging for decades. Papa-Alpha tools are now shipped worldwide to maintenance shops, flight schools, and individual owners, and are available through rogerwilcoaviation.com, Aircraft Spruce, and Amazon.
                </p>
              </div>
            </Specimen>

            {/* Special Capabilities */}
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Special Capabilities</span>
              <h2 className="bs-headline bs-headline--section">NDT, Fabrication &amp; Laser Cutting</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Beyond avionics and airframe maintenance, RWAS operates non-destructive testing services including eddy current, dye penetrant, and magnetic particle inspection. The shop also maintains a sheet metal fabrication capability for structural repairs, custom cowlings, and bracket fabrication in aircraft-grade aluminum alloys.
                </p>
                <p>
                  Recent additions include a fiber laser cutting and welding system, enabling precision work on thin-gauge metals that was previously outsourced. This technology supports both aircraft work and the manufacturing of Papa-Alpha tools in-house.
                </p>
              </div>
            </Specimen>

            {/* Our Mission + Pull Quote */}
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Our Mission</span>
              <h2 className="bs-headline bs-headline--section">Honest Work, Documented Right.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  To deliver honest, professional aircraft maintenance and avionics work &mdash; on time, documented correctly, and built to last. Every aircraft that leaves this shop is one we&rsquo;d fly ourselves.
                </p>
              </div>
              <div className="bs-pullquote">
                We don&rsquo;t just fix aircraft &mdash; we keep them flying safely.
              </div>
            </Specimen>
          </div>

          {/* RAIL ----------------------------------------------------- */}
          <aside className="about-rail" aria-label="Contact &amp; quick reference">
            <Specimen as="section">
              <span className="bs-kicker">Location</span>
              <p>
                Chan Gurney Municipal Airport
                <br />
                700 E 31st St
                <br />
                Yankton, South Dakota 57078
                <br />
                Airport ID: KYKN
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Phone</span>
              <p>
                <a
                  href="tel:+16052998178"
                  style={{ color: 'var(--ink-900)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                >
                  (605) 299-8178
                </a>
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Email</span>
              <p>
                <a
                  href="mailto:avionics@rwas.team"
                  style={{ color: 'var(--ink-900)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                >
                  avionics@rwas.team
                </a>
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Hours</span>
              <p>
                Monday &ndash; Friday
                <br />
                8:00 AM &ndash; 5:00 PM CT
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Credentials &amp; Memberships</span>
              <p>
                FAA Repair Station RWSR491E
                <br />
                Authorized Garmin Dealer
                <br />
                NBAA Member
                <br />
                AEA Member
                <br />
                American Bonanza Society Trained
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Services</span>
              <ul>
                <li>
                  <a href="/collections/garmin-avionics">Garmin Avionics</a>
                  <span className="arr">&rarr;</span>
                </li>
                <li>
                  <a href="/collections/papa-alpha-tools">Papa-Alpha Tools</a>
                  <span className="arr">&rarr;</span>
                </li>
                <li>
                  <a href="/shop-capabilities">A&amp;P Maintenance</a>
                  <span className="arr">&rarr;</span>
                </li>
                <li>
                  <a href="/shop-capabilities">NDT Inspection</a>
                  <span className="arr">&rarr;</span>
                </li>
                <li>
                  <a href="/shop-capabilities">Sheet Metal &amp; Fabrication</a>
                  <span className="arr">&rarr;</span>
                </li>
                <li>
                  <a href="/financing">Financing</a>
                  <span className="arr">&rarr;</span>
                </li>
              </ul>
            </Specimen>

            {/* Ask Jerry CTA */}
            <div className="jerry-card">
              <span className="bs-script-accent">&mdash; on duty 24/7 &mdash;</span>
              <h4>Talk to Captain Jerry</h4>
              <p>Service inquiries &amp; scheduling</p>
              <a className="cta" href="#ask-jerry">
                Ask Jerry
              </a>
              <div className="footnote">AI-powered intake &middot; Available 24/7</div>
            </div>

            {/* FIG. 02 — Laser cutter */}
            <Specimen variant="hero" as="figure" className="about-fig about-fig--rail">
              <Specimen.Image
                src="/newspaper/images/laser_cutter.jpg"
                alt="Fiber laser cutting in the RWAS shop"
              />
              <Specimen.CaptionRule />
              <Specimen.Caption numeral="FIG. 02">
                Fiber laser &mdash; precision cutting &amp; welding, in-house.
              </Specimen.Caption>
            </Specimen>
          </aside>
        </div>
      </main>

      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
