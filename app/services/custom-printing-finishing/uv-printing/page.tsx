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
import FinishingInquiry from '@/components/custom-finishing/FinishingInquiry';
import { ServiceStructuredData } from '@/components/services/ServiceStructuredData';
import '../custom-finishing.css';
export const metadata = genPageMetadata({
  title: 'UV Printing in Yankton, SD | RWAS',
  description:
    'Request UV printing in Yankton, SD for aircraft panel graphics, labels, branded pieces, and decorative parts. Surface and artwork reviewed before quoting.',
  canonical:
    'https://www.rogerwilcoaviation.com/services/custom-printing-finishing/uv-printing',
});
export default function Page() {
  return (
    <BroadsheetLayout>
      <ServiceStructuredData
        name="UV Printing"
        description="UV printing in Yankton for full-color graphics, labels, personalization, and shop markings on primarily flat surfaces, subject to material and preparation review."
        path="/services/custom-printing-finishing/uv-printing"
        parent={{
          name: 'UV Printing & Powder Coating',
          path: '/services/custom-printing-finishing',
        }}
      />
      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref="/services" />
      <CredentialsBar />
      <BulletinBar />
      <main id="main-content" tabIndex={-1} className="bs-stage">
        <section className="finishing-hero">
          <span className="finishing-eyebrow">
            UV printing &amp; powder coating
          </span>
          <p className="bs-script-accent">— UV printing —</p>
          <h1 className="bs-headline bs-headline--hero">UV Printing</h1>
          <p className="bs-subhead">
            Full-color graphics, labels, personalization, and shop markings on
            primarily flat surfaces. Material suitability and preparation are
            confirmed before quoting.
          </p>
          <div className="finishing-actions">
            <a href="#inquiry">Ask About UV Printing</a>
            <a href="#inquiry">Request a Printing Quote</a>
          </div>
          <p className="finishing-planner-link">
            <strong>Planning a full aircraft panel?</strong> Use our{' '}
            <Link href="/panel-planner">Full Panel Planner</Link>.
          </p>
        </section>
        <nav
          className="finishing-subnav"
          aria-label="Printing and coating pages"
        >
          <Link href="/services/custom-printing-finishing">Overview</Link>
          <span aria-current="page">UV printing</span>
          <Link href="/services/custom-printing-finishing/powder-coating">
            Powder coating
          </Link>
        </nav>
        <section className="finishing-detail-grid">
          <div>
            <span className="bs-kicker">What to provide</span>
            <h2 className="bs-headline bs-headline--section">
              The item, its use, and the artwork.
            </h2>
            <p>
              UV-printing compatibility depends on the actual surface, coating,
              geometry, preparation, and intended use. A hard, flat surface may
              be a useful starting point, but compatibility is not assumed.
            </p>
            <ul>
              <li>Overall dimensions, including height—not only face size</li>
              <li>Material and any existing coating or treatment</li>
              <li>Quantity and desired visible print area</li>
              <li>Artwork files, text, colors, or a simple sketch</li>
              <li>Aviation installation context, if any</li>
            </ul>
          </div>
          <dl className="finishing-facts">
            <dt>Confirmed today</dt>
            <dd>RWAS is evaluating primarily flat-surface printing work.</dd>
            <dt>Confirmed during review</dt>
            <dd>
              Material suitability, preparation, usable print area, height
              clearance, artwork readiness, schedule, and price.
            </dd>
            <dt>Not implied</dt>
            <dd>
              Any specific bed size, printable area, adhesion result, outdoor
              durability, or aircraft approval.
            </dd>
          </dl>
        </section>
        <div className="finishing-caveat">
          <strong>Capacity terminology matters:</strong> machine bed size is not
          automatically the printable area, and machine height clearance is not
          automatically usable part height. Exact limits will be published only
          after the printer identity and shop setup are verified.
        </div>
        <FinishingInquiry defaultService="UV printing" />
      </main>
      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
