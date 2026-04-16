/* eslint-disable @next/next/no-html-link-for-pages */
/* eslint-disable @next/next/no-img-element */
/* eslint-disable @next/next/no-html-link-for-pages */
/* eslint-disable @next/next/no-img-element */
import './newspaper.css';

export const metadata = {
  title: 'Garmin Avionics & Aircraft Maintenance — Yankton, SD',
  description: 'FAA Part 145 repair station in Yankton, SD. Certified Garmin dealer: G3X Touch, GFC 500, annual inspections, NDT. Call (605) 299-8178.',
};
export default function Home() {
  return (
    <>
      <style>{`
        body::before {
          content: "";
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: url(/newspaper/images/enr_h05.png) center center / cover no-repeat;
          opacity: 0.25;
          z-index: 0;
          pointer-events: none;
        }
        body > * {
          position: relative;
          z-index: 1;
        }
        @media (max-width: 749px) {
          body::before {
            display: none !important;
          }
        }
      `}</style>
      <div className="np-wrapper" style={{ background: '#ddd9d2', minHeight: '100vh', fontFamily: "Georgia, 'Times New Roman', serif" }}>
      <div className="np-page">

        {/* ── Dateline ── */}
        <div className="np-dateline">
          <span>Spring 2026 Edition</span>
          <span>Vol. XL &middot; No. 1</span>
          <span>rogerwilcoaviation.com</span>
        </div>

        {/* ── Masthead ── */}
        <div className="np-masthead">
          <img
            className="np-masthead-logo"
            src="/newspaper/images/logo.png"
            alt="Roger Wilco Aviation Services"
          />
          <div className="np-masthead-center">
            <div className="np-masthead-name">Roger Wilco Aviation Services</div>
            <hr className="np-masthead-rule" />
            <div className="np-masthead-tagline">
              FAA Cert. Repair Station &nbsp;&middot;&nbsp; Avionics &nbsp;&middot;&nbsp; Airframe &amp; Powerplant &nbsp;&middot;&nbsp; NDT &nbsp;&middot;&nbsp; Fabrication
            </div>
          </div>
          <div className="np-masthead-right">
            <div className="np-masthead-right-meta">
              Cert. No. RWSR491E<br />
              KYKN &middot; Yankton, SD
            </div>
            <a href="tel:+16052998178" className="np-masthead-phone">(605) 299-8178</a>
            <a href="/about#contact" className="np-masthead-cta">Book Service</a>
          </div>
        </div>

        {/* ── Edition bar ── */}
        <div className="np-edition-bar">
          <span>New website launch — meet Captain Jerry, your AI avionics expert</span>
          <span>GFC 500 autopilot installations available</span>
          <span>Now accepting spring scheduling</span>
        </div>

        {/* ── Navigation ── */}
        <nav className="np-nav">
          <a className="active" href="/">Home</a>
          <a href="#ask-jerry" style={{ background: '#d4c47a', cursor: 'pointer' }} className="np-nav-jerry">Ask Jerry</a>
          <a href="/collections/on-sale">On Sale</a>
          <a href="/collections/garmin-avionics">Garmin</a>
          <a href="/collections/rigging-tools">Papa-Alpha Tools</a>
          <a href="/aircraft-for-sale">Aircraft 4 Sale</a>
          <a href="/financing">Financing</a>
          <a href="/shop-capabilities">Shop Capabilities</a>
          <a href="/blog/">Blog Articles</a>
          <a href="/about">About</a>
        </nav>

        {/* ── Ticker bar ── */}
        <div className="np-ticker-bar">
          <span className="np-ticker-label">Bulletin</span>
          <span className="np-ticker-text">
            Papa-Alpha rigging reference tools now shipping worldwide &nbsp;&bull;&nbsp;
            Garmin G3X Touch installations booking into summer 2026 &nbsp;&bull;&nbsp;
            Annual inspection slots available &mdash; call (605) 299-8178
          </span>
        </div>

        {/* ── Body ── */}
        <div className="np-body">

          {/* ── Above-fold 3-column grid ── */}
          <div className="np-above-fold">

            {/* ── LEFT COLUMN ── */}
            <div className="np-col np-col-left">
              <div className="np-box">
                <div className="np-box-title">Today&rsquo;s Edition</div>
                <div className="np-box-row">
                  <a href="/garmin"><span>Latest From Garmin</span><span className="np-box-pg">A2 &rarr;</span></a>
                </div>
                <div className="np-box-row">
                  <a href="/pages/garmin-avionics-accessories"><span>Garmin Store</span><span className="np-box-pg">A3 &rarr;</span></a>
                </div>
                <div className="np-box-row">
                  <a href="/collections/rigging-tools"><span>Tool Procurement</span><span className="np-box-pg">B1 &rarr;</span></a>
                </div>
                <div className="np-box-row">
                  <a href="/shop-capabilities"><span>Annual Inspections</span><span className="np-box-pg">B2 &rarr;</span></a>
                </div>
                <div className="np-box-row">
                  <a href="/shop-capabilities"><span>NDT Services</span><span className="np-box-pg">C1 &rarr;</span></a>
                </div>
                <div className="np-box-row">
                  <a href="/contact"><span>Scheduling</span><span className="np-box-pg">D1 &rarr;</span></a>
                </div>
              </div>

              <div className="np-pull-quote">
                &ldquo;We don&rsquo;t just fix aircraft &mdash; we keep them flying safely.&rdquo;
              </div>

              <div className="np-ad-box">
                <div className="np-ad-title">Papa-Alpha Depot</div>
                <div className="np-ad-sub">Precision Piper rigging tools</div>
                <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '9px', color: '#666', marginBottom: '7px', letterSpacing: '0.05em' }}>
                  Tiered pricing on all components
                </div>
                <a className="np-ad-btn" href="/collections/rigging-tools">Order Papa-Alpha</a>
              </div>

              <div className="np-img-box">
                <img src="/newspaper/images/papa_alpha_kit.jpg" alt="Papa-Alpha rigging reference tools" />
                <div className="np-img-box-cap">
                  Papa-Alpha rigging reference tools &mdash; CNC-machined aircraft-grade aluminum.
                </div>
              </div>

            </div>

            <div className="np-col-divider" />

            {/* ── CENTER COLUMN ── */}
            <div className="np-col">
              <span className="np-kicker" style={{ display: "block", textAlign: "center" }}>General Aviation Maintenance &amp; Avionics</span>
              <a href="/shop-capabilities" className="np-headline-link">
                <h1 className="np-headline-xl np-headline-xl-link" style={{ textAlign: "center" }}>
                  Premier Avionics &amp;<br />
                  <em>Maintenance Services</em><br />
                  in the Northern Plains
                </h1>
              </a>
              <div className="np-byline" style={{ textAlign: "center" }}>Roger Wilco Aviation Services &middot; FAA Cert. RWSR491E</div>
              <hr className="np-rule" />

              <div className="np-photo-box">
                <div className="np-photo-area">
                  <img
                    src="/newspaper/images/r182_panel.jpg"
                    alt="Cessna 182RG avionics panel"
                  />
                </div>
                <div className="np-photo-cap">
                  Cessna 182RG (N5171S) &mdash; full G500Txi install by Roger Wilco Aviation Services.
                </div>
              </div>

              <p className="np-body-text np-drop">
                Roger Wilco Aviation Services is an FAA-certificated repair station providing full-spectrum airframe, powerplant, avionics, and non-destructive testing services to general aviation, corporate, and commercial operators across the Northern Plains. Operating under Certificate No. RWSR491E, the station is authorized for a complete range of maintenance, repair, and alteration work.
              </p>
              <p className="np-body-text">
                Under the direction of John Halsted &mdash; with more than 40 years of aviation experience &mdash; RWAS delivers sheet metal fabrication, structural repair, and complete Garmin avionics installations including the G3X Touch suite, GTN navigator series, and GFC 500 autopilot.
              </p>

              {/* ── AIRCRAFT 4 SALE FEED ── */}
              <hr className="np-rule-thick" style={{ marginTop: '20px' }} />
              <div className="np-sec-label">Aircraft 4 Sale</div>
              <div id="aircraft-sale-feed" style={{ minHeight: '120px' }}>
                <div style={{ fontFamily: 'Arial,sans-serif', fontSize: '10px', color: '#888', fontStyle: 'italic' }}>Loading listings&hellip;</div>
              </div>
              <div style={{ marginTop: '10px', textAlign: 'center' }}>
                <a href="/aircraft-for-sale" className="np-ad-btn">Browse All Listings &rarr;</a>
                <div style={{ marginTop: '8px', fontFamily: 'Georgia,serif', fontSize: '11.5px', fontStyle: 'italic', color: '#444', textAlign: 'center' }}>
                  <span style={{ fontWeight: 700 }}>Selling?</span> Click the <span style={{ display: 'inline-block', width: '20px', height: '20px', background: '#1a1a1a', color: '#f7f4ef', borderRadius: '50%', textAlign: 'center', lineHeight: '20px', fontSize: '11px', fontStyle: 'normal', fontFamily: 'Georgia,serif', fontWeight: 700 }}>J</span> bubble &mdash; Jerry will walk you through listing your aircraft step by step.
                </div>
              </div>


            </div>

            <div className="np-col-divider" />

            {/* ── RIGHT COLUMN ── */}
            <div className="np-col">
              <div id="blog-articles-feed"></div>

              <hr className="np-rule-thick" />

              <div className="np-photo-box">
                <div className="np-photo-area">
                  <img
                    src="/newspaper/images/laser_cutter.jpg"
                    alt="Industrial fiber laser cutting"
                    style={{ objectPosition: 'center center' }}
                  />
                </div>
                <div className="np-photo-cap">
                  New capability &mdash; fiber laser cutting, welding, and scaling.
                </div>
              </div>

            </div>

          </div>


          {/* ── Lower 4-column services grid ── */}
          <div className="np-lower">

            {/* Papa-Alpha Tools */}
            <div className="np-lower-col">
              <div className="np-sec-label">Papa-Alpha Tools</div>
              <div className="np-svc">
                <div className="np-svc-name">
                  <a href="/collections/rigging-tools">Piper Rigging Reference Tools</a>
                </div>
                <div className="np-svc-desc">
                  Precision flight control rigging tools for Piper PA-28, PA-30, PA-31, PA-36 series. CNC-machined aircraft-grade aluminum, powder coated and UV printed. Sold worldwide.
                </div>
              </div>
              <div className="np-svc">
                <div className="np-svc-name">
                  <a href="/products/rigging-kit">Rigging Kit</a>
                </div>
                <div className="np-svc-desc">Complete rigging kit covering stabilator, rudder, aileron, flap, and bell crank. From $264.</div>
              </div>
              <div className="np-svc">
                <div className="np-svc-name">
                  <a href="/collections/rigging-tools">Individual Tools</a>
                </div>
                <div className="np-svc-desc">Stabilator, rudder, aileron &amp; flap, bell crank, and PA-31/PA-36 specific tools available separately. From $59.99.</div>
              </div>
              <div className="np-svc">
                <div className="np-svc-name">
                  <a href="/collections/rigging-tools">Available At</a>
                </div>
                <div className="np-svc-desc">rogerwilcoaviation.com, Aircraft Spruce, and Amazon (coming soon). Made by professional mechanics for professional mechanics.</div>
              </div>
            </div>

            {/* Avionics */}
            <div className="np-lower-col">
              <div className="np-sec-label">Avionics</div>
              <div className="np-svc">
                <div className="np-svc-name"><a href="/collections/garmin-avionics">G3X Touch Suite</a></div>
                <div className="np-svc-desc">Full glass cockpit with ADAHRS, EIS, and synthetic vision. STC&rsquo;d for most single-engine piston aircraft.</div>
              </div>
              <div className="np-svc">
                <div className="np-svc-name"><a href="/collections/garmin-avionics">GTN 650Xi / 750Xi</a></div>
                <div className="np-svc-desc">GPS/NAV/COMM with WAAS LPV approaches. Full IFR certification and flight plan integration.</div>
              </div>
              <div className="np-svc">
                <div className="np-svc-name"><a href="/collections/garmin-avionics">GFC 500 Autopilot</a></div>
                <div className="np-svc-desc">Retrofit digital autopilot with GPSS steering, altitude hold, and vertical speed modes.</div>
              </div>
              <div className="np-svc">
                <div className="np-svc-name"><a href="/collections/garmin-avionics">ADS-B Out Compliance</a></div>
                <div className="np-svc-desc">FAR 91.227 compliant installations. Transponder upgrades and system certification.</div>
              </div>
            </div>

            {/* Airframe & Powerplant */}
            <div className="np-lower-col">
              <div className="np-sec-label">Airframe &amp; Powerplant</div>
              <div className="np-svc">
                <div className="np-svc-name"><a href="/shop-capabilities">Annual Inspections</a></div>
                <div className="np-svc-desc">Thorough airworthiness inspections per FAR 43. Discrepancy reports and return-to-service documentation.</div>
              </div>
              <div className="np-svc">
                <div className="np-svc-name"><a href="/shop-capabilities">100-Hour Inspections</a></div>
                <div className="np-svc-desc">For aircraft operated for hire under 14 C.F.R. Part 91 and Part 135 requirements.</div>
              </div>
              <div className="np-svc">
                <div className="np-svc-name"><a href="/shop-capabilities">Sheet Metal &amp; Fabrication</a></div>
                <div className="np-svc-desc">Structural repair, skin replacement, and custom fabrication in aircraft-grade aluminum alloys.</div>
              </div>
              <div className="np-svc">
                <div className="np-svc-name"><a href="/shop-capabilities">Engine Troubleshooting</a></div>
                <div className="np-svc-desc">Powerplant diagnostics, mag checks, compression testing, and engine runs.</div>
              </div>
            </div>

            {/* NDT & Certification */}
            <div className="np-lower-col">
              <div className="np-sec-label">NDT &amp; Certification</div>
              <div className="np-svc">
                <div className="np-svc-name"><a href="/shop-capabilities">Eddy Current Inspection</a></div>
                <div className="np-svc-desc">Subsurface crack and corrosion detection in aluminum and ferrous components without disassembly.</div>
              </div>
              <div className="np-svc">
                <div className="np-svc-name"><a href="/shop-capabilities">Dye Penetrant Testing</a></div>
                <div className="np-svc-desc">Surface crack detection per ASTM E1417 for engine components, castings, and structural parts.</div>
              </div>
              <div className="np-svc">
                <div className="np-svc-name"><a href="/pages/about">Certified Repair Station</a></div>
                <div className="np-svc-desc">FAA Certificate RWSR491E. All work by certificated mechanics with full logbook documentation.</div>
              </div>
              <div className="np-ornament">&#9670; &nbsp; &#9670; &nbsp; &#9670;</div>
              <div className="np-schedule-cta">
                <div className="np-schedule-cta-label">Schedule your inspection today</div>
                <div className="np-schedule-cta-actions">
                  <a href="tel:+16052998178" className="np-schedule-cta-btn np-schedule-cta-btn-primary">Call (605) 299-8178</a>
                  <a href="/about#contact" className="np-schedule-cta-btn np-schedule-cta-btn-secondary">Request a Quote</a>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* ── Credentials ── */}
          <div className="np-credentials-bar">
            NBAA Member &nbsp;&middot;&nbsp; AEA Member &nbsp;&middot;&nbsp; Certified &amp; Trained
          </div>

        {/* ── Footer ── */}
        <div className="np-footer">
          <span className="np-footer-name">Roger Wilco Aviation Services</span>
          <span>
            &copy; 2026 RWAS &middot; All Rights Reserved
            <a href="https://sale-api.rogerwilcoaviation.com/admin" style={{color:'#666',textDecoration:'none',marginLeft:'8px'}}>Admin</a>
          </span>
        </div>

      </div>
    </div>
        <script dangerouslySetInnerHTML={{__html: `
(function(){
  var feed = document.getElementById('aircraft-sale-feed');
  if (!feed) return;
  fetch('https://sale-api.rogerwilcoaviation.com/browse')
    .then(function(r){ return r.json(); })
    .then(function(data){
      var listings = (data.listings || []).slice(0, 4);
      if (!listings.length) {
        feed.innerHTML = '<div style="font-style:italic;font-size:11.5px;color:#888;padding:8px 0">No aircraft currently listed. <a href=\\"/aircraft-for-sale#sell\\" style=\\"color:#1a1a1a;text-decoration:underline\\">List yours today.</a></div>';
        return;
      }
      feed.innerHTML = listings.map(function(l){
        var price = l.price ? '$' + parseInt(String(l.price).replace(/[^0-9]/g,'')).toLocaleString() : 'Call';
        var lbCount = l.logbooks ? Object.values(l.logbooks).reduce(function(s,a){ return s + (a?a.length:0); }, 0) : 0;
        var photo = l.photos && l.photos.length ? '<img src=\\"https://sale-api.rogerwilcoaviation.com/files/' + l.photos[0].key + '\\" alt=\\"' + l.make + ' ' + l.model + '\\" style=\\"width:100%;height:100%;object-fit:cover\\">' : '<div style=\\"display:flex;align-items:center;justify-content:center;height:100%;font-family:Arial,sans-serif;font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.1em\\">No Photo</div>';
        return '<a href=\\"/aircraft-for-sale#listing/' + l.id + '\\" style=\\"display:grid;grid-template-columns:100px 1fr;gap:10px;padding:10px 0;border-bottom:1px solid #1a1a1a;text-decoration:none;color:#1a1a1a\\"><div style=\\"width:100px;height:70px;background:#c8c4bc;border:1px solid #1a1a1a;overflow:hidden\\">' + photo + '</div><div style=\\"display:flex;flex-direction:column;justify-content:space-between\\"><div><div style=\\"font-family:Arial,sans-serif;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#555\\">' + (l.year||'') + ' \\u00b7 ' + (l.category||'').replace(/-/g,' ') + '</div><div style=\\"font-size:15px;font-weight:700;line-height:1.2;margin:2px 0\\">' + l.make + ' ' + l.model + '</div></div><div style=\\"display:flex;justify-content:space-between;align-items:flex-end\\"><div style=\\"font-family:Georgia,serif;font-size:16px;font-weight:700\\">' + price + '</div>' + (lbCount ? '<div style=\\"font-family:Arial,sans-serif;font-size:8px;color:#2d5016;text-transform:uppercase;letter-spacing:.06em\\">\\u2713 ' + lbCount + ' logbook doc' + (lbCount>1?'s':'') + '</div>' : '') + '</div></div></a>';
      }).join('');
    })
    .catch(function(){
      feed.innerHTML = '<div style=\\"font-style:italic;font-size:11.5px;color:#888\\">Could not load listings.</div>';
    });
})();
    `}} />

    <script dangerouslySetInnerHTML={{__html: `
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
        html += '<span class="np-kicker">' + label + '</span>';
        html += '<a href="' + url + '" class="np-headline-link"><h3 class="np-headline-md">' + a.title + '</h3></a>';
        html += '<hr class="np-rule" />';
        html += '<p class="np-body-text">' + a.lead.substring(0, 200) + (a.lead.length > 200 ? '&hellip;' : '') + '</p>';
        if (i < articles.length - 1) html += '<hr class="np-rule-thick" />';
      });
      el.innerHTML = html;
    })
    .catch(function() {});
})();
    `}} />
    </>
  );
}
