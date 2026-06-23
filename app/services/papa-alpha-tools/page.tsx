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
import { PapaAlphaLaunchFrame } from '@/components/shared/PapaAlphaLaunchFrame';
import Link from 'next/link';

const pageUrl = 'https://www.rogerwilcoaviation.com/services/papa-alpha-tools';
const collectionUrl = 'https://www.rogerwilcoaviation.com/collections/papa-alpha-tools';

export const metadata = {
  title: { absolute: 'Papa-Alpha Piper Rigging Tools - PA-28, PA-30, PA-31, PA-36 | RWAS' },
  description:
    'Papa-Alpha Piper rigging tools from RWAS: CNC-machined reference tools for PA-28, PA-30, PA-31, and PA-36 flight-control rigging work.',
  alternates: { canonical: pageUrl },
};

export default function PapaAlphaToolsPage() {
  return (
    <BroadsheetLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'WebPage',
                '@id': `${pageUrl}#webpage`,
                url: pageUrl,
                name: 'Papa-Alpha Piper Rigging Tools',
                description:
                  'Story and product-family page for Papa-Alpha Piper rigging tools designed and manufactured by Roger Wilco Aviation Services.',
                mainEntity: { '@id': `${pageUrl}#brand` },
              },
              {
                '@type': 'Brand',
                '@id': `${pageUrl}#brand`,
                name: 'Papa-Alpha Tools',
                url: pageUrl,
                logo: 'https://www.rogerwilcoaviation.com/newspaper/images/logo.png',
                description:
                  'Precision Piper rigging reference tools designed and manufactured by Roger Wilco Aviation Services in the Northern Plains.',
              },
              {
                '@type': 'ItemList',
                '@id': `${pageUrl}#tool-family`,
                name: 'Papa-Alpha Piper rigging tool family',
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: 'Stabilator rigging tool', url: 'https://www.rogerwilcoaviation.com/products/stabilator-rigging-tool' },
                  { '@type': 'ListItem', position: 2, name: 'Rudder rigging tool', url: 'https://www.rogerwilcoaviation.com/products/rudder-rigging-tool' },
                  { '@type': 'ListItem', position: 3, name: 'Bell crank rigging tool', url: 'https://www.rogerwilcoaviation.com/products/bell-crank-rigging-tool' },
                  { '@type': 'ListItem', position: 4, name: 'Papa-Alpha rigging kit', url: 'https://www.rogerwilcoaviation.com/products/rigging-kit' },
                ],
              },
              {
                '@type': 'BreadcrumbList',
                '@id': `${pageUrl}#breadcrumb`,
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.rogerwilcoaviation.com/' },
                  { '@type': 'ListItem', position: 2, name: 'Services', item: 'https://www.rogerwilcoaviation.com/services' },
                  { '@type': 'ListItem', position: 3, name: 'Papa-Alpha Tools', item: pageUrl },
                ],
              },
            ],
          }),
        }}
      />

      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref="/collections/papa-alpha-tools" />
      <CredentialsBar />
      <BulletinBar />

      <main className="bs-stage">
        <section className="hero-headline-group" aria-labelledby="pa-hero">
          <span className="bs-kicker">Papa-Alpha Tools &middot; Piper Rigging References</span>
          <span className="bs-script-accent">&mdash; designed and manufactured in-house &mdash;</span>
          <h1 id="pa-hero" className="bs-headline bs-headline--hero">
            Piper rigging tools,
            <br />
            <em>made by mechanics.</em>
          </h1>
          <p className="bs-subhead">
            Stabilator &middot; rudder &middot; aileron &middot; flap &middot; bell crank references for PA-series maintenance work
          </p>
          <div className="bs-byline">
            Built by Roger Wilco Aviation Services &middot; FAA Part 145 Repair Station RWSR491E &middot; the Northern Plains
          </div>
        </section>

        <div className="about-grid">
          <div className="about-main">
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Why They Exist</span>
              <h2 className="bs-headline bs-headline--section">Replace hangar-floor guesswork with repeatable references.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Papa-Alpha Tools grew out of real Piper maintenance work. Flight-control rigging is one of those jobs where a small amount of ambiguity can turn into a large amount of time: improvised fixtures, hard-to-read reference points, repeated checks, and shop notes that make sense only to the person who wrote them.
                </p>
                <p>
                  RWAS built Papa-Alpha as a practical answer to that problem. These are aircraft-grade aluminum reference tools for Piper PA-series control-surface rigging tasks, designed by mechanics who wanted lighter, readable, repeatable tools that could live in a working shop instead of a display case.
                </p>
              </div>
            </Specimen>

            <Specimen variant="hero" as="figure" className="about-fig">
              <Specimen.Image
                src="/newspaper/images/papa_alpha_kit_collection.webp"
                alt="Papa-Alpha Piper rigging tools laid out as a kit"
              />
              <Specimen.CaptionRule />
              <Specimen.Caption numeral="FIG. 01">
                Papa-Alpha rigging reference tools - designed and manufactured by RWAS in the Northern Plains.
              </Specimen.Caption>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Launch Animation</span>
              <h2 className="bs-headline bs-headline--section">Complete Piper rigging kits, in motion.</h2>
              <hr className="section-rule" />
              <PapaAlphaLaunchFrame />
              <div className="bs-body">
                <p>
                  A launch piece for the Papa-Alpha complete Piper rigging kit line, packaged as a self-hosted animation
                  for review and presentation use.
                </p>
              </div>
              <p>
                <Link className="bs-cta-secondary" href="/collections/papa-alpha-tools">
                  Shop Papa-Alpha tools
                </Link>
              </p>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Aircraft Families</span>
              <h2 className="bs-headline bs-headline--section">Built around Piper PA-series rigging work.</h2>
              <hr className="section-rule" />
              <div className="bs-split">
                <div className="bs-body">
                  <p>
                    The Papa-Alpha line supports common Piper rigging reference tasks across PA-28, PA-30, PA-31, PA-32, PA-34, PA-36, PA-39, and PA-44 families, depending on the specific tool. The live product page controls exact applicability, kit contents, and current pricing.
                  </p>
                  <p>
                    Tools are intended for qualified maintenance personnel using the applicable Piper maintenance data. They do not replace the maintenance manual; they make the physical reference work more consistent.
                  </p>
                </div>
                <ul className="bs-svc-list">
                  <li className="bs-svc">
                    <p className="bs-svc-name">PA-28 / PA-32 / PA-34 / PA-44</p>
                    <p className="bs-svc-desc">Aileron and flap reference tooling where applicable.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">PA-30 / PA-39</p>
                    <p className="bs-svc-desc">Twin Comanche aileron reference tooling.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">PA-31</p>
                    <p className="bs-svc-desc">Aileron, elevator, and rudder-trim reference tools.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">PA-36</p>
                    <p className="bs-svc-desc">Flap reference tooling for Pawnee Brave applications.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Rudder, stabilator, and bell crank tools</p>
                    <p className="bs-svc-desc">Individual references and kit options available from the live collection.</p>
                  </li>
                </ul>
              </div>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Manufacturing</span>
              <h2 className="bs-headline bs-headline--section">CAD, CNC, fiber laser, powder coat, UV print.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Papa-Alpha tools are designed and manufactured in-house by RWAS using CAD, CNC routing, fiber laser cutting, powder coating, and UV printing. The goal is simple: keep the tool light enough to handle, durable enough for repeated shop use, and readable enough that the reference markings survive normal maintenance work.
                </p>
                <p>
                  That manufacturing loop matters because RWAS is not just reselling a generic fixture. The same shop that uses Part 145 discipline for avionics, airframe, NDT, and fabrication work controls the tool design, production, labeling, and live inventory path.
                </p>
              </div>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Order Direct</span>
              <h2 className="bs-headline bs-headline--section">Live collection, current pricing, direct checkout.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  The Papa-Alpha collection is the source of truth for current product availability, model applicability, kit contents, and pricing. Individual tools and kit options can be ordered directly through the RWAS store, with fulfillment from the RWAS shop.
                </p>
                <p>
                  Shops ordering for a specific aircraft should confirm the aircraft model, serial applicability, and maintenance data before purchase. If you are not sure which tool applies, contact RWAS with the aircraft model and the rigging task you are trying to perform.
                </p>
              </div>
              <p>
                <Link className="bs-cta-primary" href="/collections/papa-alpha-tools">
                  Shop Papa-Alpha tools
                </Link>
                <Link className="bs-cta-secondary" href="/contact?reason=papa-alpha&source=papa-alpha-service">
                  Ask about applicability
                </Link>
              </p>
            </Specimen>
          </div>

          <aside className="about-rail" aria-label="Papa-Alpha quick reference">
            <Specimen as="section">
              <span className="bs-kicker">Tool Family</span>
              <p>
                Piper PA-series rigging references
                <br />
                Stabilator
                <br />
                Rudder
                <br />
                Aileron
                <br />
                Flap
                <br />
                Bell crank
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Shop Built</span>
              <p>
                CAD design
                <br />
                CNC routing
                <br />
                Fiber laser cutting
                <br />
                Powder coating
                <br />
                UV-printed markings
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Order Path</span>
              <p>
                <Link
                  href="/collections/papa-alpha-tools"
                  style={{ color: 'var(--ink-900)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                >
                  Live Papa-Alpha collection
                </Link>
                <br />
                Ships from the Northern Plains
                <br />
                Phone: <a href="tel:+16052998178">(605) 299-8178</a>
              </p>
            </Specimen>

            <Specimen variant="hero" as="figure" className="about-fig about-fig--rail">
              <Specimen.Image
                src="/brochures/papa-alpha-tools/images/kit-aileron-flap.jpg"
                alt="Papa-Alpha aileron and flap rigging reference tool"
              />
              <Specimen.CaptionRule />
              <Specimen.Caption numeral="FIG. 02">
                Aileron and flap reference tooling from the Papa-Alpha line.
              </Specimen.Caption>
            </Specimen>

            <Specimen variant="hero" as="figure" className="about-fig about-fig--rail">
              <Specimen.Image
                src="/brochures/papa-alpha-tools/images/stabilator.jpg"
                alt="Papa-Alpha stabilator rigging reference tool"
              />
              <Specimen.CaptionRule />
              <Specimen.Caption numeral="FIG. 03">
                Stabilator reference tool with durable shop-readable markings.
              </Specimen.Caption>
            </Specimen>

            <div className="jerry-card">
              <span className="bs-script-accent">&mdash; tool desk &mdash;</span>
              <h4>Which tool fits?</h4>
              <p>Send the Piper model and the rigging task.</p>
              <Link className="cta" href="/contact?reason=papa-alpha&source=papa-alpha-card">
                Ask RWAS
              </Link>
              <div className="footnote">Verify applicability before ordering.</div>
            </div>
          </aside>
        </div>
      </main>

      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
