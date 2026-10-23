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

const pageUrl = 'https://www.rogerwilcoaviation.com/pt-br/papa-alpha';
const englishUrl =
  'https://www.rogerwilcoaviation.com/services/papa-alpha-tools';

export const metadata = genPageMetadata({
  title: 'Ferramentas de rigagem Piper Papa-Alpha | RWAS',
  description:
    'Ferramentas de referência Papa-Alpha para rigagem de aeronaves Piper PA-28, PA-30, PA-31, PA-32, PA-34, PA-36, PA-39 e PA-44, conforme o produto específico.',
  canonical: pageUrl,
  locale: 'pt_BR',
  languages: {
    'en-US': englishUrl,
    'pt-BR': pageUrl,
    es: 'https://www.rogerwilcoaviation.com/es/papa-alpha',
    'x-default': englishUrl,
  },
});

export default function PapaAlphaPortuguesePage() {
  return (
    <BroadsheetLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'WebPage',
                '@id': pageUrl + '#webpage',
                url: pageUrl,
                name: 'Ferramentas de rigagem Piper Papa-Alpha',
                inLanguage: 'pt-BR',
                about: { '@id': englishUrl + '#brand' },
              },
              {
                '@type': 'BreadcrumbList',
                itemListElement: [
                  {
                    '@type': 'ListItem',
                    position: 1,
                    name: 'Início',
                    item: 'https://www.rogerwilcoaviation.com/pt-br/',
                  },
                  {
                    '@type': 'ListItem',
                    position: 2,
                    name: 'Papa-Alpha',
                    item: pageUrl,
                  },
                ],
              },
            ],
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
          aria-labelledby="papa-alpha-pt-title"
        >
          <span className="bs-kicker">
            Papa-Alpha Tools · referências para Piper
          </span>
          <span className="bs-script-accent">
            — projetadas e fabricadas pela RWAS —
          </span>
          <h1
            id="papa-alpha-pt-title"
            className="bs-headline bs-headline--hero"
          >
            Ferramentas de rigagem Piper,
            <br />
            <em>feitas por mecânicos.</em>
          </h1>
          <p className="bs-subhead">
            Referências para estabilizador, leme, aileron, flap e bell crank,
            conforme a aplicação do produto.
          </p>
        </section>
        <div className="about-grid">
          <div className="about-main">
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Finalidade</span>
              <h2 className="bs-headline bs-headline--section">
                Referências físicas leves, legíveis e repetíveis.
              </h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  A linha Papa-Alpha nasceu de trabalhos reais de manutenção
                  Piper. As ferramentas são fabricadas em alumínio e ajudam a
                  reduzir improvisos e ambiguidades na obtenção de referências
                  durante a rigagem de comandos de voo.
                </p>
                <p>
                  A RWAS controla o projeto e a fabricação com CAD, usinagem
                  CNC, corte a laser de fibra, pintura a pó e impressão UV.
                </p>
              </div>
            </Specimen>
            <Specimen variant="hero" as="figure" className="about-fig">
              <Specimen.Image
                src="/newspaper/images/papa_alpha_kit_collection.webp"
                alt="Conjunto de ferramentas Papa-Alpha para referências de rigagem Piper"
                width={1600}
                height={1200}
              />
              <Specimen.CaptionRule />
              <Specimen.Caption numeral="FIG. 01">
                Ferramentas de referência Papa-Alpha projetadas e fabricadas
                pela RWAS.
              </Specimen.Caption>
            </Specimen>
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Aplicabilidade</span>
              <h2 className="bs-headline bs-headline--section">
                Confirme o produto exato para a aeronave exata.
              </h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  A família inclui referências para modelos das séries PA-28,
                  PA-30, PA-31, PA-32, PA-34, PA-36, PA-39 e PA-44, dependendo
                  da ferramenta específica. Isso não significa que toda
                  ferramenta seja aplicável a todo modelo ou número de série.
                </p>
                <p>
                  A página ativa de cada produto é a fonte de verdade para
                  modelos aplicáveis, conteúdo do kit, disponibilidade e preço.
                  Antes da compra, confirme modelo, número de série,
                  configuração da aeronave e dados de manutenção Piper
                  aplicáveis.
                </p>
                <p>
                  Uso destinado a profissionais de manutenção qualificados. A
                  ferramenta não substitui manuais, desenhos, limites ou
                  procedimentos do fabricante.
                </p>
              </div>
              <p className="flex flex-wrap gap-3">
                <Link
                  className="bs-cta-primary"
                  href="/collections/papa-alpha-tools"
                >
                  Ver produtos e aplicações
                </Link>
                <Link className="bs-cta-secondary" href="/pt-br/contato">
                  Perguntar sobre aplicação
                </Link>
              </p>
            </Specimen>
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Preços e importação</span>
              <h2 className="bs-headline bs-headline--section">
                Valores em USD; custos de importação separados.
              </h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Todos os preços exibidos na loja são em dólares americanos
                  (USD), salvo indicação expressa em contrário. Conversão
                  cambial, IOF, impostos, taxas, despacho aduaneiro e demais
                  custos de importação no Brasil não estão incluídos no preço
                  publicado.
                </p>
                <p>
                  Frete e disponibilidade de entrega internacional dependem do
                  destino e devem ser confirmados no checkout ou com a RWAS. O
                  comprador é responsável por verificar requisitos de importação
                  e cobranças locais.
                </p>
              </div>
            </Specimen>
          </div>
          <aside
            className="about-rail"
            aria-label="Referência rápida Papa-Alpha"
          >
            <Specimen as="section">
              <span className="bs-kicker">Famílias citadas</span>
              <p>
                PA-28 · PA-30 · PA-31
                <br />
                PA-32 · PA-34 · PA-36
                <br />
                PA-39 · PA-44
              </p>
              <p>
                <strong>Sempre conforme a ferramenta específica.</strong>
              </p>
            </Specimen>
            <Specimen as="section">
              <span className="bs-kicker">Para consultar</span>
              <p>
                Informe modelo, número de série, configuração e tarefa de
                rigagem.
              </p>
              <Link className="bs-cta-secondary" href="/pt-br/contato">
                Falar com a RWAS
              </Link>
            </Specimen>
          </aside>
        </div>
      </main>
      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
