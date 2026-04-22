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
  title: 'Garmin Avionics & Aircraft Maintenance — Yankton, SD',
  description:
    'FAA Part 145 repair station in Yankton, SD. Certified Garmin dealer: G3X Touch, GFC 500, annual inspections, NDT. Call (605) 299-8178.',
};

/*
 * / (Home) — Ship 3 Tranche B production migration.
 * Mirrors the approved /preview/home-sample layout. Dynamic feeds
 * (#aircraft-sale-feed and #blog-articles-feed) are hydrated
 * client-side from the legacy JSON/API endpoints, rendered with the
 * bs-* broadsheet chrome classes.
 */
export default function Home() {
  return (
    <BroadsheetLayout>
      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref="/" />
      <CredentialsBar />
      <BulletinBar />

      <main className="bs-stage">
        {/* ── ABOVE-FOLD 3-COL GRID (LEFT RAIL | HERO | RIGHT RAIL) ── */}
        <div className="bs-3col">
          {/* LEFT RAIL -------------------------------------------------- */}
          <div>
            {/* Today's Edition TOC */}
            <Specimen variant="flat" as="aside" className="bs-toc">
              <div className="bs-toc__title">Today&rsquo;s Edition</div>
              <div className="bs-toc__row">
                <a href="/garmin">
                  <span>Latest From Garmin</span>
                  <span className="bs-toc__pg">A2 &rarr;</span>
                </a>
              </div>
              <div className="bs-toc__row">
                <a href="/collections/garmin-avionics">
                  <span>Garmin Store</span>
                  <span className="bs-toc__pg">A3 &rarr;</span>
                </a>
              </div>
              <div className="bs-toc__row">
                <a href="/collections/rigging-tools">
                  <span>Tool Procurement</span>
                  <span className="bs-toc__pg">B1 &rarr;</span>
                </a>
              </div>
              <div className="bs-toc__row">
                <a href="/shop-capabilities">
                  <span>Annual Inspections</span>
                  <span className="bs-toc__pg">B2 &rarr;</span>
                </a>
              </div>
              <div className="bs-toc__row">
                <a href="/shop-capabilities">
                  <span>NDT Services</span>
                  <span className="bs-toc__pg">C1 &rarr;</span>
                </a>
              </div>
              <div className="bs-toc__row">
                <a href="/about#contact">
                  <span>Scheduling</span>
                  <span className="bs-toc__pg">D1 &rarr;</span>
                </a>
              </div>
            </Specimen>

            <p className="bs-pullquote">
              &ldquo;Don&rsquo;t fly single-pilot, Roger Wilco is your trusted copilot&rdquo;
            </p>

            {/* Papa-Alpha Depot boxed ad */}
            <aside className="bs-ad" aria-label="Papa-Alpha Depot advertisement">
              <div className="bs-ad__kicker">Advertisement</div>
              <h3 className="bs-ad__title">Papa-Alpha Depot</h3>
              <p className="bs-ad__sub">Precision Piper rigging tools &middot; Tiered pricing</p>
              <a className="bs-ad__cta" href="/collections/rigging-tools">
                Order Papa-Alpha
              </a>
            </aside>

            {/* Papa-Alpha kit figure */}
            <Specimen variant="flat" as="figure" className="bs-specimen-figure">
              <Specimen.Image
                src="/newspaper/images/papa_alpha_kit.jpg"
                alt="Papa-Alpha rigging reference tools"
              />
              <Specimen.CaptionRule />
              <Specimen.Caption numeral="FIG. 01">
                Papa-Alpha rigging reference tools &mdash; CNC-machined aircraft-grade aluminum.
              </Specimen.Caption>
            </Specimen>
          </div>

          {/* CENTER HERO ----------------------------------------------- */}
          <div>
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Lead Story</span>
              <h2 className="bs-headline bs-headline--section">
                Full-Spectrum Repair Station, Northern Plains
              </h2>
              <hr className="section-rule" />

              {/* Hero photo — Cessna 182RG G500TXi install */}
              <Specimen variant="flat" as="figure" className="bs-specimen-figure">
                <Specimen.Image
                  src="/newspaper/images/r182_panel.jpg"
                  alt="Full Garmin G500TXi Suite installation in a Cessna 182RG"
                />
                <Specimen.CaptionRule />
                <Specimen.Caption numeral="FIG. 02">
                  Cessna 182RG &mdash; full Garmin G500TXi Suite installation by RWAS.
                </Specimen.Caption>
              </Specimen>

              <div className="bs-body">
                <p className="bs-drop">
                  Roger Wilco Aviation Services is an FAA-certificated repair station providing full-spectrum airframe, powerplant, avionics, and non-destructive testing services to general aviation, corporate, and commercial operators across the Northern Plains. Operating under Certificate No. RWSR491E, the station is authorized for a complete range of maintenance, repair, and alteration work.
                </p>
                <p>
                  Under the direction of John Halsted &mdash; with more than 40 years of aviation experience &mdash; RWAS delivers sheet metal fabrication, structural repair, and complete Garmin avionics installations including the G3X Touch suite, GTN navigator series, and GFC 500 autopilot.
                </p>
              </div>
            </Specimen>

            {/* Aircraft 4 Sale feed (hydrated client-side) */}
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Classifieds</span>
              <h2 className="bs-headline bs-headline--section">Aircraft 4 Sale</h2>
              <hr className="section-rule" />

              <div id="aircraft-sale-feed">
                <div style={{ fontStyle: 'italic', fontSize: '12px', color: '#888', padding: '8px 0' }}>
                  Loading listings&hellip;
                </div>
              </div>

              <div style={{ marginTop: '12px', textAlign: 'center' }}>
                <a href="/aircraft-for-sale" className="bs-ad__cta">
                  Browse All Listings &rarr;
                </a>
              </div>
              <p
                className="bs-body"
                style={{ marginTop: '10px', textAlign: 'center', fontStyle: 'italic' }}
              >
                <strong>Selling?</strong> Click the Jerry bubble &mdash; our AI concierge will walk you through listing your aircraft step by step.
              </p>
            </Specimen>
          </div>

          {/* RIGHT RAIL ------------------------------------------------ */}
          <div>
            {/* Blog articles feed (hydrated client-side) */}
            <Specimen variant="flat" as="aside">
              <div id="blog-articles-feed">
                <span className="bs-kicker">Loading&hellip;</span>
              </div>
            </Specimen>

            {/* Laser cutter new-capability figure */}
            <Specimen variant="flat" as="figure" className="bs-specimen-figure">
              <Specimen.Image
                src="/newspaper/images/laser_cutter.jpg"
                alt="Industrial fiber laser cutting at Roger Wilco Aviation Services"
              />
              <Specimen.CaptionRule />
              <Specimen.Caption numeral="FIG. 03">
                New capability &mdash; fiber laser cutting, welding, and scaling.
              </Specimen.Caption>
            </Specimen>

            {/* Schedule your inspection CTA (relocated from services band per John) */}
            <p
              className="bs-kicker"
              style={{ marginTop: '18px', textAlign: 'center', display: 'block' }}
            >
              Schedule your inspection today
            </p>
            <div className="bs-cta-row">
              <a href="tel:+16052998178" className="bs-cta-primary">
                Call (605) 299-8178
              </a>
              <a href="/about#contact" className="bs-cta-secondary">
                Request a Quote
              </a>
            </div>
          </div>
        </div>

        {/* ── 4-COL SERVICES BAND ───────────────────────────────────── */}
        <section aria-labelledby="services-heading" style={{ marginTop: '32px' }}>
          <h2
            id="services-heading"
            className="bs-headline bs-headline--section"
            style={{ textAlign: 'center' }}
          >
            Services &amp; Capabilities
          </h2>
          <hr className="section-rule" />

          <div className="bs-4col">
            {/* Papa-Alpha Tools */}
            <Specimen variant="flat" as="article">
              <span className="bs-kicker">Papa-Alpha Tools</span>
              <hr className="section-rule" />
              <ul className="bs-svc-list">
                <li className="bs-svc">
                  <p className="bs-svc-name">
                    <a href="/collections/rigging-tools">Piper Rigging Reference Tools</a>
                  </p>
                  <p className="bs-svc-desc">
                    Precision flight-control rigging for PA-28, PA-30, PA-31, PA-36. CNC-machined aluminum, powder coated, UV printed. Sold worldwide.
                  </p>
                </li>
                <li className="bs-svc">
                  <p className="bs-svc-name">
                    <a href="/products/rigging-kit">Complete Rigging Kit</a>
                  </p>
                  <p className="bs-svc-desc">
                    Stabilator, rudder, aileron, flap, and bell crank in one case. From $264.
                  </p>
                </li>
                <li className="bs-svc">
                  <p className="bs-svc-name">
                    <a href="/collections/rigging-tools">Individual Tools</a>
                  </p>
                  <p className="bs-svc-desc">
                    Stabilator, rudder, aileron &amp; flap, bell crank, PA-31/PA-36 specifics. From $59.99.
                  </p>
                </li>
                <li className="bs-svc">
                  <p className="bs-svc-name">Available At</p>
                  <p className="bs-svc-desc">
                    rogerwilcoaviation.com, Aircraft Spruce, Amazon (coming soon). Made by mechanics, for mechanics.
                  </p>
                </li>
              </ul>
            </Specimen>

            {/* Avionics */}
            <Specimen variant="flat" as="article">
              <span className="bs-kicker">Avionics</span>
              <hr className="section-rule" />
              <ul className="bs-svc-list">
                <li className="bs-svc">
                  <p className="bs-svc-name">
                    <a href="/collections/garmin-avionics">G3X Touch Suite</a>
                  </p>
                  <p className="bs-svc-desc">
                    Full glass cockpit with ADAHRS, EIS, and synthetic vision. STC&rsquo;d for most single-engine piston aircraft.
                  </p>
                </li>
                <li className="bs-svc">
                  <p className="bs-svc-name">
                    <a href="/collections/garmin-avionics">GTN 650Xi / 750Xi</a>
                  </p>
                  <p className="bs-svc-desc">
                    GPS/NAV/COMM with WAAS LPV approaches, IFR certification, and flight-plan integration.
                  </p>
                </li>
                <li className="bs-svc">
                  <p className="bs-svc-name">
                    <a href="/collections/garmin-avionics">GFC 500 Autopilot</a>
                  </p>
                  <p className="bs-svc-desc">
                    Retrofit digital autopilot with GPSS steering, altitude hold, and vertical-speed modes.
                  </p>
                </li>
                <li className="bs-svc">
                  <p className="bs-svc-name">
                    <a href="/collections/garmin-avionics">ADS-B Out Compliance</a>
                  </p>
                  <p className="bs-svc-desc">
                    FAR 91.227 compliant installations. Transponder upgrades and system certification.
                  </p>
                </li>
              </ul>
            </Specimen>

            {/* Airframe & Powerplant */}
            <Specimen variant="flat" as="article">
              <span className="bs-kicker">Airframe &amp; Powerplant</span>
              <hr className="section-rule" />
              <ul className="bs-svc-list">
                <li className="bs-svc">
                  <p className="bs-svc-name">
                    <a href="/shop-capabilities">Annual Inspections</a>
                  </p>
                  <p className="bs-svc-desc">
                    Thorough airworthiness inspections per FAR 43. Discrepancy reports and return-to-service documentation.
                  </p>
                </li>
                <li className="bs-svc">
                  <p className="bs-svc-name">
                    <a href="/shop-capabilities">100-Hour Inspections</a>
                  </p>
                  <p className="bs-svc-desc">
                    For aircraft operated for hire under 14 C.F.R. Part 91 and Part 135 requirements.
                  </p>
                </li>
                <li className="bs-svc">
                  <p className="bs-svc-name">
                    <a href="/shop-capabilities">Sheet Metal &amp; Fabrication</a>
                  </p>
                  <p className="bs-svc-desc">
                    Structural repair, skin replacement, custom fabrication in aircraft-grade aluminum alloys.
                  </p>
                </li>
                <li className="bs-svc">
                  <p className="bs-svc-name">
                    <a href="/shop-capabilities">Engine Troubleshooting</a>
                  </p>
                  <p className="bs-svc-desc">
                    Powerplant diagnostics, mag checks, compression testing, and engine runs.
                  </p>
                </li>
              </ul>
            </Specimen>

            {/* NDT & Certification */}
            <Specimen variant="flat" as="article">
              <span className="bs-kicker">NDT &amp; Certification</span>
              <hr className="section-rule" />
              <ul className="bs-svc-list">
                <li className="bs-svc">
                  <p className="bs-svc-name">
                    <a href="/shop-capabilities">Eddy Current Inspection</a>
                  </p>
                  <p className="bs-svc-desc">
                    Subsurface crack and corrosion detection in aluminum and ferrous components &mdash; without disassembly.
                  </p>
                </li>
                <li className="bs-svc">
                  <p className="bs-svc-name">
                    <a href="/shop-capabilities">Dye Penetrant Testing</a>
                  </p>
                  <p className="bs-svc-desc">
                    Surface crack detection per ASTM E1417 for engine components, castings, and structural parts.
                  </p>
                </li>
                <li className="bs-svc">
                  <p className="bs-svc-name">
                    <a href="/about">Certified Repair Station</a>
                  </p>
                  <p className="bs-svc-desc">
                    FAA Certificate RWSR491E. All work by certificated mechanics with full logbook documentation.
                  </p>
                </li>
              </ul>
            </Specimen>
          </div>
        </section>
      </main>

      <BroadsheetFooter />

      {/* Aircraft-for-sale feed hydration */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
(function(){
  var feed = document.getElementById('aircraft-sale-feed');
  if (!feed) return;
  fetch('https://sale-api.rogerwilcoaviation.com/browse')
    .then(function(r){ return r.json(); })
    .then(function(data){
      var listings = (data.listings || []).slice(0, 4);
      if (!listings.length) {
        feed.innerHTML = '<div style="font-style:italic;font-size:12px;color:#888;padding:8px 0">No aircraft currently listed. <a href="/aircraft-for-sale#sell" style="color:#1a1a1a;text-decoration:underline">List yours today.</a></div>';
        return;
      }
      feed.innerHTML = listings.map(function(l){
        var priceRaw = l.price ? String(l.price).replace(/[^0-9]/g,'') : '';
        var price = priceRaw ? '$' + parseInt(priceRaw).toLocaleString() : 'Call';
        var lbCount = l.logbooks ? Object.values(l.logbooks).reduce(function(s,a){ return s + (a?a.length:0); }, 0) : 0;
        var photo = l.photos && l.photos.length
          ? '<img src="https://sale-api.rogerwilcoaviation.com/files/' + l.photos[0].key + '" alt="' + l.make + ' ' + l.model + '" style="width:100%;height:100%;object-fit:cover" />'
          : 'Photo';
        var cat = (l.category||'').replace(/-/g,' ');
        var meta = (l.year||'') + (cat ? ' \\u00b7 ' + cat : '');
        return '<a href="/aircraft-for-sale/' + l.id + '" class="bs-listing">'
          + '<div class="bs-listing__img">' + photo + '</div>'
          + '<div class="bs-listing__body">'
          + '<div>'
          + '<div class="bs-listing__meta">' + meta + '</div>'
          + '<h3 class="bs-listing__title">' + l.make + ' ' + l.model + '</h3>'
          + '</div>'
          + '<div class="bs-listing__foot">'
          + '<span class="bs-listing__price">' + price + '</span>'
          + (lbCount ? '<span class="bs-listing__logs">\\u2713 ' + lbCount + ' logbook doc' + (lbCount>1?'s':'') + '</span>' : '')
          + '</div>'
          + '</div>'
          + '</a>';
      }).join('');
    })
    .catch(function(){
      feed.innerHTML = '<div style="font-style:italic;font-size:12px;color:#888">Could not load listings.</div>';
    });
})();
`,
        }}
      />

      {/* Blog-articles feed hydration */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
(function() {
  var catLabels = {
    'press-release': 'Press Release',
    'service-bulletin': 'Service Bulletin',
    'product-update': 'Product Update',
    'memo': 'Dealer Memo',
    'regulatory': 'Regulatory'
  };
  fetch('/blog-articles.json?t=' + Date.now())
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var articles = (data.articles || [])
        .filter(function(a) { return a.status === 'published'; })
        .sort(function(a, b) { return b.date.localeCompare(a.date); })
        .slice(0, 3);
      var el = document.getElementById('blog-articles-feed');
      if (!el || !articles.length) return;
      var html = '';
      articles.forEach(function(a, i) {
        var label = catLabels[a.category] || a.category;
        var url = '/blog/article.html?id=' + a.id;
        html += '<span class="bs-kicker">' + label + '</span>';
        html += '<a href="' + url + '"><h3 class="bs-headline bs-headline--section">' + a.title + '</h3></a>';
        html += '<hr class="section-rule" />';
        html += '<p class="bs-body">' + a.lead.substring(0, 200) + (a.lead.length > 200 ? '&hellip;' : '') + '</p>';
        if (i < articles.length - 1) {
          html += '<hr class="section-rule" style="margin-top:18px" />';
        }
      });
      el.innerHTML = html;
    })
    .catch(function() {});
})();
`,
        }}
      />
    </BroadsheetLayout>
  );
}
