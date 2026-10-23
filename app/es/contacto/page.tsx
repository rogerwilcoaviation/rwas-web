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

const pageUrl = 'https://www.rogerwilcoaviation.com/es/contacto';
const englishUrl = 'https://www.rogerwilcoaviation.com/contact';
export const metadata = genPageMetadata({
  title: 'Contacto Papa-Alpha en español | RWAS',
  description:
    'Consulte a RWAS sobre aplicación, disponibilidad y envío de herramientas Papa-Alpha para aeronaves Piper.',
  canonical: pageUrl,
  locale: 'es_US',
  languages: {
    'en-US': englishUrl,
    'pt-BR': 'https://www.rogerwilcoaviation.com/pt-br/contato',
    es: pageUrl,
    'x-default': englishUrl,
  },
});

export default function SpanishContactPage() {
  return (
    <BroadsheetLayout>
      <Dateline />
      <Masthead />
      <CredentialsBar />
      <BulletinBar />
      <main id="main-content" tabIndex={-1} className="bs-stage">
        <section
          className="hero-headline-group"
          aria-labelledby="contacto-title"
        >
          <span className="bs-kicker">Atención Papa-Alpha</span>
          <span className="bs-script-accent">
            — aplicación y compra internacional —
          </span>
          <h1 id="contacto-title" className="bs-headline bs-headline--hero">
            Hable con RWAS.
          </h1>
          <p className="bs-subhead">
            Para confirmar una herramienta, indique el modelo Piper, número de
            serie, configuración de la aeronave y tarea de reglaje.
          </p>
        </section>
        <div className="about-grid">
          <div className="about-main">
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Enviar consulta</span>
              <h2 className="bs-headline bs-headline--section">
                Use el formulario seguro de RWAS.
              </h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  El formulario completo está disponible en inglés y se abrirá
                  con el asunto Papa-Alpha seleccionado. Puede escribir su
                  mensaje en español.
                </p>
              </div>
              <p className="flex flex-wrap gap-3">
                <Link
                  className="bs-cta-primary"
                  href="/contact?reason=papa-alpha&source=es-contact"
                >
                  Abrir formulario de contacto
                </Link>
                <a
                  className="bs-cta-secondary"
                  href="mailto:service@rwas.team?subject=Consulta%20Papa-Alpha%20en%20espanol"
                >
                  Enviar correo electrónico
                </a>
              </p>
            </Specimen>
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Incluya en el mensaje</span>
              <ul className="bs-svc-list">
                <li className="bs-svc">
                  <p className="bs-svc-name">Aeronave</p>
                  <p className="bs-svc-desc">
                    Modelo, año, número de serie y configuración.
                  </p>
                </li>
                <li className="bs-svc">
                  <p className="bs-svc-name">Tarea</p>
                  <p className="bs-svc-desc">
                    Superficie o referencia de reglaje necesaria.
                  </p>
                </li>
                <li className="bs-svc">
                  <p className="bs-svc-name">Destino</p>
                  <p className="bs-svc-desc">
                    Ciudad, región y código postal para consultar el envío.
                  </p>
                </li>
              </ul>
            </Specimen>
          </div>
          <aside className="about-rail" aria-label="Canales de contacto">
            <Specimen as="section">
              <span className="bs-kicker">Correo electrónico</span>
              <p>
                <a href="mailto:service@rwas.team">service@rwas.team</a>
              </p>
            </Specimen>
            <Specimen as="section">
              <span className="bs-kicker">Teléfono</span>
              <p>
                <a href="tel:+16052998178">+1 605 299 8178</a>
                <br />
                Lunes a viernes, 7:00–17:00, hora central de EE. UU.
              </p>
            </Specimen>
            <Specimen as="section">
              <span className="bs-kicker">Aviso de precios</span>
              <p>
                Precios de la tienda en USD. No incluyen envío, impuestos ni
                costos de importación, salvo indicación expresa.
              </p>
            </Specimen>
          </aside>
        </div>
      </main>
      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
