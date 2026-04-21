/* eslint-disable @next/next/no-img-element */
/*
 * Blog Article template — Ship 1 refactor (2026-04-21, revised)
 *
 * Chrome now matches the approved D2 PDP mockup at /preview/pdp_mockup.html:
 *   Dateline (ink strip) -> Masthead (bone, gold double rule)
 *   -> primary Nav (single row) -> CredentialsBar (bone, below nav)
 *   -> BulletinBar (ink strip, outlined pill) -> <main.bs-stage> -> Footer
 *
 * Article content is preserved verbatim (title, byline, body, sidebars,
 * schema.org JSON-LD). The hero image is wrapped in a Specimen card for
 * the letterpress lift; body prose and sidebars flow on the watermark
 * (no outer hero Specimen card).
 *
 * newspaper.css is still imported because renderMarkdownBody emits
 * np-body-text / np-headline-xl / np-kicker / np-byline / np-drop /
 * np-pull-quote / np-box / np-ad-btn classes defined there. Porting
 * those into the broadsheet token system is a follow-on ship.
 */
import '../../newspaper.css';
import blogData from '../../../public/blog-articles.json';
import { notFound } from 'next/navigation';
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
      title: { absolute: 'Article not found | Roger Wilco Aviation Services' },
    };
  }

  const siteUrl = 'https://www.rogerwilcoaviation.com';
  const articleUrl = `${siteUrl}/blog/${article.id}`;
  const imageUrl = article.image
    ? (article.image.startsWith('http') ? article.image : `${siteUrl}${article.image}`)
    : `${siteUrl}/newspaper/images/logo.png`;

  return {
    title: { absolute: article.title.length <= 60 ? `${article.title} | RWAS` : article.title },
    description: article.lead.length > 155 ? article.lead.slice(0, 152).trimEnd() + '…' : article.lead,
    alternates: { canonical: articleUrl },
    openGraph: {
      title: article.title,
      description: article.lead.length > 155 ? article.lead.slice(0, 152).trimEnd() + '…' : article.lead,
      url: articleUrl,
      type: 'article',
      publishedTime: article.date,
      authors: article.byline ? [article.byline] : undefined,
      images: [{ url: imageUrl, alt: (article as { image_alt?: string }).image_alt || article.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.lead.length > 155 ? article.lead.slice(0, 152).trimEnd() + '…' : article.lead,
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

  const siteUrl = 'https://www.rogerwilcoaviation.com';
  const articleUrl = `${siteUrl}/blog/${article.id}`;
  const imageUrl = article.image
    ? (article.image.startsWith('http') ? article.image : `${siteUrl}${article.image}`)
    : `${siteUrl}/newspaper/images/logo.png`;
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${articleUrl}#article`,
    headline: article.title,
    description: article.lead.length > 155 ? article.lead.slice(0, 152).trimEnd() + '…' : article.lead,
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
    <BroadsheetLayout>
      {/* Article schema.org JSON-LD (P2.4) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref="/blog/" />
      <CredentialsBar />
      <BulletinBar />

      <main className="bs-stage">
        {/* Article header — kicker, title, byline. Flows directly on watermark. */}
        <header style={{ borderBottom: '2px solid var(--ink-900)', padding: '4px 0 18px' }}>
          <span className="np-kicker">{article.category.replace(/-/g, ' ')}</span>
          <h1 className="np-headline-xl" style={{ fontSize: '34px', margin: '6px 0' }}>
            {article.title}
          </h1>
          <div className="np-byline">
            {article.byline} &middot; {article.date} &middot; {article.source}
          </div>
        </header>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.6fr 1px 0.9fr',
            gap: 0,
            padding: '22px 0',
            alignItems: 'start',
          }}
        >
          {/* Body column */}
          <div style={{ padding: '0 22px 0 0' }}>
            {article.subtitle ? (
              <p
                className="np-body-text"
                style={{ fontStyle: 'italic', fontSize: '18px', lineHeight: 1.5, marginBottom: '14px' }}
              >
                {article.subtitle}
              </p>
            ) : null}

            {article.image ? (
              <figure style={{ margin: '0 0 18px' }}>
                <Specimen variant="hero">
                  <img
                    src={article.image}
                    alt={article.image_alt || article.title}
                    style={{ width: '100%', display: 'block' }}
                  />
                </Specimen>
              </figure>
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

          {/* Sidebar column — flat specimens filed inside the stage */}
          <div style={{ padding: '0 0 0 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Specimen variant="flat" as="aside">
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
            </Specimen>

            <Specimen variant="flat" as="aside">
              <div className="np-box-title">Topics</div>
              {article.tags.map((tag) => (
                <div className="np-box-row" key={tag}>
                  <span>{tag}</span>
                  <span className="np-box-pg">&sect;</span>
                </div>
              ))}
            </Specimen>

            <Specimen variant="flat" as="aside">
              <div className="np-box-title">Recent Dispatches</div>
              {relatedArticles.map((entry) => (
                <div className="np-box-row" key={entry.id}>
                  <a href={`/blog/${entry.id}`}>
                    <span>{entry.title}</span>
                    <span className="np-box-pg">&rarr;</span>
                  </a>
                </div>
              ))}
            </Specimen>
          </div>
        </div>
      </main>

      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
