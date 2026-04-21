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
import blogData from '../../public/blog-articles.json';
import Link from 'next/link';

export const metadata = {
  title: 'Aviation News, Garmin Bulletins & Memos',
  description:
    'Garmin press releases, service bulletins, product updates, dealer memos, and industry dispatches from Roger Wilco Aviation Services.',
};

const publishedArticles = blogData.articles.filter((article) => article.status === 'published');
const leadArticle = publishedArticles[0];
const secondaryArticles = publishedArticles.slice(1);
const recentDispatches = publishedArticles.slice(0, 5);
const topics = blogData.meta.categories;

export default function BlogPage() {
  return (
    <BroadsheetLayout>
      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref="/blog" />
      <CredentialsBar />
      <BulletinBar />
      <main className="bs-stage">
        <section className="hero-headline-group">
          <p className="bs-kicker">Dispatches &amp; Bulletins</p>
          <p className="bs-script-accent">&mdash; from the RWAS avionics desk &mdash;</p>
          <h1 className="bs-headline bs-headline--hero">
            Blog Articles, Product Updates, and Shop Dispatches
          </h1>
          <p className="bs-subhead">
            Garmin updates, service bulletins, shop notes, and industry memos &mdash; current
            as of {blogData.meta.last_updated.slice(0, 10)}.
          </p>
          <p className="bs-byline">
            {blogData.meta.total_articles} published dispatches &middot; Topics: {topics.join(' / ')}
          </p>
        </section>

        {leadArticle && (
          <Specimen variant="hero">
            <p className="bs-kicker">Lead Article</p>
            <Link href={`/blog/${leadArticle.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <h2 className="bs-headline" style={{ marginTop: 6 }}>{leadArticle.title}</h2>
            </Link>
            <p className="bs-byline" style={{ marginTop: 8 }}>
              {leadArticle.byline} &middot; {leadArticle.date} &middot; {leadArticle.source}
            </p>
            <p className="bs-body" style={{ marginTop: 14 }}>{leadArticle.lead}</p>
            {leadArticle.body.slice(0, 2).map((paragraph, index) => (
              <p key={index} className="bs-body" style={{ marginTop: 10 }}>{paragraph}</p>
            ))}
            <p className="bs-kicker" style={{ marginTop: 18 }}>Filed Under</p>
            <p className="bs-body" style={{ marginTop: 4 }}>{leadArticle.tags.join(' · ')}</p>
            <div style={{ marginTop: 16 }}>
              <Link href={`/blog/${leadArticle.id}`} className="bs-cta-primary">
                Read the full dispatch
              </Link>
            </div>
          </Specimen>
        )}

        <Specimen variant="flat">
          <p className="bs-kicker">Recent Dispatches</p>
          <div style={{ marginTop: 12, display: 'grid', gap: 20 }}>
            {recentDispatches.map((article) => (
              <div key={article.id}>
                <Link href={`/blog/${article.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <h3 className="bs-headline" style={{ fontSize: '1.4rem' }}>{article.title}</h3>
                </Link>
                <p className="bs-byline" style={{ marginTop: 4 }}>
                  {article.date} &middot; {article.category}
                </p>
                <p className="bs-body" style={{ marginTop: 6 }}>{article.subtitle}</p>
              </div>
            ))}
          </div>
        </Specimen>

        {secondaryArticles.length > 0 && (
          <Specimen variant="flat">
            <p className="bs-kicker">More From The Desk</p>
            <div
              style={{
                marginTop: 16,
                display: 'grid',
                gap: 24,
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              }}
            >
              {secondaryArticles.map((article) => (
                <div key={article.id}>
                  <p className="bs-kicker" style={{ textTransform: 'capitalize' }}>
                    {article.category.replace(/-/g, ' ')}
                  </p>
                  <Link href={`/blog/${article.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <h3 className="bs-headline" style={{ fontSize: '1.3rem', marginTop: 4 }}>
                      {article.title}
                    </h3>
                  </Link>
                  <p className="bs-body" style={{ marginTop: 8 }}>{article.lead}</p>
                  <p className="bs-byline" style={{ marginTop: 8 }}>
                    {article.author} &middot; {article.date}
                  </p>
                </div>
              ))}
            </div>
          </Specimen>
        )}

        <Specimen variant="flat">
          <p className="bs-kicker">Topics</p>
          <div
            style={{
              marginTop: 12,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            {topics.map((topic) => (
              <span
                key={topic}
                className="bs-body"
                style={{
                  textTransform: 'capitalize',
                  padding: '6px 12px',
                  border: '1px solid var(--ink-700)',
                  borderRadius: 4,
                }}
              >
                {topic.replace(/-/g, ' ')}
              </span>
            ))}
          </div>
        </Specimen>
      </main>
      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
