import Link from 'next/link';
import {
  BroadsheetLayout,
  Dateline,
  Masthead,
  BroadsheetNav,
  CredentialsBar,
  BulletinBar,
  BroadsheetFooter,
} from '@/components/shared/broadsheet';
import { genPageMetadata } from '@/app/seo';
import FinishingGallery from '@/components/custom-finishing/FinishingGallery';
import FinishingInquiry from '@/components/custom-finishing/FinishingInquiry';
import { ServiceStructuredData } from '@/components/services/ServiceStructuredData';
import './custom-finishing.css';
export const metadata = genPageMetadata({
  title: 'UV Printing & Powder Coating in Yankton, SD | RWAS',
  description:
    'Request UV printing and powder coating in Yankton, SD for aircraft panels, metal parts, branded pieces, and decorative work. Materials reviewed before quoting.',
  canonical:
    'https://www.rogerwilcoaviation.com/services/custom-printing-finishing',
});
export default function Page() {
  return (
    <BroadsheetLayout>
      <ServiceStructuredData
        name="UV Printing & Powder Coating"
        description="UV printing and powder coating services in Yankton for aviation shop work, branded pieces, and decorative items, subject to material and application review."
        path="/services/custom-printing-finishing"
      />
      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref="/services" />
      <CredentialsBar />
      <BulletinBar />
      <main id="main-content" tabIndex={-1} className="bs-stage">
        <section className="finishing-hero" aria-labelledby="finishing-title">
          <span className="finishing-eyebrow">Specialized shop services</span>
          <p className="bs-script-accent">— color, graphics &amp; finish —</p>
          <h1 id="finishing-title" className="bs-headline bs-headline--hero">
            UV Printing &amp;
            <br />
            <em>Powder Coating</em>
          </h1>
          <p className="bs-subhead">
            Printing and coating inquiries for aviation shop work, branded
            pieces, and decorative items. Primarily flat surfaces. Material
            suitability and preparation are confirmed before quoting.
          </p>
          <div className="finishing-actions">
            <a href="#inquiry">Ask About UV Printing &amp; Powder Coating</a>
            <a href="#inquiry">Request a Printing or Coating Quote</a>
          </div>
          <p className="finishing-planner-link">
            <strong>Planning a full aircraft panel?</strong> Use our{' '}
            <Link href="/panel-planner">Full Panel Planner</Link>.
          </p>
        </section>
        <div
          className="finishing-trust-strip"
          aria-label="Important service notes"
        >
          <p>Compatibility review before a quote</p>
          <p>Aviation and non-aviation inquiries welcome</p>
          <p>No instant pricing or unverified capacity claims</p>
        </div>
        <section
          className="finishing-services"
          aria-label="Printing and coating services"
        >
          <article className="finishing-service-card">
            <span className="bs-kicker">Direct-to-surface color</span>
            <h2 className="bs-headline bs-headline--section">UV Printing</h2>
            <p>
              Explore full-color graphics, labels, personalization, and markings
              on primarily flat parts and samples. Exact material fit,
              preparation, print area, and height clearance are reviewed for
              each item.
            </p>
            <ul>
              <li>Short-run and one-off inquiries</li>
              <li>Aviation samples and decorative work</li>
              <li>Artwork reviewed before production</li>
            </ul>
            <Link href="/services/custom-printing-finishing/uv-printing">
              Explore UV printing →
            </Link>
          </article>
          <article className="finishing-service-card">
            <span className="bs-kicker">Durable color finishes</span>
            <h2 className="bs-headline bs-headline--section">Powder Coating</h2>
            <p>
              Request a coating review for fabricated metal parts, shop items,
              decorative hardware, and combined coat-and-print work. Material,
              preparation, finish, and maximum part size remain subject to shop
              review.
            </p>
            <ul>
              <li>Color and sheen discussion</li>
              <li>Small-batch inquiries</li>
              <li>Optional UV-printing workflow review</li>
            </ul>
            <Link href="/services/custom-printing-finishing/powder-coating">
              Explore powder coating →
            </Link>
          </article>
        </section>
        <div className="finishing-caveat">
          <strong>Aviation note:</strong> a finish being physically possible
          does not make it approved for an aircraft installation. Structural,
          flight-critical, fire-protection, corrosion-protection, or other
          airworthiness-related uses require applicable data and separate
          review.
        </div>
        <section aria-labelledby="process-title">
          <span className="bs-kicker">How an inquiry starts</span>
          <h2 id="process-title" className="bs-headline bs-headline--section">
            Printing and coating details first.
          </h2>
          <div className="finishing-process">
            <div>
              <strong>1 · Describe</strong>
              <span>Object, material, size, quantity, and use.</span>
            </div>
            <div>
              <strong>2 · Share</strong>
              <span>Photos, artwork, colors, and desired finish.</span>
            </div>
            <div>
              <strong>3 · Review</strong>
              <span>
                RWAS confirms fit, preparation, capacity, and applicable
                requirements.
              </span>
            </div>
            <div>
              <strong>4 · Quote</strong>
              <span>Scope, price, and schedule follow only after review.</span>
            </div>
          </div>
        </section>
        <FinishingInquiry />
        <FinishingGallery />
      </main>
      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
