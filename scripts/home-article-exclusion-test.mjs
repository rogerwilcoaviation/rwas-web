import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const handle = 'garmin-salem-aviation-open-house-2026';
const data = JSON.parse(readFileSync('public/blog-articles.json', 'utf8'));
const article = data.articles.find((item) => item.id === handle);
assert.equal(article.status, 'published');
const home = readFileSync('app/page.tsx', 'utf8');
assert.ok(!home.includes(handle));
assert.ok(!home.includes('Featured Event'));
assert.ok(!home.includes('garmin-salem-open-house-20260917.jpg'));
assert.match(home, /<h1[^>]*>\s*Introducing the AXIS Build-A-System Planner/);
assert.ok(home.includes('Latest From Garmin'));
assert.ok(home.includes('rwas-laser-steel-16x9-20260626.mp4'));
const result = await build({
  entryPoints: ['components/home/BlogArticlesFeed.tsx'],
  bundle: true, write: false, platform: 'node', format: 'cjs',
  jsx: 'automatic', external: ['react', 'react/jsx-runtime'],
});
const { createRequire } = await import('node:module');
const compiled = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(
  createRequire(import.meta.url), compiled, compiled.exports,
);
const html = renderToStaticMarkup(React.createElement(compiled.exports.default));
assert.ok(!html.includes(handle));
assert.ok(!html.includes(article.title));
const expected = data.articles.filter((item) => item.status === 'published' && item.id !== handle)
  .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
assert.equal((html.match(/<h3 /g) || []).length, expected.length);
for (const item of expected) assert.ok(html.includes('/blog/' + encodeURIComponent(item.id)));
assert.deepEqual(JSON.parse(readFileSync('public/blog-articles.json', 'utf8')), data);
console.log('PASS homepage feature/TOC absent, rendered feed excludes exact article, normal latest articles retained, article stays published, AXIS/video retained.');
