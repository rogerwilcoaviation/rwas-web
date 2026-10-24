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

const pageUrl = 'https://www.rogerwilcoaviation.com/pt-br';

export const metadata = genPageMetadata({
  title: 'Ferramentas Papa-Alpha para Piper — Brasil | RWAS',
  description:
    'Página em português da RWAS para oficinas e profissionais brasileiros interessados nas ferramentas de referência Papa-Alpha para rigagem de aeronaves Piper.',
  canonical: pageUrl,
  locale: 'pt_BR',
  languages: {
    'en-US': 'https://www.rogerwilcoaviation.com/',
    'pt-BR': pageUrl,
    es: 'https://www.rogerwilcoaviation.com/es',
    'x-default': 'https://www.rogerwilcoaviation.com/',
  },
});

export default function PortugueseLandingPage() {
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
            name: 'Ferramentas Papa-Alpha para Piper — Brasil',
            inLanguage: 'pt-BR',
            isPartOf: { '@id': 'https://www.rogerwilcoaviation.com/#website' },
          }),
        }}
      />
      <Dateline />
      <Masthead />
      <CredentialsBar />
      <BulletinBar />
      <main id="main-content" tabIndex={-1} className="bs-stage">
        <section className="hero-headline-group" aria-labelledby="ptbr-title">
          <span className="bs-kicker">RWAS em português · piloto Brasil</span>
          <span className="bs-script-accent">
            — ferramentas feitas por mecânicos —
          </span>
          <h1 id="ptbr-title" className="bs-headline bs-headline--hero">
            Referências de rigagem Piper,
            <br />
            <em>agora em português.</em>
          </h1>
          <p className="bs-subhead">
            Conheça a linha Papa-Alpha e fale diretamente com a RWAS sobre a
            aplicação para sua aeronave.
          </p>
        </section>
        <div className="about-grid">
          <div className="about-main">
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Papa-Alpha Tools</span>
              <h2 className="bs-headline bs-headline--section">
                Ferramentas de referência para trabalhos de manutenção em
                aeronaves Piper.
              </h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Projetadas e fabricadas pela Roger Wilco Aviation Services em
                  Yankton, Dakota do Sul, as ferramentas Papa-Alpha ajudam
                  profissionais de manutenção a obter referências físicas
                  repetíveis em tarefas de rigagem.
                </p>
                <p>
                  Elas devem ser utilizadas por pessoal qualificado em conjunto
                  com os dados de manutenção Piper aplicáveis. Não substituem o
                  manual de manutenção.
                </p>
              </div>
              <p className="flex flex-wrap gap-3">
                <Link className="bs-cta-primary" href="/pt-br/papa-alpha">
                  Conhecer a linha Papa-Alpha
                </Link>
                <Link className="bs-cta-secondary" href="/pt-br/contato">
                  Consultar aplicação
                </Link>
              </p>
            </Specimen>
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Compra internacional</span>
              <h2 className="bs-headline bs-headline--section">
                Informações claras antes do pedido.
              </h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Os preços publicados na loja são em dólares americanos (USD).
                  Frete internacional, tributos brasileiros, despacho aduaneiro,
                  tarifas de importação e outras cobranças locais não estão
                  incluídos, salvo indicação expressa no checkout.
                </p>
                <p>
                  A disponibilidade de envio ao Brasil deve ser confirmada no
                  checkout ou diretamente com a RWAS antes da compra.
                </p>
              </div>
            </Specimen>
          </div>
          <aside
            className="about-rail"
            aria-label="Resumo do atendimento Brasil"
          >
            <Specimen as="section">
              <span className="bs-kicker">Atendimento</span>
              <p>
                Dúvidas de aplicação
                <br />
                Informações de produto
                <br />
                Consulta sobre envio internacional
              </p>
            </Specimen>
            <Specimen as="section">
              <span className="bs-kicker">Contato</span>
              <p>
                <a href="mailto:service@rwas.team">service@rwas.team</a>
                <br />
                <a href="tel:+16052998178">+1 605 299 8178</a>
                <br />
                Atendimento em horário comercial dos EUA (Central Time)
              </p>
            </Specimen>
          </aside>
        </div>
      </main>
      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
