import Link from 'next/link';
import {
  BroadsheetLayout,
  BroadsheetFooter,
  BulletinBar,
  CredentialsBar,
  Dateline,
  Masthead,
  Specimen,
} from '@/components/shared/broadsheet';
import { genPageMetadata } from '@/app/seo';

const pageUrl = 'https://www.rogerwilcoaviation.com/es';
const englishUrl = 'https://www.rogerwilcoaviation.com/';
export const metadata = genPageMetadata({
  title: 'Herramientas Papa-Alpha para Piper en español | RWAS',
  description:
    'Información en español sobre las herramientas de referencia Papa-Alpha para trabajos de reglaje en aeronaves Piper.',
  canonical: pageUrl,
  locale: 'es_US',
  languages: {
    'en-US': englishUrl,
    'pt-BR': 'https://www.rogerwilcoaviation.com/pt-br',
    es: pageUrl,
    'x-default': englishUrl,
  },
});

export default function SpanishLandingPage() {
  return (
    <BroadsheetLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            '@id': pageUrl + '#webpage',
            url: pageUrl,
            name: 'Herramientas Papa-Alpha para Piper en español',
            inLanguage: 'es',
            isPartOf: { '@id': englishUrl + '#website' },
          }),
        }}
      />
      <Dateline />
      <Masthead />
      <CredentialsBar />
      <BulletinBar />
      <main id="main-content" tabIndex={-1} className="bs-stage">
        <section className="hero-headline-group" aria-labelledby="es-title">
          <span className="bs-kicker">RWAS en español · programa piloto</span>
          <span className="bs-script-accent">
            — herramientas hechas por mecánicos —
          </span>
          <h1 id="es-title" className="bs-headline bs-headline--hero">
            Referencias de reglaje Piper,
            <br />
            <em>ahora en español.</em>
          </h1>
          <p className="bs-subhead">
            Conozca la línea Papa-Alpha y consulte directamente con RWAS la
            aplicación para su aeronave.
          </p>
        </section>
        <div className="about-grid">
          <div className="about-main">
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Papa-Alpha Tools</span>
              <h2 className="bs-headline bs-headline--section">
                Herramientas de referencia para mantenimiento de aeronaves
                Piper.
              </h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Diseñadas y fabricadas por Roger Wilco Aviation Services en
                  Yankton, Dakota del Sur, las herramientas Papa-Alpha ayudan a
                  profesionales de mantenimiento a obtener referencias físicas
                  repetibles durante trabajos de reglaje.
                </p>
                <p>
                  Deben ser utilizadas por personal calificado junto con los
                  datos de mantenimiento Piper aplicables. No sustituyen el
                  manual de mantenimiento.
                </p>
              </div>
              <p className="flex flex-wrap gap-3">
                <Link className="bs-cta-primary" href="/es/papa-alpha">
                  Conocer la línea Papa-Alpha
                </Link>
                <Link className="bs-cta-secondary" href="/es/contacto">
                  Consultar una aplicación
                </Link>
              </p>
            </Specimen>
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Compra internacional</span>
              <h2 className="bs-headline bs-headline--section">
                Información clara antes del pedido.
              </h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Los precios publicados en la tienda están expresados en
                  dólares estadounidenses (USD). Salvo indicación expresa
                  durante el pago, no incluyen envío internacional, impuestos,
                  aranceles, despacho aduanero ni otros cargos locales.
                </p>
                <p>
                  La disponibilidad de entrega internacional debe confirmarse
                  durante el pago o directamente con RWAS antes de comprar.
                </p>
              </div>
            </Specimen>
          </div>
          <aside
            className="about-rail"
            aria-label="Resumen de atención en español"
          >
            <Specimen as="section">
              <span className="bs-kicker">Atención</span>
              <p>
                Consultas de aplicación
                <br />
                Información de producto
                <br />
                Consulta de envío internacional
              </p>
            </Specimen>
            <Specimen as="section">
              <span className="bs-kicker">Contacto</span>
              <p>
                <a href="mailto:service@rwas.team">service@rwas.team</a>
                <br />
                <a href="tel:+16052998178">+1 605 299 8178</a>
                <br />
                Horario comercial de EE. UU. (hora central)
              </p>
            </Specimen>
          </aside>
        </div>
      </main>
      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
