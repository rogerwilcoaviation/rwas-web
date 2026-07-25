import { NextResponse } from 'next/server';
import { siteConfig } from '@/data/config/site.settings';
import blogData from '../../public/blog-articles.json';

export const dynamic = 'force-static';

interface Article {
  id: string;
  status: string;
  category?: string;
  title: string;
  subtitle?: string;
  author?: string;
  date: string;
  lead?: string;
  tags?: string[];
  image?: string;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const site = siteConfig.siteUrl.replace(/\/$/, '');
  const articles = ((blogData as { articles?: Article[] }).articles || [])
    .filter((a) => a.status === 'published')
    .sort((a, b) => b.date.localeCompare(a.date));

  const now = new Date().toUTCString();

  const items = articles
    .map((a) => {
      const url = `${site}/blog/${a.id}`;
      const pubDate = new Date(a.date + 'T12:00:00Z').toUTCString();
      const description = a.lead || a.subtitle || '';
      const categories = (a.tags && a.tags.length ? a.tags : [a.category || 'blog'])
        .map((t) => `      <category>${escapeXml(t)}</category>`)
        .join('\n');
      const imageEnclosure = a.image
        ? `      <enclosure url="${site}${a.image}" type="image/jpeg" />\n`
        : '';
      return `    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(description)}</description>
${categories}
${imageEnclosure}      <dc:creator>${escapeXml(a.author || 'Roger Wilco Aviation Services')}</dc:creator>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Roger Wilco Aviation Services — Blog</title>
    <link>${site}/blog</link>
    <description>Service bulletins, Garmin product updates, regulatory notes, and maintenance insights from RWAS, an FAA Part 145 repair station in Yankton, SD.</description>
    <language>en-us</language>
    <copyright>Copyright ${new Date().getFullYear()} Roger Wilco Aviation Services</copyright>
    <lastBuildDate>${now}</lastBuildDate>
    <generator>Next.js (rwas-web)</generator>
    <atom:link href="${site}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
