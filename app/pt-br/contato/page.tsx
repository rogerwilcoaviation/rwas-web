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

const pageUrl = 'https://www.rogerwilcoaviation.com/pt-br/contato';
const englishUrl = 'https://www.rogerwilcoaviation.com/contact';

export const metadata = genPageMetadata({
  title: 'Contato Papa-Alpha em português | RWAS',
  description:
    'Consulte a RWAS sobre aplicação, disponibilidade e envio das ferramentas Papa-Alpha para aeronaves Piper.',
  canonical: pageUrl,
  locale: 'pt_BR',
  languages: { 'en-US': englishUrl, 'pt-BR': pageUrl, 'x-default': englishUrl },
});

export default function PortugueseContactPage() {
  return (
    <BroadsheetLayout>
      <Dateline />
      <Masthead />
      <CredentialsBar />
      <BulletinBar />
      <main id="main-content" tabIndex={-1} className="bs-stage">
        <section
          className="hero-headline-group"
          aria-labelledby="contato-title"
        >
          <span className="bs-kicker">Atendimento Papa-Alpha</span>
          <span className="bs-script-accent">
            — aplicação e compra internacional —
          </span>
          <h1 id="contato-title" className="bs-headline bs-headline--hero">
            Fale com a RWAS.
          </h1>
          <p className="bs-subhead">
            Para confirmar uma ferramenta, informe o modelo Piper, número de
            série, configuração da aeronave e a tarefa de rigagem.
          </p>
        </section>
        <div className="about-grid">
          <div className="about-main">
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Enviar consulta</span>
              <h2 className="bs-headline bs-headline--section">
                Use o formulário seguro da RWAS.
              </h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  O formulário completo está disponível em inglês e já será
                  aberto com o assunto Papa-Alpha selecionado. Você pode
                  escrever sua mensagem em português.
                </p>
              </div>
              <p className="flex flex-wrap gap-3">
                <Link
                  className="bs-cta-primary"
                  href="/contact?reason=papa-alpha&source=pt-br-contact"
                >
                  Abrir formulário de contato
                </Link>
                <a
                  className="bs-cta-secondary"
                  href="mailto:service@rwas.team?subject=Consulta%20Papa-Alpha%20Brasil"
                >
                  Enviar e-mail
                </a>
              </p>
            </Specimen>
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Inclua na mensagem</span>
              <ul className="bs-svc-list">
                <li className="bs-svc">
                  <p className="bs-svc-name">Aeronave</p>
                  <p className="bs-svc-desc">
                    Modelo, ano, número de série e configuração.
                  </p>
                </li>
                <li className="bs-svc">
                  <p className="bs-svc-name">Tarefa</p>
                  <p className="bs-svc-desc">
                    Superfície ou referência de rigagem necessária.
                  </p>
                </li>
                <li className="bs-svc">
                  <p className="bs-svc-name">Destino</p>
                  <p className="bs-svc-desc">
                    Cidade, estado e CEP no Brasil para consulta de envio.
                  </p>
                </li>
              </ul>
            </Specimen>
          </div>
          <aside className="about-rail" aria-label="Canais de contato">
            <Specimen as="section">
              <span className="bs-kicker">E-mail</span>
              <p>
                <a href="mailto:service@rwas.team">service@rwas.team</a>
              </p>
            </Specimen>
            <Specimen as="section">
              <span className="bs-kicker">Telefone</span>
              <p>
                <a href="tel:+16052998178">+1 605 299 8178</a>
                <br />
                Segunda a sexta, 7h–17h, Central Time (EUA).
              </p>
            </Specimen>
            <Specimen as="section">
              <span className="bs-kicker">Aviso de preços</span>
              <p>
                Preços da loja em USD. Frete, impostos e custos de importação
                não incluídos, salvo indicação expressa.
              </p>
            </Specimen>
          </aside>
        </div>
      </main>
      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
