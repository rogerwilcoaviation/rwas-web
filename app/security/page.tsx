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
  title: { absolute: 'Security | Roger Wilco Aviation Services' },
  description:
    'How Roger Wilco Aviation Services protects customer data, payment information, and marketplace listings. FAA Part 145 Repair Station RWSR491E.',
  alternates: { canonical: 'https://www.rogerwilcoaviation.com/security' },
};

const LAST_UPDATED = 'April 21, 2026';

export default function SecurityPage() {
  return (
    <BroadsheetLayout>
      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref="/security" />
      <CredentialsBar />
      <BulletinBar />

      <main className="bs-stage">
        {/* ── HERO HEADLINE ─────────────────────────────────────────── */}
        <section className="hero-headline-group" aria-labelledby="security-hero">
          <span className="bs-kicker">Trust &amp; Safety</span>
          <span className="bs-script-accent">&mdash; belt, suspenders, and a spare chute &mdash;</span>
          <h1 id="security-hero" className="bs-headline bs-headline--hero">
            Security at Roger Wilco
          </h1>
          <p className="bs-subhead">
            How we protect the panel, the ledger, and the customer data that rides along with both.
          </p>
          <div className="bs-byline">Last updated {LAST_UPDATED}</div>
        </section>

        {/* ── PAYMENTS ──────────────────────────────────────────────── */}
        <Specimen variant="hero" as="section">
          <span className="bs-kicker">Payments</span>
          <h2 className="bs-headline bs-headline--section">Card data never touches our servers</h2>
          <hr className="section-rule" />
          <div className="bs-body">
            <p>
              Online orders are processed by <strong>Shopify Payments</strong>, a PCI-DSS Level 1 certified
              processor. When you enter a card number it is tokenized by Shopify before it reaches us &mdash; we
              see only the last four digits and the authorization result. We do not store, log, or transmit raw
              card data.
            </p>
            <p>
              Quote invoices paid by wire, ACH, or check are processed through our bank over standard banking
              rails and governed by the bank&rsquo;s security controls. We destroy paper invoices with card data
              immediately after authorization.
            </p>
          </div>
        </Specimen>

        {/* ── TRANSPORT ─────────────────────────────────────────────── */}
        <Specimen variant="flat" as="section">
          <span className="bs-kicker">Transport &amp; Hosting</span>
          <h2 className="bs-headline bs-headline--section">Encrypted in flight &amp; at rest</h2>
          <hr className="section-rule" />
          <div className="bs-body">
            <p>
              All traffic to rogerwilcoaviation.com, the aircraft marketplace, and the Captain Jerry assistant
              runs over TLS 1.2 or better, terminated at Cloudflare. Certificates are issued and rotated
              automatically. Legacy protocols (SSL, TLS 1.0/1.1) are disabled.
            </p>
            <p>
              The site is statically exported and served from Cloudflare Pages &mdash; there is no public
              application server to attack. Backend services (listings API, Captain Jerry, Shopify proxy) are
              private by default, locked behind bearer-token authentication, and accessible only from our origin.
            </p>
            <p>
              Credentials, tokens, and API keys are stored in <strong>Keeper</strong>, our password manager, and
              in dedicated secret files on the Jerry workstation. Secrets are never checked into git.
            </p>
          </div>
        </Specimen>

        {/* ── MARKETPLACE ───────────────────────────────────────────── */}
        <Specimen variant="flat" as="section">
          <span className="bs-kicker">Marketplace</span>
          <h2 className="bs-headline bs-headline--section">Seller accounts &amp; listing integrity</h2>
          <hr className="section-rule" />
          <div className="bs-body">
            <p>
              Aircraft-for-sale sellers authenticate with email+magic-link sessions issued by our listings API.
              Sessions are bound to a single account, expire automatically, and can be revoked by request. We
              never store passwords &mdash; there are no passwords to leak.
            </p>
            <p>
              Listings are reviewed before they appear on the public index. We reserve the right to remove any
              listing found to misrepresent an aircraft, its logbooks, or its title history.
            </p>
          </div>
        </Specimen>

        {/* ── REPORTING ─────────────────────────────────────────────── */}
        <Specimen variant="flat" as="section">
          <span className="bs-kicker">Responsible Disclosure</span>
          <h2 className="bs-headline bs-headline--section">Found a bug? Tell us.</h2>
          <hr className="section-rule" />
          <div className="bs-body">
            <p>
              If you believe you&rsquo;ve found a security issue in any Roger Wilco property, email{' '}
              <a href="mailto:avionics@rwas.team">avionics@rwas.team</a> with a reproducer and we&rsquo;ll respond
              as quickly as we can. Please do not publicly disclose the issue until we&rsquo;ve had a chance to
              remediate it. We appreciate good-faith research and will credit you in any public writeup with
              your permission.
            </p>
          </div>
        </Specimen>
      </main>

      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
