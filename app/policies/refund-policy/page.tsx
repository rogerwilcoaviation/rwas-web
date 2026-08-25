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

export const metadata = genPageMetadata({
  title: 'Return & Refund Policy | Roger Wilco Aviation Services',
  description:
    'Return and refund policy for products purchased from Roger Wilco Aviation Services.',
  canonical: 'https://www.rogerwilcoaviation.com/policies/refund-policy',
});

export default function RefundPolicyPage() {
  return (
    <BroadsheetLayout>
      <Dateline />
      <Masthead />
      <BroadsheetNav />
      <CredentialsBar />
      <BulletinBar />

      <main className="bs-stage">
        <section
          className="hero-headline-group"
          aria-labelledby="refund-policy-hero"
        >
          <span className="bs-kicker">Policies &amp; Notices</span>
          <span className="bs-script-accent">
            &mdash; straightforward returns &mdash;
          </span>
          <h1 id="refund-policy-hero" className="bs-headline bs-headline--hero">
            Return &amp; Refund Policy
          </h1>
          <p className="bs-subhead">
            The terms that apply to eligible product returns.
          </p>
          <div className="bs-byline">Last updated August 25, 2026</div>
        </section>

        <div className="policy-card mx-auto mt-12 mb-8 max-w-screen-md rounded p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold">10-DAY RETURN WINDOW</h2>
          <p className="mb-4">
            You have 10 days after receiving your item to request a return.
          </p>
          <p className="mb-4">
            To be eligible, the item must be in the same condition in which it
            was received: unworn or unused, with tags, and in its original
            packaging. You will also need the receipt or proof of purchase.
          </p>
          <p>
            To request a return, email{' '}
            <a
              className="text-blue-500"
              href="mailto:services@rogerwilcoaviation.com"
            >
              services@rogerwilcoaviation.com
            </a>
            . Items sent back without first requesting a return will not be
            accepted.
          </p>
        </div>

        <div className="policy-card mx-auto mb-8 max-w-screen-md rounded p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold">
            RETURN SHIPPING &amp; RESTOCKING FEE
          </h2>
          <p className="mb-4">
            The customer is responsible for return shipping costs. Original
            shipping charges are not refundable.
          </p>
          <p>
            Accepted returns are subject to a 20% restocking fee, deducted from
            the refund.
          </p>
        </div>

        <div className="policy-card mx-auto mb-8 max-w-screen-md rounded p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold">RETURN ADDRESS</h2>
          <p className="mb-4">
            After your return request is accepted, we will provide instructions
            for sending the item to:
          </p>
          <address className="not-italic">
            Roger Wilco Aviation Services
            <br />
            3309 Douglas Avenue, Unit #3
            <br />
            Yankton, SD 57078
          </address>
        </div>

        <div className="policy-card mx-auto mb-8 max-w-screen-md rounded p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold">
            DAMAGED, DEFECTIVE, OR INCORRECT ITEMS
          </h2>
          <p>
            Inspect your order when it arrives and contact us promptly if an
            item is defective, damaged, or incorrect so we can evaluate the
            issue and make it right.
          </p>
        </div>

        <div className="policy-card mx-auto mb-8 max-w-screen-md rounded p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold">
            EXCEPTIONS &amp; NON-RETURNABLE ITEMS
          </h2>
          <p>
            Sale items and gift cards cannot be returned. Contact us before
            ordering if you have a question about whether a specific item is
            returnable.
          </p>
        </div>

        <div className="policy-card mx-auto mb-8 max-w-screen-md rounded p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold">EXCHANGES</h2>
          <p>
            We accept exchanges of eligible new items. Contact us within 10 days
            after receiving the item to request an exchange. The same
            eligibility conditions, customer-paid return shipping, and 20%
            restocking fee apply.
          </p>
        </div>

        <div className="policy-card mx-auto mb-8 max-w-screen-md rounded p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold">REFUNDS</h2>
          <p>
            We will notify you after we receive and inspect the return. If the
            return is approved, the refund—less the 20% restocking fee and any
            nonrefundable original shipping charges—will be issued to the
            original payment method within 30 days. Your bank or card issuer may
            require additional processing time.
          </p>
        </div>
      </main>

      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
