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
  title: { absolute: 'Cookie Policy | Roger Wilco Aviation Services' },
  description:
    'Cookie policy for Roger Wilco Aviation Services (rogerwilcoaviation.com). Which cookies we set, why, and how to change your preferences.',
  alternates: { canonical: 'https://www.rogerwilcoaviation.com/cookies' },
};

const LAST_UPDATED = 'April 21, 2026';

export default function CookiePolicyPage() {
  return (
    <BroadsheetLayout>
      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref="/cookies" />
      <CredentialsBar />
      <BulletinBar />

      <main className="bs-stage">
        {/* ── HERO HEADLINE ─────────────────────────────────────────── */}
        <section className="hero-headline-group" aria-labelledby="cookies-hero">
          <span className="bs-kicker">Policies &amp; Notices</span>
          <span className="bs-script-accent">&mdash; the fine print &mdash;</span>
          <h1 id="cookies-hero" className="bs-headline bs-headline--hero">
            Cookie Policy
          </h1>
          <p className="bs-subhead">
            What we store in your browser, why we store it, and how you can switch it off.
          </p>
          <div className="bs-byline">Last updated {LAST_UPDATED}</div>
        </section>

        {/* ── OVERVIEW ──────────────────────────────────────────────── */}
        <Specimen variant="hero" as="section">
          <span className="bs-kicker">Overview</span>
          <h2 className="bs-headline bs-headline--section">What is a cookie?</h2>
          <hr className="section-rule" />
          <div className="bs-body">
            <p>
              A cookie is a small text file placed on your device when you visit a website. We use cookies &mdash;
              and similar technologies such as <em>localStorage</em> and session tokens &mdash; on{' '}
              <strong>rogerwilcoaviation.com</strong>, the aircraft marketplace, and the Captain Jerry assistant to
              keep sessions running, remember your preferences, and measure how our pages are used so we can
              improve them.
            </p>
            <p>
              By continuing to use this site you consent to the cookies described below. You can clear or block
              cookies at any time through your browser settings. Disabling certain cookies may prevent parts of
              the site &mdash; particularly the cart, marketplace login, and Captain Jerry chat &mdash; from working
              correctly.
            </p>
          </div>
        </Specimen>

        {/* ── CATEGORIES ────────────────────────────────────────────── */}
        <Specimen variant="flat" as="section">
          <span className="bs-kicker">Categories</span>
          <h2 className="bs-headline bs-headline--section">The cookies we set</h2>
          <hr className="section-rule" />
          <div className="bs-body">
            <p>
              <strong>Strictly necessary.</strong> Required for the site to function. These hold your shopping
              cart, keep you signed in to the aircraft marketplace, and carry the CSRF tokens that protect form
              submissions. You cannot disable these without breaking the site.
            </p>
            <p>
              <strong>Preferences.</strong> Remember non-essential choices such as whether you have dismissed the
              BULLETIN bar or chosen a theme. These are cleared when you clear your browser data.
            </p>
            <p>
              <strong>Analytics.</strong> We use Cloudflare Web Analytics and, on some pages, Microsoft Clarity to
              understand which articles and products are read, where visitors get stuck, and which routes need
              work. These tools do not sell your data. They do not build advertising profiles across sites.
            </p>
            <p>
              <strong>Checkout &amp; Shopify.</strong> When you proceed to checkout you are handed off to Shopify,
              our PCI-DSS compliant payment processor. Shopify sets its own session and fraud-prevention cookies;
              those are governed by{' '}
              <a href="https://www.shopify.com/legal/cookies" target="_blank" rel="noopener noreferrer">
                Shopify&rsquo;s cookie policy
              </a>
              .
            </p>
          </div>
        </Specimen>

        {/* ── CONTROLS ──────────────────────────────────────────────── */}
        <Specimen variant="flat" as="section">
          <span className="bs-kicker">Your Controls</span>
          <h2 className="bs-headline bs-headline--section">How to change your preferences</h2>
          <hr className="section-rule" />
          <div className="bs-body">
            <p>
              Most browsers let you view, block, or delete cookies from the privacy or security settings panel.
              You can also browse in a private / incognito window, which discards cookies when the window closes.
            </p>
            <p>
              If you&rsquo;d like us to delete personal data we hold about you, or to correct something that is
              wrong, contact us at{' '}
              <a href="mailto:avionics@rwas.team">avionics@rwas.team</a> or call{' '}
              <a href="tel:+16052998178">(605) 299-8178</a>. See the{' '}
              <a href="/privacy">Privacy Policy</a> for the rights available to you.
            </p>
          </div>
        </Specimen>
      </main>

      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
