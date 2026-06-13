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
import Link from 'next/link';

const pageUrl = 'https://www.rogerwilcoaviation.com/services/pre-buy-inspection';

export const metadata = {
  title: { absolute: 'Aircraft Pre-Buy Inspection | RWAS' },
  description:
    'Aircraft pre-buy inspection support in the Northern Plains: logbook review, physical inspection, avionics review, NDT coordination, and buyer guidance.',
  alternates: { canonical: pageUrl },
};

export default function PreBuyInspectionPage() {
  return (
    <BroadsheetLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'Service',
                '@id': `${pageUrl}#service`,
                name: 'Aircraft Pre-Buy Inspection',
                serviceType: 'Aircraft pre-purchase inspection',
                url: pageUrl,
                provider: { '@id': 'https://www.rogerwilcoaviation.com#organization' },
                areaServed: [
                  { '@type': 'State', name: 'South Dakota' },
                  { '@type': 'State', name: 'Nebraska' },
                  { '@type': 'State', name: 'Iowa' },
                  { '@type': 'State', name: 'Minnesota' },
                  { '@type': 'State', name: 'North Dakota' },
                ],
                description:
                  'Aircraft pre-buy inspection support, logbook review, physical inspection, avionics review, NDT coordination, and buyer decision support from Roger Wilco Aviation Services for the Northern Plains.',
                hasOfferCatalog: {
                  '@type': 'OfferCatalog',
                  name: 'Pre-buy inspection services',
                  itemListElement: [
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Aircraft Logbook Review' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Physical Condition Inspection' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Avionics and Panel Review' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'NDT Inspection Coordination' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Discrepancy Summary and Buyer Decision Support' } },
                  ],
                },
              },
              {
                '@type': 'BreadcrumbList',
                '@id': `${pageUrl}#breadcrumb`,
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.rogerwilcoaviation.com/' },
                  { '@type': 'ListItem', position: 2, name: 'Services', item: 'https://www.rogerwilcoaviation.com/services' },
                  { '@type': 'ListItem', position: 3, name: 'Aircraft for Sale', item: 'https://www.rogerwilcoaviation.com/aircraft-for-sale' },
                  { '@type': 'ListItem', position: 4, name: 'Aircraft Pre-Buy Inspection', item: pageUrl },
                ],
              },
            ],
          }),
        }}
      />

      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref="/aircraft-for-sale" />
      <CredentialsBar />
      <BulletinBar />

      <main className="bs-stage">
        <section className="hero-headline-group" aria-labelledby="prebuy-hero">
          <span className="bs-kicker">FAA Part 145 Repair Station &middot; Buyer-Side Aircraft Review</span>
          <span className="bs-script-accent">&mdash; know what you are buying before the wire clears &mdash;</span>
          <h1 id="prebuy-hero" className="bs-headline bs-headline--hero">
            Aircraft pre-buy inspections,
            <br />
            <em>for buyers who want facts before feelings.</em>
          </h1>
          <p className="bs-subhead">
            Logbooks &middot; physical condition &middot; avionics &middot; NDT coordination &middot; discrepancy summary &middot; buyer decision support
          </p>
          <div className="bs-byline">
            RWAS Avionics Desk &middot; Supporting buyers across SD &middot; NE &middot; IA &middot; MN &middot; ND
          </div>
        </section>

        <div className="about-grid">
          <div className="about-main">
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Buyer Protection</span>
              <h2 className="bs-headline bs-headline--section">A pre-buy is not an annual. It is a decision tool.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  A pre-buy inspection exists to help a buyer understand risk before closing on an aircraft. It is not a substitute for an annual inspection, and it is not a guarantee that every future problem has been found. It is a focused look at records, condition, systems, obvious airworthiness concerns, and cost drivers that can materially change the purchase decision.
                </p>
                <p>
                  Roger Wilco Aviation Services performs pre-buy support from an FAA Part 145 repair-station environment for the Northern Plains. That matters when a purchase question crosses airframe, avionics, NDT, logbook, structural, or documentation boundaries.
                </p>
              </div>
            </Specimen>

            <Specimen variant="hero" as="figure" className="about-fig">
              <Specimen.Image
                src="/images/blog/repair-station-vs-ap-mechanic-corporate-hangar-1.jpg"
                alt="Aircraft in a hangar during inspection workflow"
              />
              <Specimen.CaptionRule />
              <Specimen.Caption numeral="FIG. 01">
                A useful pre-buy turns aircraft condition, records, and open questions into a decision the buyer can act on.
              </Specimen.Caption>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Inspection Scope</span>
              <h2 className="bs-headline bs-headline--section">Records first, then the airplane.</h2>
              <hr className="section-rule" />
              <div className="bs-split">
                <div className="bs-body">
                  <p>
                    The best pre-buy starts before the aircraft arrives. Logbooks, equipment lists, photos, damage history, AD status, service-bulletin concerns, and recent invoices tell the shop where to look and which questions need a firm answer.
                  </p>
                </div>
                <ul className="bs-svc-list">
                  <li className="bs-svc">
                    <p className="bs-svc-name">Logbook and records review</p>
                    <p className="bs-svc-desc">Inspection status, major repairs, STC history, AD/SB concerns, recurring discrepancies, and gaps in documentation.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Physical condition check</p>
                    <p className="bs-svc-desc">Airframe, engine-area, systems, obvious corrosion or damage signs, and condition items visible within the agreed scope.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Avionics and panel review</p>
                    <p className="bs-svc-desc">Installed equipment, upgrade potential, database/connectivity questions, wiring concerns, and Garmin-path implications.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">NDT coordination</p>
                    <p className="bs-svc-desc">Eddy current, penetrant, magnetic particle, ultrasound, or other inspection support when a known risk area deserves more than a visual look.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Discrepancy summary</p>
                    <p className="bs-svc-desc">Practical findings framed around risk, likely cost drivers, and buyer decision points.</p>
                  </li>
                </ul>
              </div>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Marketplace Tie-In</span>
              <h2 className="bs-headline bs-headline--section">RWAS listings can move straight into a pre-buy conversation.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  The RWAS aircraft marketplace is built around cleaner listings, photos, and logbook upload paths. When a buyer wants more than listing copy, RWAS can help scope a pre-buy inspection around that exact aircraft. Sellers and buyers still control the transaction; RWAS provides inspection support when requested.
                </p>
                <p>
                  A pre-buy is most useful when the buyer, seller, and shop agree on the scope before the inspection begins. That prevents the common failure mode where everyone assumes a different level of review and nobody likes the invoice.
                </p>
              </div>
              <p>
                <Link className="bs-cta-primary" href="/aircraft-for-sale">
                  Browse aircraft listings
                </Link>
                <Link className="bs-cta-secondary" href="/contact?reason=service&source=pre-buy-marketplace">
                  Ask about a listing pre-buy
                </Link>
              </p>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Start a Pre-Buy Request</span>
              <h2 className="bs-headline bs-headline--section">Send the aircraft, location, records, and deadline.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Useful pre-buy requests include the aircraft make/model, N-number, current location, seller contact path, asking price if relevant, target closing date, logbook PDFs or photos, recent inspection status, known squawks, damage history if disclosed, and the buyer questions that would change the deal.
                </p>
              </div>
              <p>
                <Link className="bs-cta-primary" href="/contact?reason=service&source=pre-buy-inspection">
                  Request pre-buy inspection
                </Link>
                <Link className="bs-cta-secondary" href="/services/aircraft-maintenance">
                  Aircraft maintenance services
                </Link>
              </p>
            </Specimen>
          </div>

          <aside className="about-rail" aria-label="Pre-buy inspection quick reference">
            <Specimen as="section">
              <span className="bs-kicker">Quick Contact</span>
              <p>
                <a
                  href="tel:+16052998178"
                  style={{ color: 'var(--ink-900)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                >
                  (605) 299-8178
                </a>
                <br />
                <a
                  href="mailto:avionics@rwas.team"
                  style={{ color: 'var(--ink-900)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                >
                  avionics@rwas.team
                </a>
                <br />
                RWAS Avionics Desk
                <br />
                the Northern Plains
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Buyer Questions</span>
              <p>
                What is undocumented?
                <br />
                What is due soon?
                <br />
                What is expensive?
                <br />
                What needs NDT?
                <br />
                What changes the deal?
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Bring to Request</span>
              <p>
                N-number
                <br />
                Listing URL
                <br />
                Logbooks
                <br />
                Seller contact
                <br />
                Closing timeline
                <br />
                Buyer concerns
              </p>
            </Specimen>

            <div className="jerry-card">
              <span className="bs-script-accent">&mdash; buyer desk &mdash;</span>
              <h4>Looking at an aircraft?</h4>
              <p>Send the listing, records, and what would change your offer.</p>
              <a className="cta" href="/contact?reason=service&source=pre-buy-card">
                Start pre-buy request
              </a>
              <div className="footnote">Scope is agreed before inspection work begins.</div>
            </div>
          </aside>
        </div>
      </main>

      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
