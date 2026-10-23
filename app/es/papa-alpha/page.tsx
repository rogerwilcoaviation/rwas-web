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

const pageUrl = 'https://www.rogerwilcoaviation.com/es/papa-alpha';
const englishUrl =
  'https://www.rogerwilcoaviation.com/services/papa-alpha-tools';
export const metadata = genPageMetadata({
  title: 'Herramientas de reglaje Piper Papa-Alpha | RWAS',
  description:
    'Herramientas de referencia Papa-Alpha para aeronaves Piper PA-28, PA-30, PA-31, PA-32, PA-34, PA-36, PA-39 y PA-44, según el producto específico.',
  canonical: pageUrl,
  locale: 'es_US',
  languages: {
    'en-US': englishUrl,
    'pt-BR': 'https://www.rogerwilcoaviation.com/pt-br/papa-alpha',
    es: pageUrl,
    'x-default': englishUrl,
  },
});

export default function PapaAlphaSpanishPage() {
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
            name: 'Herramientas de reglaje Piper Papa-Alpha',
            inLanguage: 'es',
            about: { '@id': englishUrl + '#brand' },
          }),
        }}
      />
      <Dateline />
      <Masthead />
      <CredentialsBar />
      <BulletinBar />
      <main id="main-content" tabIndex={-1} className="bs-stage">
        <section
          className="hero-headline-group"
          aria-labelledby="papa-alpha-es-title"
        >
          <span className="bs-kicker">
            Papa-Alpha Tools · referencias para Piper
          </span>
          <span className="bs-script-accent">
            — diseñadas y fabricadas por RWAS —
          </span>
          <h1
            id="papa-alpha-es-title"
            className="bs-headline bs-headline--hero"
          >
            Herramientas de reglaje Piper,
            <br />
            <em>hechas por mecánicos.</em>
          </h1>
          <p className="bs-subhead">
            Referencias para estabilizador, timón, alerón, flap y balancín,
            según la aplicación del producto.
          </p>
        </section>
        <div className="about-grid">
          <div className="about-main">
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Finalidad</span>
              <h2 className="bs-headline bs-headline--section">
                Referencias físicas ligeras, legibles y repetibles.
              </h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  La línea Papa-Alpha nació de trabajos reales de mantenimiento
                  Piper. Las herramientas son de aluminio y ayudan a reducir
                  improvisaciones y ambigüedades al obtener referencias durante
                  el reglaje de mandos de vuelo.
                </p>
                <p>
                  RWAS controla el diseño y la fabricación mediante CAD,
                  mecanizado CNC, corte láser de fibra, pintura en polvo e
                  impresión UV.
                </p>
              </div>
            </Specimen>
            <Specimen variant="hero" as="figure" className="about-fig">
              <Specimen.Image
                src="/newspaper/images/papa_alpha_kit_collection.webp"
                alt="Conjunto de herramientas Papa-Alpha para referencias de reglaje Piper"
                width={1600}
                height={1200}
              />
              <Specimen.CaptionRule />
              <Specimen.Caption numeral="FIG. 01">
                Herramientas de referencia Papa-Alpha diseñadas y fabricadas por
                RWAS.
              </Specimen.Caption>
            </Specimen>
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Aplicabilidad</span>
              <h2 className="bs-headline bs-headline--section">
                Confirme el producto exacto para la aeronave exacta.
              </h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  La familia incluye referencias para modelos de las series
                  PA-28, PA-30, PA-31, PA-32, PA-34, PA-36, PA-39 y PA-44, según
                  la herramienta específica. Esto no significa que cada
                  herramienta sea aplicable a todos los modelos o números de
                  serie.
                </p>
                <p>
                  La página activa de cada producto es la fuente vigente para
                  SKU, modelos aplicables, contenido del kit, disponibilidad y
                  precio exacto en USD. Antes de comprar, confirme modelo,
                  número de serie, configuración de la aeronave y los datos de
                  mantenimiento Piper aplicables.
                </p>
                <p>
                  Uso destinado a profesionales de mantenimiento calificados. La
                  herramienta no sustituye manuales, planos, límites ni
                  procedimientos del fabricante.
                </p>
              </div>
              <p className="flex flex-wrap gap-3">
                <Link
                  className="bs-cta-primary"
                  href="/collections/papa-alpha-tools"
                >
                  Ver productos, SKU y precios
                </Link>
                <Link className="bs-cta-secondary" href="/es/contacto">
                  Preguntar sobre aplicación
                </Link>
              </p>
            </Specimen>
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Precios e importación</span>
              <h2 className="bs-headline bs-headline--section">
                Valores en USD; costos de importación por separado.
              </h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Todos los precios mostrados en la tienda están expresados en
                  dólares estadounidenses (USD), salvo indicación expresa en
                  contrario. Conversión de divisas, impuestos, aranceles,
                  despacho aduanero y demás costos de importación no están
                  incluidos en el precio publicado.
                </p>
                <p>
                  El envío y la disponibilidad de entrega internacional dependen
                  del destino y deben confirmarse durante el pago o con RWAS. El
                  comprador debe verificar los requisitos de importación y
                  cargos locales.
                </p>
              </div>
            </Specimen>
          </div>
          <aside
            className="about-rail"
            aria-label="Referencia rápida Papa-Alpha"
          >
            <Specimen as="section">
              <span className="bs-kicker">Familias citadas</span>
              <p>
                PA-28 · PA-30 · PA-31
                <br />
                PA-32 · PA-34 · PA-36
                <br />
                PA-39 · PA-44
              </p>
              <p>
                <strong>Siempre según la herramienta específica.</strong>
              </p>
            </Specimen>
            <Specimen as="section">
              <span className="bs-kicker">Para consultar</span>
              <p>
                Indique modelo, número de serie, configuración y tarea de
                reglaje.
              </p>
              <Link className="bs-cta-secondary" href="/es/contacto">
                Hablar con RWAS
              </Link>
            </Specimen>
          </aside>
        </div>
      </main>
      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
