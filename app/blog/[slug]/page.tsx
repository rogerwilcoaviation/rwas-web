/* eslint-disable @next/next/no-html-link-for-pages */
/* eslint-disable @next/next/no-img-element */
import '../../newspaper.css';
import blogData from '../../../public/blog-articles.json';
import { notFound } from 'next/navigation';

const publishedArticles = blogData.articles.filter((article) => article.status === 'published');

export async function generateStaticParams() {
  return publishedArticles.map((article) => ({ slug: article.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = publishedArticles.find((entry) => entry.id === slug);

  if (!article) {
    return {
      title: 'Article not found | Roger Wilco Aviation Services',
    };
  }

  return {
    title: `${article.title} | Blog Articles`,
    description: article.lead,
  };
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = publishedArticles.find((entry) => entry.id === slug);

  if (!article) notFound();

  const relatedArticles = publishedArticles.filter((entry) => entry.id !== article.id).slice(0, 4);

  return (
    <div className="np-wrapper" style={{ background: '#ddd9d2', minHeight: '100vh', fontFamily: "Georgia, 'Times New Roman', serif" }}>
      <div className="np-page">
        <div className="np-dateline">
          <span>Spring 2026 Edition</span>
          <span>Vol. XL &middot; No. 1</span>
          <span>rogerwilcoaviation.com</span>
        </div>

        <div className="np-masthead">
          <img
            className="np-masthead-logo"
            src="/newspaper/images/logo.png"
            alt="Roger Wilco Aviation Services"
          />
          <div className="np-masthead-center">
            <div className="np-masthead-name">Roger Wilco Aviation Services</div>
            <hr className="np-masthead-rule" />
            <div className="np-masthead-tagline">
              FAA Cert. Repair Station &nbsp;&middot;&nbsp; Avionics &nbsp;&middot;&nbsp; Airframe &amp; Powerplant &nbsp;&middot;&nbsp; NDT &nbsp;&middot;&nbsp; Fabrication
            </div>
          </div>
          <div className="np-masthead-right">
            Cert. No. RWSR491E<br />
            KYKN &middot; Yankton, SD
          </div>
        </div>

        <div className="np-edition-bar">
          <span>Garmin Spring 2026 pricing now active</span>
          <span>GFC 500 autopilot installations available</span>
          <span>Now accepting spring scheduling</span>
        </div>

        <nav className="np-nav">
          <a href="/">Home</a>
          <a href="#ask-jerry" style={{ background: '#d4c47a', cursor: 'pointer' }} className="np-nav-jerry">Ask Jerry</a>
          <a href="/collections/on-sale">On Sale</a>
          <a href="/collections/garmin-avionics">Garmin</a>
          <a href="/collections/rigging-tools">Papa-Alpha Tools</a>
          <a href="/financing">Financing</a>
          <a href="/shop-capabilities">Shop Capabilities</a>
          <a className="active" href="/blog/">Blog Articles</a>
          <a href="/contact">Contact</a>
        </nav>

        <div className="np-ticker-bar">
          <span className="np-ticker-label">Bulletin</span>
          <span className="np-ticker-text">
            Papa-Alpha rigging reference tools now shipping worldwide &nbsp;&bull;&nbsp;
            Garmin G3X Touch installations booking into summer 2026 &nbsp;&bull;&nbsp;
            Annual inspection slots available &mdash; call (605) 299-8178
          </span>
        </div>

        <div className="np-body">
          <div style={{ borderBottom: '2px solid #1a1a1a', padding: '14px 0' }}>
            <span className="np-kicker">{article.category.replace(/-/g, ' ')}</span>
            <h1 className="np-headline-xl" style={{ fontSize: '30px', marginBottom: '6px' }}>
              {article.title}
            </h1>
            <div className="np-byline">{article.byline} &middot; {article.date} &middot; {article.source}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1px 0.9fr', gap: '0', padding: '14px 0', borderBottom: '2px solid #1a1a1a', alignItems: 'start' }}>
            <div style={{ padding: '0 16px 0 0' }}>
              {article.subtitle ? (
                <p className="np-body-text" style={{ fontStyle: 'italic', fontSize: '18px', lineHeight: 1.5, marginBottom: '12px' }}>
                  {article.subtitle}
                </p>
              ) : null}

              <p className="np-body-text np-drop">{article.lead}</p>
              {article.body.map((paragraph, index) => (
                <p key={index} className="np-body-text">{paragraph}</p>
              ))}

              <div className="np-pull-quote" style={{ marginTop: '18px' }}>
                &ldquo;For current pricing or installation scheduling, call RWAS at (605) 299-8178.&rdquo;
              </div>
            </div>

            <div className="np-col-divider" />

            <div style={{ padding: '0 0 0 16px' }}>
              <div className="np-box" style={{ marginBottom: '12px' }}>
                <div className="np-box-title">Article File</div>
                <p className="np-body-text" style={{ marginBottom: '8px' }}>
                  Author: {article.author}<br />
                  Source: {article.source || 'RWAS Desk'}<br />
                  Published: {article.published_at ? article.published_at.slice(0, 10) : article.date}
                </p>
                {article.source_url ? (
                  <a className="np-ad-btn" href={article.source_url} target="_blank" rel="noreferrer">
                    Source Reference
                  </a>
                ) : null}
              </div>

              <div className="np-box" style={{ marginBottom: '12px' }}>
                <div className="np-box-title">Topics</div>
                {article.tags.map((tag) => (
                  <div className="np-box-row" key={tag}>
                    <span>{tag}</span>
                    <span className="np-box-pg">&sect;</span>
                  </div>
                ))}
              </div>

              <div className="np-box">
                <div className="np-box-title">Recent Dispatches</div>
                {relatedArticles.map((entry) => (
                  <div className="np-box-row" key={entry.id}>
                    <a href={`/blog/${entry.id}`}>
                      <span>{entry.title}</span>
                      <span className="np-box-pg">&rarr;</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="np-credentials-bar">
          NBAA Member &nbsp;&middot;&nbsp; AEA Member &nbsp;&middot;&nbsp; Certified &amp; Trained
        </div>

        <div className="np-footer">
          <span className="np-footer-name">Roger Wilco Aviation Services</span>
          <span>&copy; 2026 RWAS &middot; All Rights Reserved</span>
        </div>
      </div>
    </div>
  );
}
