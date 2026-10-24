import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { parse } from 'parse5';
import ts from 'typescript';
import {
  normalizeText,
  sourceId,
  pageKey,
  languageForPath,
  LANGUAGE_VERSION,
} from '../lib/site-language.mjs';
const root = resolve(process.argv[2] || '.vercel/output/static');
const output = resolve(root, '_site-language');
await mkdir(resolve(output, 'pages'), { recursive: true });
const skipTags = new Set([
  'script',
  'style',
  'pre',
  'code',
  'noscript',
  'textarea',
  'svg',
]);
const good = (text) =>
  text.length > 1 &&
  text.length <= 5000 &&
  /[A-Za-zÀ-ÿ]{2}/.test(text) &&
  !/^(?:https?:|mailto:|tel:|\/)/.test(text) &&
  !/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(text);
async function files(dir, extensions) {
  const result = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (
      item.name.startsWith('.') ||
      [
        '_worker.js',
        '_next',
        'node_modules',
        '_site-language',
        'work-order-system',
      ].includes(item.name)
    )
      continue;
    const path = resolve(dir, item.name);
    if (item.isDirectory()) result.push(...(await files(path, extensions)));
    else if (extensions.some((ext) => item.name.endsWith(ext)))
      result.push(path);
  }
  return result;
}
const common = new Set();
for (const dir of ['app', 'components', 'lib'])
  for (const file of await files(resolve(dir), ['.tsx', '.ts', '.mjs'])) {
    if (
      /\/app\/(?:es|pt-br)\//.test(file) ||
      /activity-content\.mjs$/.test(file)
    )
      continue;
    const code = await readFile(file, 'utf8'),
      tree = ts.createSourceFile(
        file,
        code,
        ts.ScriptTarget.Latest,
        true,
        file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.JS,
      );
    const visit = (node) => {
      if (
        ts.isJsxText(node) ||
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node)
      ) {
        const value = normalizeText(node.text);
        if (
          good(value) &&
          !/[<>{};`\\]/.test(value) &&
          (/\s/.test(value) || /^[A-Za-z]{2,30}$/.test(value))
        )
          common.add(value);
      }
      if (ts.isTemplateExpression(node)) {
        const value = normalizeText(
          node.head.text +
            node.templateSpans
              .map((span, i) => `__RWAS_DYNAMIC${i}__` + span.literal.text)
              .join(''),
        );
        if (
          good(value) &&
          !/[<>{};`\\]/.test(value) &&
          /[A-Za-z]{3}/.test(value.replace(/__RWAS_DYNAMIC\d+__/g, ''))
        )
          common.add(value);
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
const entries = async (set, language) =>
  Promise.all(
    [...set].sort().map(async (text) => ({
      id: await sourceId(text, language),
      text,
      language,
    })),
  );
const prepared = JSON.parse(
  await readFile(resolve('data/site-language-prepared.json'), 'utf8'),
);
const translations = {};
for (const entry of prepared.entries) {
  if (entry.id !== (await sourceId(entry.text, entry.language)))
    throw Error('Prepared translation source hash mismatch.');
  for (const [language, text] of Object.entries(entry.translations)) {
    if (
      !['en', 'es', 'pt-BR'].includes(language) ||
      typeof text !== 'string' ||
      !text.trim()
    )
      throw Error('Invalid prepared translation.');
    (translations[language] ||= {})[entry.id] = text;
  }
}
const commonEntries = await entries(common, 'en');
const commonContent = JSON.stringify({
  version: LANGUAGE_VERSION,
  entries: commonEntries,
  translations,
});
const commonPath =
  '/_site-language/common.' + (await sourceId(commonContent)) + '.json';
await writeFile(resolve(root, '.' + commonPath), commonContent);
await writeFile(
  resolve(output, 'common.json'),
  JSON.stringify({
    version: LANGUAGE_VERSION,
    entries: commonEntries,
    translations,
    commonPath,
  }),
);
let pages = 0;
for (const file of await files(root, ['.html'])) {
  const route = '/' + relative(root, file).replaceAll('\\', '/');
  if (/^\/(?:ops|work-order-system)\//.test(route)) continue;
  const source = new Set(),
    tree = parse(await readFile(file, 'utf8'));
  const visit = (node, skip = false) => {
    skip ||=
      skipTags.has(node.tagName) ||
      node.attrs?.some((a) => a.name === 'translate' && a.value === 'no');
    if (!skip && node.nodeName === '#text') {
      const value = normalizeText(node.value);
      if (good(value)) source.add(value);
    }
    if (!skip)
      for (const attr of node.attrs || [])
        if (['title', 'alt', 'aria-label', 'placeholder'].includes(attr.name)) {
          const value = normalizeText(attr.value);
          if (good(value)) source.add(value);
        }
    if (!skip) for (const child of node.childNodes || []) visit(child, skip);
  };
  visit(tree);
  const routes = new Set([
    route,
    route.replace(/\/index\.html$/, '/').replace(/\.html$/, ''),
  ]);
  if (route === '/index.html') routes.add('/');
  const content = JSON.stringify({
    version: LANGUAGE_VERSION,
    language: languageForPath(route),
    entries: await entries(source, languageForPath(route)),
  });
  for (const path of routes) {
    await writeFile(
      resolve(
        output,
        'pages',
        (await pageKey(path.replace(/\/$/, '') || '/')) + '.json',
      ),
      content,
    );
    pages++;
  }
}
console.log(
  JSON.stringify({
    publicPageAliases: pages,
    commonInterfaceStrings: common.size,
    output,
  }),
);
