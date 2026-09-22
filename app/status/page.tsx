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
  title: { absolute: 'System Status | Roger Wilco Aviation Services' },
  description:
    'Dated manual status information for Roger Wilco Aviation Services. This page is not a live health monitor.',
  alternates: { canonical: 'https://www.rogerwilcoaviation.com/status' },
  robots: { index: false, follow: true },
};

type SystemRow = {
  name: string;
  detail: string;
  state: 'not-verified';
};

const SYSTEMS: SystemRow[] = [
  {
    name: 'rogerwilcoaviation.com',
    detail: 'Marketing site, blog, and product pages (Cloudflare Pages).',
    state: 'not-verified',
  },
  {
    name: 'Aircraft Marketplace',
    detail: 'Listings API and seller portal at sale-api.rogerwilcoaviation.com.',
    state: 'not-verified',
  },
  {
    name: 'Captain Jerry',
    detail: 'AI assistant widget and chat endpoint.',
    state: 'not-verified',
  },
  {
    name: 'Shopify Checkout',
    detail: 'Cart, payment, and order confirmation.',
    state: 'not-verified',
  },
  {
    name: 'Quote Requests',
    detail: 'Autopilot and avionics quote forms + email delivery.',
    state: 'not-verified',
  },
];

const LAST_CHECK = 'September 22, 2026';

function Dot({ state }: { state: SystemRow['state'] }) {
  const color = '#645746';
  const label = 'Not independently verified';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontVariantCaps: 'all-small-caps',
        letterSpacing: '0.06em',
        fontWeight: 600,
      }}
    >
      <span
        aria-hidden
        style={{
          width: '0.7rem',
          height: '0.7rem',
          borderRadius: '50%',
          background: color,
          boxShadow: '0 0 0 2px rgba(0,0,0,0.06)',
        }}
      />
      {label}
    </span>
  );
}

export default function StatusPage() {
  return (
    <BroadsheetLayout>
      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref="/status" />
      <CredentialsBar />
      <BulletinBar />

      <main className="bs-stage">
        {/* ── HERO HEADLINE ─────────────────────────────────────────── */}
        <section className="hero-headline-group" aria-labelledby="status-hero">
          <span className="bs-kicker">Operations</span>
          <span className="bs-script-accent">&mdash; wheels-up status board &mdash;</span>
          <h1 id="status-hero" className="bs-headline bs-headline--hero">
            System Status
          </h1>
          <p className="bs-subhead">
            A manually maintained service directory, not a live health monitor.
          </p>
          <div className="bs-byline">Last manually reviewed {LAST_CHECK}</div>
        </section>

        {/* ── SYSTEMS ───────────────────────────────────────────────── */}
        <Specimen variant="hero" as="section">
          <span className="bs-kicker">Services</span>
          <h2 className="bs-headline bs-headline--section">Verification status</h2>
          <hr className="section-rule" />
          <p className="bs-body">The previous April 21 snapshot is not a current health check. Page availability alone does not verify message delivery, listing submission, checkout, payment, or order confirmation. Contact us if you encounter a problem.</p>
          <ul className="bs-svc-list">
            {SYSTEMS.map((s) => (
              <li key={s.name} className="bs-svc">
                <p className="bs-svc-name">
                  {s.name} &middot; <Dot state={s.state} />
                </p>
                <p className="bs-svc-desc">{s.detail}</p>
              </li>
            ))}
          </ul>
        </Specimen>

        {/* ── INCIDENT REPORTING ────────────────────────────────────── */}
        <Specimen variant="flat" as="section">
          <span className="bs-kicker">Incidents</span>
          <h2 className="bs-headline bs-headline--section">Something not working?</h2>
          <hr className="section-rule" />
          <div className="bs-body">
            <p>
              If a page is broken, checkout is stuck, or the marketplace is throwing errors, we want to know
              immediately. Email <a href="mailto:avionics@rwas.team">avionics@rwas.team</a> or call{' '}
              <a href="tel:+16052998178">(605) 299-8178</a> during business hours. Screenshots and the URL you
              were on help us find the problem faster.
            </p>
            <p>
              For <strong>AOG-grade</strong> issues that need a human in the hangar &mdash; not a web-form
              problem &mdash; call the same number and ask for Dispatch.
            </p>
          </div>
        </Specimen>

        {/* ── SCHEDULED WINDOWS ─────────────────────────────────────── */}
        <Specimen variant="flat" as="section">
          <span className="bs-kicker">Maintenance Windows</span>
          <h2 className="bs-headline bs-headline--section">Planned work</h2>
          <hr className="section-rule" />
          <div className="bs-body">
            <p>
              Site deploys are done continuously and are generally invisible to visitors. When we need a
              scheduled maintenance window for the listings API or Captain Jerry backend, we post a note in the
              BULLETIN bar at the top of the site and announce it in advance by email to sellers who have active
              listings.
            </p>
          </div>
        </Specimen>
      </main>

      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
