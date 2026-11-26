#!/usr/bin/env node
// Keeps the standalone /garmin page's "Latest Garmin Dealer Memos" current by
// deriving it from published Garmin blog articles. Products are preserved.
// Output is deterministic (no build timestamps) so unchanged content does not churn.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const blogPath = path.join(root, 'public/blog-articles.json');
const offeringsPath = path.join(root, 'public/garmin-offerings.json');
const LIMIT = 6;
const LABELS = {
  'product-update': 'Product Update',
  'service-bulletin': 'Service Bulletin',
  'press-release': 'Press Release',
  memo: 'Dealer Memo',
  regulatory: 'Regulatory',
};

function summarize(text, max = 240) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:.\s]+$/, '') + '…';
}

const blog = JSON.parse(fs.readFileSync(blogPath, 'utf8'));
const offerings = JSON.parse(fs.readFileSync(offeringsPath, 'utf8'));
const articles = (blog.articles || [])
  .filter((a) => (a.status || 'published') === 'published' && a.id && a.date)
  .filter((a) => /garmin/i.test([a.title, ...(a.tags || [])].join(' ')))
  .sort((a, b) => String(b.date).localeCompare(String(a.date)))
  .slice(0, LIMIT);

if (!articles.length) {
  console.warn('generate-garmin-memos: no Garmin articles found; leaving offerings unchanged');
  process.exit(0);
}

const memos = articles.map((a) => ({
  date: String(a.date).slice(0, 10),
  category: LABELS[a.category] || a.category || 'Garmin',
  title: a.title,
  summary: summarize(a.lead || a.subtitle || ''),
  link: '/blog/' + encodeURIComponent(a.id),
}));

const next = { ...offerings, last_updated: memos[0].date, memos };
const out = JSON.stringify(next, null, 2) + '\n';
if (fs.readFileSync(offeringsPath, 'utf8') !== out) {
  fs.writeFileSync(offeringsPath, out);
  console.log(`generate-garmin-memos: wrote ${memos.length} memos (latest ${memos[0].date})`);
} else {
  console.log('generate-garmin-memos: up to date');
}
