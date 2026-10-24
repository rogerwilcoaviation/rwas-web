import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSiteLanguage } from '../functions/_site-language/translate.mjs';
import {
  sourceId,
  pageKey,
  safePage,
  protectText,
  restoreText,
} from '../lib/site-language.mjs';
import { Miniflare } from 'miniflare';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
const origin = 'https://www.rogerwilcoaviation.com';
async function fixture(text = 'Book Service') {
  const entry = { id: await sourceId(text), text, language: 'en' },
    store = new Map(),
    promises = [],
    calls = [];
  const env = {
    ASSETS: {
      async fetch(request) {
        return Response.json({
          entries: new URL(request.url).pathname.endsWith('common.json')
            ? [entry]
            : [],
        });
      },
    },
    SITE_AI: {
      async run(model, input) {
        calls.push(input);
        return {
          response: JSON.stringify({
            translations: JSON.parse(input.input[1].content).map(
              (row) => 'Traducido: ' + row.text,
            ),
          }),
        };
      },
    },
  };
  const cache = {
    async match(request) {
      return store.get(request.url)?.clone();
    },
    async put(request, response) {
      store.set(request.url, response.clone());
    },
  };
  const request = (body = {}, headers = {}) =>
    new Request(origin + '/api/site-language', {
      method: 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        path: '/',
        language: 'es',
        ids: [entry.id],
        ...body,
      }),
    });
  const send = async (body, headers) => {
    const response = await handleSiteLanguage(
      request(body, headers),
      env,
      {
        waitUntil(p) {
          promises.push(p);
        },
      },
      cache,
    );
    await Promise.all(promises);
    return response;
  };
  return { entry, env, calls, cache, send, request };
}
test('only published IDs reach inference, with no cookies or arbitrary browser text', async () => {
  const f = await fixture('FAA Part 145 repair station.');
  const response = await f.send({}, { Cookie: 'private=session' });
  assert.equal(response.status, 200);
  assert.equal(
    (await response.json()).translations[f.entry.id],
    'Traducido: FAA Part 145 repair station.',
  );
  assert.equal(f.calls.length, 1);
  assert.doesNotMatch(JSON.stringify(f.calls), /private=session/);
  assert.match(JSON.stringify(f.calls), /__RWAS_KEEP/);
  assert.equal((await f.send({ text: 'private conversation' })).status, 400);
  assert.equal((await f.send({ ids: ['a'.repeat(64)] })).status, 400);
  assert.equal(f.calls.length, 1);
});
test('source and target languages have separate reusable caches', async () => {
  const f = await fixture();
  await f.send();
  await f.send();
  assert.equal(f.calls.length, 1);
  await f.send({ language: 'pt-BR' });
  assert.equal(f.calls.length, 2);
  const response = await f.send({ language: 'en' });
  assert.equal(
    (await response.json()).translations[f.entry.id],
    'Book Service',
  );
  assert.equal(f.calls.length, 2);
});
test('Responses API consumes only the final output and keeps reasoning out of the page', async () => {
  const f = await fixture();
  f.env.SITE_AI.run = async (model, input) => {
    assert.equal(input.reasoning.effort, 'low');
    assert.equal(input.text.format.type, 'json_object');
    assert.ok(input.input[0].content.includes('schedule maintenance'));
    return {
      output: [
        {
          type: 'reasoning',
          content: [
            { type: 'reasoning_text', text: 'analysis must never appear' },
          ],
        },
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: '{"translations":["Reservar servicio"]}',
            },
          ],
        },
      ],
    };
  };
  const response = await f.send();
  assert.equal(response.status, 200);
  assert.equal(
    (await response.json()).translations[f.entry.id],
    'Reservar servicio',
  );
});
test('prepared public translations retain source hashes, numbers and key navigation meanings', async () => {
  const prepared = JSON.parse(
    await readFile(
      new URL('../data/site-language-prepared.json', import.meta.url),
      'utf8',
    ),
  );
  for (const entry of prepared.entries) {
    assert.equal(entry.id, await sourceId(entry.text, entry.language));
    for (const value of Object.values(entry.translations))
      assert.deepEqual(
        value.match(/\d+(?:[.,:/-]\d+)*/g) || [],
        entry.text.match(/\d+(?:[.,:/-]\d+)*/g) || [],
      );
  }
  assert.equal(
    prepared.entries.find((entry) => entry.text === 'Create a Listing')
      .translations.es,
    'Crear un anuncio',
  );
  assert.match(
    prepared.entries.find((entry) => entry.text === 'Book Service')
      .translations['pt-BR'],
    /Agendar/,
  );
});
test('unavailable inference and corrupted identifiers fail closed', async () => {
  const f = await fixture('Garmin GFC 500 for FAA Part 145.');
  f.env.SITE_AI.run = async () => ({
    response: '{"translations":["Número 999"]}',
  });
  assert.equal((await f.send()).status, 503);
  delete f.env.SITE_AI;
  assert.equal((await f.send()).status, 503);
  const protectedText = protectText(
    'Garmin GFC 500, N123AB, john@example.com, $2,500.',
  );
  assert.equal(
    restoreText(protectedText.text, protectedText.values),
    'Garmin GFC 500, N123AB, john@example.com, $2,500.',
  );
  assert.throws(() => restoreText('changed', protectedText.values));
});
test('cross-origin, private paths, malformed and oversized requests are rejected', async () => {
  const f = await fixture();
  assert.equal((await f.send({}, { Origin: 'https://evil.test' })).status, 403);
  assert.equal((await f.send({ path: '/ops/private' })).status, 400);
  assert.equal((await f.send({ ids: Array(21).fill(f.entry.id) })).status, 400);
  for (const path of [
    '/../secret',
    '/api/aircraft-sale/admin',
    '/faq?token=private',
    '/work-order-system',
    '/_next/static.js',
  ])
    assert.equal(safePage(path), false);
  const large = new Request(origin + '/api/site-language', {
    method: 'POST',
    headers: { Origin: origin },
    body: 'x'.repeat(10001),
  });
  assert.equal(
    (await handleSiteLanguage(large, f.env, {}, f.cache)).status,
    413,
  );
  const malformed = new Request(origin + '/api/site-language', {
    method: 'POST',
    headers: { Origin: origin },
    body: '{',
  });
  assert.equal(
    (await handleSiteLanguage(malformed, f.env, {}, f.cache)).status,
    400,
  );
  assert.equal(f.calls.length, 0);
});
test('missing static page still supplies interface labels for published UUID listings', async () => {
  const f = await fixture();
  f.env.ASSETS.fetch = async (request) =>
    new URL(request.url).pathname.endsWith('common.json')
      ? Response.json({ entries: [f.entry] })
      : new Response('Not found', { status: 404 });
  const response = await handleSiteLanguage(
    new Request(
      origin +
        '/api/site-language/catalog?path=/aircraft-for-sale/11111111-1111-4111-8111-111111111111',
    ),
    f.env,
    {},
    f.cache,
  );
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).entries, [f.entry]);
});
test('advanced Pages wrapper injects raw HTML only after hydration marker check and isolates APIs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'rwas-language-wrapper-'));
  let mf;
  try {
    await mkdir(join(root, '_worker.js'));
    await writeFile(
      join(root, '_routes.json'),
      JSON.stringify({ version: 1, include: ['/*'], exclude: ['/ops/*'] }),
    );
    await writeFile(
      join(root, '_worker.js/index.js'),
      `export default {fetch(request){return new Response('<html><head>'+ (new URL(request.url).pathname==='/react'?'<meta name="rwas-react-language" content="true">':'')+'</head><body><h1>Test</h1></body></html>',{headers:{'Content-Type':'text/html','Content-Security-Policy-Report-Only':'preserved'}})}}`,
    );
    execFileSync(process.execPath, ['scripts/stage-service-intake.mjs', root]);
    assert.ok(
      JSON.parse(
        await readFile(join(root, '_routes.json'), 'utf8'),
      ).exclude.includes('/_site-language/*'),
    );
    mf = new Miniflare({
      modules: true,
      modulesRules: [{ type: 'ESModule', include: ['**/*.js'] }],
      scriptPath: join(root, '_worker.js/index.js'),
      modulesRoot: join(root, '_worker.js'),
      compatibilityDate: '2026-09-01',
      serviceBindings: {
        ASSETS: async () => Response.json({ entries: [] }),
        SELLER_API: async (request) => {
          assert.equal(request.headers.get('Cookie'), null);
          assert.match(
            new URL(request.url).pathname,
            /^\/api\/aircraft-sale\/listing\/[a-f0-9-]+$/,
          );
          return new Response(
            '<html><head><style>ignore private style</style></head><body><h1>Published aircraft</h1><p>Available in Yankton.</p><script>ignore script text</script></body></html>',
            { headers: { 'Content-Type': 'text/html' } },
          );
        },
      },
    });
    const published = await mf.dispatchFetch(
      origin +
        '/api/site-language/catalog?path=/aircraft-for-sale/11111111-1111-4111-8111-111111111111',
      { headers: { Cookie: 'private=session' } },
    );
    const publishedCatalog = await published.json();
    assert.ok(
      publishedCatalog.entries.some(
        (entry) => entry.text === 'Published aircraft',
      ),
    );
    assert.doesNotMatch(
      JSON.stringify(publishedCatalog),
      /ignore|private=session/,
    );
    const raw = await mf.dispatchFetch(origin + '/raw');
    assert.equal(
      raw.headers.get('Content-Security-Policy-Report-Only'),
      'preserved',
    );
    assert.match(await raw.text(), /site-language.js/);
    assert.doesNotMatch(
      await (await mf.dispatchFetch(origin + '/react')).text(),
      /site-language.js/,
    );
    assert.doesNotMatch(
      await (await mf.dispatchFetch(origin + '/ops/private')).text(),
      /site-language.js/,
    );
    assert.equal(
      (
        await mf.dispatchFetch(origin + '/api/site-language', {
          method: 'POST',
          headers: { Origin: 'https://evil.test' },
        })
      ).status,
      403,
    );
  } finally {
    await mf?.dispose();
    await rm(root, { recursive: true, force: true });
  }
});
