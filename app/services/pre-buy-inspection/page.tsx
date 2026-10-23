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
import { genPageMetadata } from '@/app/seo';

const pageUrl =
  'https://www.rogerwilcoaviation.com/services/pre-buy-inspection';

export const metadata = genPageMetadata({
  title: 'Pre-Buy Facility Recommendations | RWAS',
  description:
    'RWAS does not perform pre-buy inspections or vet seller aircraft. Contact us for a recommendation for an independent pre-buy inspection facility.',
  canonical: pageUrl,
});

export default function PreBuyReferralPage() {
  return (
    <BroadsheetLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            '@id': pageUrl,
            url: pageUrl,
            name: 'Pre-Buy Facility Recommendations',
            description:
              'RWAS can recommend an independent pre-buy facility. RWAS does not perform pre-buy inspections or vet seller aircraft.',
          }),
        }}
      />
      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref="/aircraft-for-sale" />
      <CredentialsBar />
      <BulletinBar />
      <main id="main-content" tabIndex={-1} className="bs-stage">
        <section className="hero-headline-group" aria-labelledby="prebuy-hero">
          <span className="bs-kicker">Aircraft Buyer Resources</span>
          <h1 id="prebuy-hero" className="bs-headline bs-headline--hero">
            Find an independent pre-buy facility.
          </h1>
          <p className="bs-subhead">
            We can recommend a facility for your pre-buy inspection. RWAS does
            not offer pre-buy inspections or vet seller aircraft.
          </p>
          <div className="bs-byline">
            Roger Wilco Aviation Services &middot; KYKN, Yankton
          </div>
        </section>
        <Specimen as="section">
          <h2 className="bs-headline bs-headline--section">
            A connection to the right facility
          </h2>
          <hr className="section-rule" />
          <div className="bs-body">
            <p>
              Tell us the aircraft make and model, its location, and your
              purchase timeline. We can recommend an independent facility for
              you to contact about availability, inspection scope, and pricing.
              You arrange the inspection directly with that facility.
            </p>
            <p>
              RWAS is an FAA Part 145 repair station. Our Aviation Exchange
              marketplace helps owners and buyers connect; a listing is not an
              RWAS inspection, condition assessment, or endorsement of an
              aircraft. Buyers should verify listing details and arrange their
              own independent inspection before completing a purchase.
            </p>
          </div>
          <p>
            <Link
              className="bs-cta-primary"
              href="/contact?reason=service&source=pre-buy-facility-referral"
            >
              Ask for a Facility Recommendation
            </Link>
          </p>
          <p>
            Call <a href="tel:+16052998178">(605) 299-8178</a> or{' '}
            <Link href="/aircraft-for-sale">browse Aviation Exchange</Link>.
          </p>
        </Specimen>
      </main>
      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
