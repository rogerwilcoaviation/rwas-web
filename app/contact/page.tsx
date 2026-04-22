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
import ContactForm from '@/components/shared/ContactForm';
import '../contact.css';

export const metadata = {
  title: 'Contact RWAS',
  description:
    'Contact the Roger Wilco Aviation Services Avionics Desk in Yankton, SD. Quote requests, project inquiries, and general questions route to service@rwas.team.',
  alternates: { canonical: '/contact' },
};

// Dynamic = the form reads ?product=/?sku= from the URL on the client,
// but the shell is pre-rendered in the broadsheet at build time.
export const dynamic = 'force-static';

export default function ContactPage() {
  return (
    <BroadsheetLayout>
      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref="/contact" />
      <CredentialsBar />
      <BulletinBar />
      <main className="bs-stage">
        <section className="hero-headline-group">
          <p className="bs-kicker">The Correspondence Desk</p>
          <p className="bs-script-accent">&mdash; quote requests &amp; inquiries &mdash;</p>
          <h1 className="bs-headline bs-headline--hero">Contact RWAS.</h1>
          <p className="bs-subhead">
            Every message below lands at <strong>service@rwas.team</strong> — read
            by the shop, not by a phone tree. For quote requests, include your
            aircraft make / model and N-number so we can pull records and reply
            with real numbers.
          </p>
          <p className="bs-byline">
            RWAS Avionics Desk &middot; 700 E 31st St, Yankton, SD 57078 &middot; KYKN &middot; (605) 299-8178
          </p>
        </section>

        <Specimen variant="hero" as="section" className="contact-specimen">
          <ContactForm />
        </Specimen>

        <section className="contact-alt-channels">
          <h2 className="bs-section-head">Other ways to reach us</h2>
          <dl className="contact-alt-grid">
            <div>
              <dt>Phone</dt>
              <dd>
                <a href="tel:+16052998178">(605) 299-8178</a>
                <span className="contact-hours">Mon–Fri, 7:00a–5:00p CT</span>
              </dd>
            </div>
            <div>
              <dt>Avionics email</dt>
              <dd>
                <a href="mailto:avionics@rwas.team">avionics@rwas.team</a>
              </dd>
            </div>
            <div>
              <dt>General / service</dt>
              <dd>
                <a href="mailto:service@rwas.team">service@rwas.team</a>
              </dd>
            </div>
            <div>
              <dt>Shop address</dt>
              <dd>
                700 E 31st Street
                <br />
                Yankton, SD 57078
                <br />
                <span className="contact-hours">KYKN — based at Chan Gurney Municipal</span>
              </dd>
            </div>
          </dl>
        </section>
      </main>
      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
