/* eslint-disable @next/next/no-html-link-for-pages */
/* eslint-disable @next/next/no-img-element */
import '../../newspaper.css';
import blogData from '../../../public/blog-articles.json';
import { notFound } from 'next/navigation';

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatInlineMarkdown(text: string) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function renderMarkdownBody(markdown?: string) {
  if (!markdown) return [] as string[];

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let usedDrop = false;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const cls = usedDrop ? 'np-body-text' : 'np-body-text np-drop';
    usedDrop = true;
    blocks.push(`<p class="${cls}">${formatInlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(`<ul style="margin:10px 0 10px 22px;">${listItems
      .map((item) => `<li class="np-body-text" style="text-align:left; margin:4px 0;">${formatInlineMarkdown(item)}</li>`)
      .join('')}</ul>`);
    listItems = [];
  };

  const imageMatch = (line: string) => line.match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)$/);

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }
    const image = imageMatch(trimmed);
    if (image) {
      flushParagraph();
      flushList();
      const [, alt, src] = image;
      blocks.push(`<figure style="margin:18px 0;"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" style="width:100%;border:1px solid #1a1a1a;display:block;" /><figcaption class="np-kicker" style="margin-top:6px;">${escapeHtml(alt)}</figcaption></figure>`);
      continue;
    }
    if (/^###\s+/.test(trimmed)) {
      flushParagraph();
      flushList();
      blocks.push(`<h3 class="np-headline-md" style="margin-top:14px;">${formatInlineMarkdown(trimmed.replace(/^###\s+/, ''))}</h3>`);
      continue;
    }
    if (/^##\s+/.test(trimmed)) {
      flushParagraph();
      flushList();
      blocks.push(`<h2 class="np-headline-xl" style="font-size:22px; margin-top:14px;">${formatInlineMarkdown(trimmed.replace(/^##\s+/, ''))}</h2>`);
      continue;
    }
    if (/^-\s+/.test(trimmed)) {
      flushParagraph();
      listItems.push(trimmed.replace(/^-\s+/, ''));
      continue;
    }
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  return blocks;
}

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

  const siteUrl = 'https://rogerwilcoaviation.com';
  const articleUrl = `${siteUrl}/blog/${article.id}`;
  const imageUrl = article.image
    ? (article.image.startsWith('http') ? article.image : `${siteUrl}${article.image}`)
    : `${siteUrl}/newspaper/images/logo.png`;

  return {
    title: `${article.title} | Blog Articles`,
    description: article.lead,
    alternates: { canonical: articleUrl },
    openGraph: {
      title: article.title,
      description: article.lead,
      url: articleUrl,
      type: 'article',
      publishedTime: article.date,
      authors: article.byline ? [article.byline] : undefined,
      images: [{ url: imageUrl, alt: (article as { image_alt?: string }).image_alt || article.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.lead,
      images: [imageUrl],
    },
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
  const markdownBlocks = renderMarkdownBody((article as { body_markdown?: string }).body_markdown);

  const siteUrl = 'https://rogerwilcoaviation.com';
  const articleUrl = `${siteUrl}/blog/${article.id}`;
  const imageUrl = article.image
    ? (article.image.startsWith('http') ? article.image : `${siteUrl}${article.image}`)
    : `${siteUrl}/newspaper/images/logo.png`;
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${articleUrl}#article`,
    headline: article.title,
    description: article.lead,
    image: [imageUrl],
    datePublished: (article as { published_at?: string }).published_at || article.date,
    dateModified: (article as { published_at?: string }).published_at || article.date,
    author: {
      '@type': 'Organization',
      name: article.byline || 'Roger Wilco Aviation Services',
      url: siteUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Roger Wilco Aviation Services',
      '@id': `${siteUrl}#organization`,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/newspaper/images/logo.png`,
      },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl },
    articleSection: article.category,
    keywords: (article as { tags?: string[] }).tags ? (article as { tags: string[] }).tags.join(', ') : undefined,
    isPartOf: { '@id': `${siteUrl}#website` },
  };

  return (
    <div className="np-wrapper" style={{ background: '#ddd9d2', minHeight: '100vh', fontFamily: "Georgia, 'Times New Roman', serif" }}>
      {/* Article schema.org JSON-LD (P2.4) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
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
          <a href="/aircraft-for-sale">Aircraft 4 Sale</a>
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

              {article.image ? (
                <div style={{ marginBottom: '12px' }}>
                  <img
                    src={article.image}
                    alt={article.image_alt || article.title}
                    style={{ width: '100%', border: '1px solid #1a1a1a', display: 'block' }}
                  />
                </div>
              ) : null}

              {markdownBlocks.length ? (
                markdownBlocks.map((block, index) => (
                  <div key={index} dangerouslySetInnerHTML={{ __html: block }} />
                ))
              ) : (
                <>
                  <p className="np-body-text np-drop">{article.lead}</p>
                  {article.body.map((paragraph, index) => (
                    <p key={index} className="np-body-text">{paragraph}</p>
                  ))}
                </>
              )}

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
