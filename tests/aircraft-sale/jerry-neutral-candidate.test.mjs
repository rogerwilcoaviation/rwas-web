import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  mkdtemp,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { Miniflare } from './fixtures/workerd-options.mjs';
import { LANGUAGE_VERSION } from '../../lib/site-language.mjs';
import { listingCategories } from '../../lib/marketplace/schema.mjs';
import {
  WEBSITE_PROTOCOL,
  scopeKey,
} from '../../workers/jerry-website-transport/contract.mjs';

test('actual website sessions and native synthetic transport preserve account/surface isolation, saved work and deletion through feature rollback', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'jerry-neutral-candidate-')),
    root = process.env.JERRY_PAGES_ARTIFACT
      ? resolve(process.env.JERRY_PAGES_ARTIFACT)
      : temporary;
  let mf,
    enabled = false;
  const mail = [];
  const bundle = async (entry) =>
    (
      await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'neutral',
        conditions: ['workerd', 'worker', 'browser'],
        mainFields: ['module', 'main'],
        external: ['cloudflare:workers', 'node:*'],
        logLevel: 'silent',
      })
    ).outputFiles[0].text;
  try {
    if (root === temporary) {
      await mkdir(join(root, '_worker.js'));
      await writeFile(
        join(root, '_worker.js/index.js'),
        "export default {fetch(){return new Response('synthetic existing page')}}",
      );
      await writeFile(
        join(root, '_routes.json'),
        JSON.stringify({ version: 1, include: ['/*'], exclude: ['/ops/*'] }),
      );
      execFileSync(process.execPath, [
        'scripts/stage-service-intake.mjs',
        root,
      ]);
    }
    const workerRoot = join(root, '_worker.js'),
      names = (await readdir(workerRoot, { recursive: true }))
        .filter((n) => /\.(js|json)$/.test(n))
        .sort((a, b) =>
          a === 'index.js' ? -1 : b === 'index.js' ? 1 : a.localeCompare(b),
        );
    const modules = await Promise.all(
      names.map(async (name) => ({
        path: join(workerRoot, name),
        type: name.endsWith('.json') ? 'Text' : 'ESModule',
        contents: await readFile(join(workerRoot, name), 'utf8'),
      })),
    );
    const [sellerSource, transportSource] = await Promise.all([
      bundle('workers/aircraft-sale/entry.mjs'),
      bundle('workers/jerry-website-transport/entry.mjs'),
    ]);
    const options = () => ({
      durableObjectsPersist: join(temporary, 'durable'),
      d1Persist: join(temporary, 'd1'),
      r2Persist: join(temporary, 'r2'),
      workers: [
        {
          name: 'pages',
          modules,
          modulesRoot: workerRoot,
          compatibilityDate: '2026-09-01',
          bindings: { JERRY_CONVERSATIONS_ENABLED: String(enabled) },
          serviceBindings: {
            SELLER_API: 'seller',
            ASSETS: async (request) => {
              if (root === temporary)
                return Response.json({
                  version: LANGUAGE_VERSION,
                  entries: [{ text: 'Published synthetic website context' }],
                });
              const file = resolve(root, '.' + new URL(request.url).pathname);
              assert.ok(file.startsWith(root + sep));
              try {
                return new Response(await readFile(file), {
                  headers: {
                    'Content-Type': file.endsWith('.json')
                      ? 'application/json'
                      : 'text/html',
                  },
                });
              } catch {
                return new Response('not found', { status: 404 });
              }
            },
          },
          outboundService: () => {
            throw Error('No Pages egress');
          },
        },
        {
          name: 'seller',
          modules: true,
          script: sellerSource,
          compatibilityDate: '2026-09-01',
          durableObjects: {
            SELLER_STORE: { className: 'SellerStore', useSQLite: true },
            JERRY_CONVERSATIONS: {
              className: 'JerryConversations',
              useSQLite: true,
            },
          },
          d1Databases: ['SELLER_AUTH_DB'],
          r2Buckets: ['MEDIA'],
          bindings: {
            BETTER_AUTH_ENABLED: 'true',
            BETTER_AUTH_LOCAL: 'true',
            BETTER_AUTH_URL: 'http://localhost',
            BETTER_AUTH_SECRET:
              'synthetic-neutral-identity-secret-not-a-production-credential',
            BETTER_AUTH_QA_ENABLED: 'true',
            BETTER_AUTH_QA_EMAILS:
              'jerry+neutral-a@example.test,jerry+neutral-b@example.test',
            BETTER_AUTH_GOOGLE_ENABLED: 'false',
            BETTER_AUTH_APPLE_ENABLED: 'false',
            BETTER_AUTH_LEGACY_LINK_ENABLED: 'false',
            CLERK_PRODUCTION_ENABLED: 'false',
            EMAIL_CODE_LOGIN_ENABLED: 'false',
            PUBLIC_LISTINGS_ENABLED: 'false',
            RESEND_API_KEY: 'synthetic-mail-key-not-a-real-credential',
            FROM_EMAIL: 'fixture@example.test',
            JERRY_CONVERSATIONS_ENABLED: String(enabled),
          },
          serviceBindings: { JERRY_WEBSITE_TRANSPORT: 'transport' },
          outboundService: async (request) => {
            assert.equal(request.url, 'https://api.resend.com/emails');
            const body = await request.json();
            mail.push({
              to: body.to[0],
              link: body.text.match(/https?:\/\/\S+/)?.[0],
            });
            return Response.json({ id: 'synthetic-mail-only' });
          },
        },
        {
          name: 'transport',
          modules: true,
          script: transportSource,
          compatibilityDate: '2026-09-01',
          bindings: { JERRY_TRANSPORT_MODE: 'synthetic-fixture' },
          durableObjects: {
            JERRY_TRANSPORT_COPIES: {
              className: 'WebsiteTransportCopies',
              useSQLite: true,
            },
            JERRY_ADMISSION: { className: 'JerryAdmission', useSQLite: true },
          },
          outboundService: () => {
            throw Error('No provider/relay egress permitted');
          },
        },
      ],
    });
    mf = new Miniflare(options());
    const call = async (
      path,
      { method = 'GET', body, cookies, seller } = {},
    ) => {
      const r = await mf.dispatchFetch('http://localhost' + path, {
        method,
        redirect: 'manual',
        headers: {
          Origin: 'http://localhost',
          'CF-Connecting-IP': '192.0.2.50',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(cookies
            ? { Cookie: [...cookies].map(([k, v]) => k + '=' + v).join('; ') }
            : {}),
          ...(seller
            ? {
                Authorization: 'Bearer ' + seller.session,
                'X-RWAS-CSRF': seller.csrf,
              }
            : {}),
          ...(path.startsWith('/api/jerry/')
            ? { 'X-RWAS-Jerry': 'website-v1' }
            : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (cookies)
        for (const value of r.headers.getSetCookie()) {
          const pair = value.split(';')[0],
            n = pair.indexOf('=');
          cookies.set(pair.slice(0, n), pair.slice(n + 1));
        }
      return new Response(await r.arrayBuffer(), {
        status: r.status,
        headers: r.headers,
      });
    };
    const db = await mf.getD1Database('SELLER_AUTH_DB', 'seller');
    for (const sql of (
      await readFile(
        'workers/aircraft-sale/migrations/0001_seller_auth.sql',
        'utf8',
      )
    )
      .replace(/^--.*$/gm, '')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean))
      await db.prepare(sql).run();
    const signup = async (email) => {
      const cookies = new Map(),
        body = {
          name: 'Synthetic owner',
          email,
          password: 'synthetic-neutral-password-2026',
        };
      assert.equal(
        (
          await call('/api/aircraft-sale/identity/sign-up/email', {
            method: 'POST',
            body,
            cookies,
          })
        ).status,
        200,
      );
      const link = mail.findLast((m) => m.to === email)?.link;
      assert.ok(link);
      const verified = await mf.dispatchFetch(link, { redirect: 'manual' });
      await verified.arrayBuffer();
      assert.ok([200, 302].includes(verified.status));
      assert.equal(
        (
          await call('/api/aircraft-sale/identity/sign-in/email', {
            method: 'POST',
            body: { email, password: body.password },
            cookies,
          })
        ).status,
        200,
      );
      const business = await call('/api/aircraft-sale/auth/better-auth', {
        method: 'POST',
        cookies,
        body: {},
      });
      assert.equal(business.status, 200);
      return { cookies, seller: await business.json() };
    };
    assert.deepEqual(await (await call('/api/jerry/context')).json(), {
      enabled: false,
    });
    const a = await signup('jerry+neutral-a@example.test'),
      b = await signup('jerry+neutral-b@example.test');
    const values = {
      workflowVersion: '3',
      listingType: 'tools',
      category: listingCategories.find((c) => c.type === 'tools').id,
      title: 'PRESERVE SYNTHETIC MANUAL DRAFT',
      description: 'Keep this description',
      sellerLocation: 'Synthetic location',
    };
    assert.equal(
      (
        await call('/api/aircraft-sale/draft/autosave', {
          method: 'PUT',
          ...a,
          body: { expectedRevision: null, values, step: 2 },
        })
      ).status,
      200,
    );
    enabled = true;
    await mf.setOptions(options());
    const ca = (await (await call('/api/jerry/context', a)).json()).identity,
      cb = (await (await call('/api/jerry/context', b)).json()).identity;
    assert.ok(ca.owner && cb.owner && ca.owner !== cb.owner);
    const website = (
      operation,
      body = {},
      account = a,
      identity = ca,
      surface = 'exchange',
      page = '/aircraft-for-sale',
    ) =>
      call('/api/jerry/website', {
        method: 'POST',
        ...account,
        body: {
          operation,
          expected: { owner: identity.owner, sessionRef: identity.sessionRef },
          surface,
          page,
          body,
        },
      });
    const c = (
      await (await website('create', { id: crypto.randomUUID() })).json()
    ).conversation;
    const turn = {
      id: c.id,
      generation: 1,
      turnId: crypto.randomUUID(),
      input: {
        message: 'SYNTHETIC ACCOUNT A QUESTION',
        mode: 'chat',
        locale: 'en',
        page: '/aircraft-for-sale',
      },
    };
    const first = await website('message', turn);
    assert.equal(first.status, 200, await first.clone().text());
    assert.match((await first.json()).result.reply, /Synthetic website-only/);
    assert.equal((await website('message', turn)).status, 200);
    assert.equal((await website('read', { id: c.id }, b, ca)).status, 401);
    assert.equal((await website('read', { id: c.id }, b, cb)).status, 410);
    assert.equal(
      (await website('read', { id: c.id }, a, ca, 'public', '/')).status,
      410,
    );
    assert.equal(
      (await website('read', { id: c.id }, a, ca, 'public', '/ops')).status,
      403,
    );
    const snapshot = await website('message', {
      ...turn,
      turnId: crypto.randomUUID(),
      input: { ...turn.input, message: 'Resume saved listing', mode: 'resume' },
    });
    assert.equal(snapshot.status, 200);
    assert.equal(
      (await snapshot.json()).result.action.type,
      'resume_saved_draft',
    );
    const beforeDraft = await (
      await call('/api/aircraft-sale/draft', a)
    ).json();
    enabled = false;
    await mf.setOptions(options());
    assert.deepEqual(await (await call('/api/jerry/context', a)).json(), {
      enabled: false,
    });
    enabled = true;
    await mf.setOptions(options());
    const deletion = await website('delete', { id: c.id, generation: 1 });
    assert.equal(deletion.status, 200);
    assert.equal((await deletion.json()).deleted, true);
    assert.equal((await website('read', { id: c.id })).status, 410);
    const copyNs = await mf.getDurableObjectNamespace(
        'JERRY_TRANSPORT_COPIES',
        'transport',
      ),
      scope = {
        category: 'account',
        owner: ca.owner,
        surface: 'exchange',
        conversationId: c.id,
        generation: 1,
        sessionRef: ca.sessionRef,
        sessionExpiresAt: ca.expiresAt,
      };
    const status = await copyNs
      .get(copyNs.idFromName(scopeKey(scope)))
      .fetch('https://website-copies.internal/status', {
        method: 'POST',
        body: JSON.stringify({
          protocol: WEBSITE_PROTOCOL,
          scope,
          operationId: turn.turnId,
          kind: 'respond',
        }),
      });
    assert.equal((await status.json()).state, 'erased');
    assert.deepEqual(
      await (await call('/api/aircraft-sale/draft', a)).json(),
      beforeDraft,
    );
    await call('/api/aircraft-sale/identity/sign-out', {
      method: 'POST',
      ...a,
      body: {},
    });
    assert.equal((await website('list')).status, 401);
  } finally {
    await mf?.dispose();
    await rm(temporary, { recursive: true, force: true });
  }
});
