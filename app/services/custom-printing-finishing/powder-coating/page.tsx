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
import '../custom-finishing.css';
export const metadata = genPageMetadata({
  title: 'Powder Coating | RWAS',
  description:
    'Powder coating inquiries for reviewed aviation shop and decorative work.',
  canonical:
    'https://www.rogerwilcoaviation.com/services/custom-printing-finishing/powder-coating',
});
export default function Page() {
  return (
    <BroadsheetLayout>
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
          <p className="bs-script-accent">— powder coating —</p>
          <h1 className="bs-headline bs-headline--hero">Powder Coating</h1>
          <p className="bs-subhead">
            Coating review for fabricated metal items, shop pieces, decorative
            hardware, and coat-and-print work. Material, preparation,
            dimensions, and finish are confirmed before quoting.
          </p>
          <div className="finishing-actions">
            <a href="#inquiry">Ask About Powder Coating</a>
            <a href="#inquiry">Request a Coating Quote</a>
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
          <Link href="/services/custom-printing-finishing/uv-printing">
            UV printing
          </Link>
          <span aria-current="page">Powder coating</span>
        </nav>
        <section className="finishing-detail-grid">
          <div>
            <span className="bs-kicker">What to provide</span>
            <h2 className="bs-headline bs-headline--section">
              Part details before color choices.
            </h2>
            <p>
              A useful coating inquiry starts with the part material, complete
              dimensions, current condition, intended use, and desired
              appearance. Preparation methods and finish availability remain
              item-specific until reviewed.
            </p>
            <ul>
              <li>Overall length, width, and height</li>
              <li>
                Material, welds, inserts, masking needs, and existing finish
              </li>
              <li>Quantity and desired color, sheen, or texture</li>
              <li>Environmental or service context</li>
              <li>Aviation installation and applicable-data context, if any</li>
            </ul>
          </div>
          <dl className="finishing-facts">
            <dt>Potential work types</dt>
            <dd>
              Fabricated shop parts, samples, display pieces, decorative
              hardware, and combined coat-and-print concepts.
            </dd>
            <dt>Confirmed during review</dt>
            <dd>
              Material fit, preparation, masking, finish availability, oven
              capacity, schedule, and price.
            </dd>
            <dt>Not implied</dt>
            <dd>
              Any maximum part size, finish inventory, lead time,
              structural-part suitability, or aircraft approval.
            </dd>
          </dl>
        </section>
        <div className="finishing-caveat">
          <strong>Aviation and automotive caution:</strong> generic
          powder-coating capability does not establish approval for structural,
          flight-critical, heat-sensitive, threaded, fatigue-sensitive, or
          otherwise controlled components. Applicable data and part-specific
          review come first.
        </div>
        <FinishingInquiry defaultService="Powder coating" />
      </main>
      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
