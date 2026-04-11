/* eslint-disable @next/next/no-html-link-for-pages */
/* eslint-disable @next/next/no-img-element */
import '../newspaper.css';
import blogData from '../../public/blog-articles.json';

const publishedArticles = blogData.articles.filter((article) => article.status === 'published');
const leadArticle = publishedArticles[0];
const secondaryArticles = publishedArticles.slice(1);
const recentDispatches = publishedArticles.slice(0, 5);
const topics = blogData.meta.categories;

export const metadata = {
  title: 'Blog Articles | Roger Wilco Aviation Services',
  description:
    'Dispatches, bulletins, Garmin product updates, service notes, and shop news from Roger Wilco Aviation Services.',
};

export default function BlogPage() {
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
          <a href="https://rwas-aircraft-sale.john-08c.workers.dev/page">Aircraft 4 Sale</a>
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
            <span className="np-kicker">Dispatches &amp; Bulletins</span>
            <h1 className="np-headline-xl" style={{ fontSize: '30px', marginBottom: '6px' }}>
              Blog Articles, Product Updates,<br />
              <em>and Shop Dispatches</em>
            </h1>
            <div className="np-byline">RWAS Avionics Desk &middot; Garmin updates &middot; service bulletins &middot; shop notes</div>
          </div>

          <div className="np-edition-bar" style={{ marginTop: '0', borderTop: 'none' }}>
            <span>{blogData.meta.total_articles} published dispatches</span>
            <span>Last updated {blogData.meta.last_updated.slice(0, 10)}</span>
            <span>Topics: {topics.join(' / ')}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1px 0.95fr', gap: '0', padding: '14px 0', borderBottom: '2px solid #1a1a1a', alignItems: 'start' }}>
            <div style={{ padding: '0 16px 0 0' }}>
              {leadArticle && (
                <>
                  <span className="np-kicker">Lead Article</span>
                  <a href={`/blog/${leadArticle.id}`} className="np-headline-link">
                    <h2 className="np-headline-xl np-headline-xl-link" style={{ fontSize: '28px', marginTop: '4px' }}>
                      {leadArticle.title}
                    </h2>
                  </a>
                  <div className="np-byline">{leadArticle.byline} &middot; {leadArticle.date} &middot; {leadArticle.source}</div>
                  <hr className="np-rule" />
                  <p className="np-body-text np-drop">{leadArticle.lead}</p>
                  {leadArticle.body.slice(0, 2).map((paragraph, index) => (
                    <p key={index} className="np-body-text">{paragraph}</p>
                  ))}
                  <div className="np-box" style={{ marginTop: '12px' }}>
                    <div className="np-box-title">Filed Under</div>
                    <p className="np-body-text" style={{ marginBottom: 0 }}>{leadArticle.tags.join(' &middot; ')}</p>
                  </div>
                </>
              )}
            </div>

            <div className="np-col-divider" />

            <div style={{ padding: '0 0 0 16px' }}>
              <span className="np-kicker">Recent Dispatches</span>
              {recentDispatches.map((article) => (
                <div key={article.id} style={{ marginBottom: '14px' }}>
                  <a href={`/blog/${article.id}`} className="np-headline-link">
                    <h3 className="np-headline-md" style={{ marginBottom: '4px' }}>{article.title}</h3>
                  </a>
                  <div className="np-byline">{article.date} &middot; {article.category}</div>
                  <p className="np-body-text" style={{ marginTop: '6px' }}>{article.subtitle}</p>
                  <hr className="np-rule-thick" />
                </div>
              ))}

              <div className="np-box">
                <div className="np-box-title">Topics</div>
                {topics.map((topic) => (
                  <div className="np-box-row" key={topic}>
                    <span style={{ textTransform: 'capitalize' }}>{topic.replace(/-/g, ' ')}</span>
                    <span className="np-box-pg">&sect;</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="np-lower">
            {secondaryArticles.map((article) => (
              <div className="np-lower-col" key={article.id}>
                <span className="np-kicker" style={{ display: 'block' }}>{article.category.replace(/-/g, ' ')}</span>
                <a href={`/blog/${article.id}`} className="np-headline-link">
                  <h3 className="np-headline-md">{article.title}</h3>
                </a>
                <hr className="np-rule" />
                <p className="np-body-text">{article.lead}</p>
                <div className="np-byline">{article.author} &middot; {article.date}</div>
              </div>
            ))}
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
