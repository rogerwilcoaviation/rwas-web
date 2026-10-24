import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readFile,
  readdir,
  mkdtemp,
  mkdir,
  writeFile,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { Miniflare } from './fixtures/workerd-options.mjs';
import { LANGUAGE_VERSION } from '../../lib/site-language.mjs';
import { listingCategories } from '../../lib/marketplace/schema.mjs';

async function candidate(controlledAlarm = false) {
  const origin = 'http://localhost',
    mail = [],
    provider = [];
  let releaseProvider,
    providerStarted,
    hold = false;
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
  let [sellerSource, responseSource] = await Promise.all([
    bundle('workers/aircraft-sale/entry.mjs'),
    bundle('workers/jerry-response/entry.mjs'),
  ]);
  if (controlledAlarm)
    sellerSource = (
      await build({
        stdin: {
          resolveDir: process.cwd(),
          contents: `
 export {default,SellerStore} from './workers/aircraft-sale/entry.mjs';
 import {JerryConversations as Base} from './workers/aircraft-sale/jerry-conversations.mjs';
 export class JerryConversations extends Base {
 async fetch(request){if(new URL(request.url).pathname==='/__fixture_fire_alarm'){await request.arrayBuffer();await this.alarm();return Response.json({ok:true});}return super.fetch(request);}
 }`,
        },
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
  const temporary = await mkdtemp(join(tmpdir(), 'jerry-complete-candidate-'));
  let root = process.env.JERRY_PAGES_ARTIFACT
    ? resolve(process.env.JERRY_PAGES_ARTIFACT)
    : temporary;
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
    execFileSync(process.execPath, ['scripts/stage-service-intake.mjs', root]);
  }
  // Load the exact emitted modules explicitly, as Wrangler does. Miniflare's
  // discovery parser rejects an unused variable import in the Next bundle.
  // No emitted source is rewritten or replaced for artifact qualification.
  const workerRoot = join(root, '_worker.js');
  const moduleNames = (await readdir(workerRoot, { recursive: true }))
    .filter((name) => /\.(?:js|json)$/.test(name))
    .sort((a, b) =>
      a === 'index.js' ? -1 : b === 'index.js' ? 1 : a.localeCompare(b),
    );
  const pagesModules = await Promise.all(
    moduleNames.map(async (name) => ({
      type: name.endsWith('.json') ? 'Text' : 'ESModule',
      path: join(workerRoot, name),
      contents: await readFile(join(workerRoot, name), 'utf8'),
    })),
  );
  const sourceAsset = async (request) => {
    const path = new URL(request.url).pathname;
    if (root === temporary)
      return Response.json({
        version: LANGUAGE_VERSION,
        entries: [{ text: 'Published synthetic reference' }],
      });
    const file = resolve(root, '.' + path);
    assert.ok(file.startsWith(root + sep));
    try {
      return new Response(await readFile(file), {
        headers: {
          'Content-Type': path.endsWith('.json')
            ? 'application/json'
            : path.endsWith('.js')
              ? 'application/javascript'
              : 'text/html',
        },
      });
    } catch {
      return new Response('not found', { status: 404 });
    }
  };
  let enabled = false,
    withConversations = false,
    mf;
  const options = () => ({
    durableObjectsPersist: join(temporary, 'durable'),
    d1Persist: join(temporary, 'd1'),
    r2Persist: join(temporary, 'r2'),
    workers: [
      {
        name: 'pages',
        modulesRoot: workerRoot,
        modules: pagesModules,
        compatibilityDate: '2026-09-01',
        bindings: { JERRY_CONVERSATIONS_ENABLED: String(enabled) },
        serviceBindings: { SELLER_API: 'seller', ASSETS: sourceAsset },
        outboundService: async () => {
          throw Error('Unexpected Pages egress');
        },
      },
      {
        name: 'seller',
        script: sellerSource,
        modules: true,
        compatibilityDate: '2026-09-01',
        durableObjects: {
          SELLER_STORE: { className: 'SellerStore', useSQLite: true },
          ...(withConversations
            ? {
                JERRY_CONVERSATIONS: {
                  className: 'JerryConversations',
                  useSQLite: true,
                },
              }
            : {}),
        },
        d1Databases: ['SELLER_AUTH_DB'],
        r2Buckets: ['MEDIA'],
        bindings: {
          BETTER_AUTH_ENABLED: 'true',
          BETTER_AUTH_LOCAL: 'true',
          BETTER_AUTH_URL: origin,
          BETTER_AUTH_SECRET:
            'synthetic-candidate-identity-secret-not-a-real-credential',
          BETTER_AUTH_QA_ENABLED: 'true',
          BETTER_AUTH_QA_EMAILS:
            'jerry+readiness-a@example.test,jerry+readiness-b@example.test',
          BETTER_AUTH_GOOGLE_ENABLED: 'false',
          BETTER_AUTH_APPLE_ENABLED: 'false',
          BETTER_AUTH_LEGACY_LINK_ENABLED: 'false',
          CLERK_PRODUCTION_ENABLED: 'false',
          EMAIL_CODE_LOGIN_ENABLED: 'false',
          PUBLIC_LISTINGS_ENABLED: 'false',
          RESEND_API_KEY: 'synthetic-mail-fixture-not-a-real-key',
          FROM_EMAIL: 'fixture@example.test',
          JERRY_CONVERSATIONS_ENABLED: String(enabled),
          ACCOUNT_ADMIN_SITE_ORIGIN: origin,
        },
        serviceBindings: {
          JERRY_RESPONSE: 'response',
          ACCOUNT_ADMIN_AUTH: async (request) =>
            request.headers.get('Authorization') ===
            'Bearer synthetic-readonly-admin'
              ? Response.json({
                  actor: 'synthetic-admin',
                  scope: 'seller-accounts',
                  authenticatedAt: Date.now(),
                  expiresAt: Date.now() + 3600000,
                })
              : new Response(null, { status: 403 }),
        },
        outboundService: async (request) => {
          assert.equal(
            request.url,
            'https://api.resend.com/emails',
            'No external seller-service egress is allowed',
          );
          const body = await request.json();
          mail.push({
            to: body.to[0],
            link: body.text.match(/https?:\/\/\S+/)?.[0],
          });
          return Response.json({ id: 'synthetic-mail' });
        },
      },
      {
        name: 'response',
        script: responseSource,
        modules: true,
        compatibilityDate: '2026-09-01',
        durableObjects: {
          JERRY_ADMISSION: { className: 'JerryAdmission', useSQLite: true },
        },
        bindings: {
          OPENAI_API_KEY: 'synthetic-api-key-not-a-real-credential',
          OPENAI_PROJECT_ID: 'proj_synthetic',
          JERRY_MODEL: 'synthetic-model',
          JERRY_PROMPT_CACHE_RETENTION: 'in_memory',
        },
        outboundService: async (request) => {
          assert.equal(request.url, 'https://api.openai.com/v1/responses');
          assert.equal(request.headers.get('OpenAI-Project'), 'proj_synthetic');
          assert.equal(request.headers.get('Cookie'), null);
          const body = await request.json();
          assert.equal(body.store, false);
          assert.equal(body.prompt_cache_retention, 'in_memory');
          assert.equal(body.tools, undefined);
          assert.equal(body.admission, undefined);
          assert.ok(!JSON.stringify(body).includes('192.0.2.'));
          assert.ok(!JSON.stringify(body).includes('jerry+readiness-'));
          provider.push(body);
          if (hold) {
            hold = false;
            providerStarted();
            await new Promise((resolve) => {
              releaseProvider = resolve;
            });
          }
          return Response.json({
            status: 'completed',
            output: [
              {
                type: 'message',
                role: 'assistant',
                content: [
                  {
                    type: 'output_text',
                    text: 'Synthetic candidate reply N123AB.',
                  },
                ],
              },
            ],
          });
        },
      },
    ],
  });
  const call = async (
    path,
    {
      method = 'GET',
      body,
      cookies,
      seller,
      address = '192.0.2.44',
      admin = false,
    } = {},
  ) => {
    const response = await mf.dispatchFetch(origin + path, {
      method,
      redirect: 'manual',
      headers: {
        Origin: origin,
        'CF-Connecting-IP': address,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(cookies
          ? { Cookie: [...cookies].map(([k, v]) => k + '=' + v).join('; ') }
          : {}),
        ...(seller
          ? {
              Authorization: 'Bearer ' + seller.session,
              'X-RWAS-CSRF': seller.csrf,
            }
          : {}),
        ...(admin ? { Authorization: 'Bearer synthetic-readonly-admin' } : {}),
        ...(path.startsWith('/api/jerry/')
          ? { 'X-RWAS-Jerry': 'website-v1' }
          : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (cookies)
      for (const value of response.headers.getSetCookie()) {
        const [pair] = value.split(';'),
          n = pair.indexOf('=');
        cookies.set(pair.slice(0, n), pair.slice(n + 1));
      }
    return new Response(await response.arrayBuffer(), {
      status: response.status,
      headers: response.headers,
    });
  };
  const signup = async (email) => {
    const cookies = new Map();
    let response = await call('/api/aircraft-sale/identity/sign-up/email', {
      method: 'POST',
      cookies,
      body: {
        name: 'Synthetic candidate',
        email,
        password: 'synthetic-candidate-password-2026',
      },
    });
    assert.equal(response.status, 200, await response.clone().text());
    const link = mail.findLast((m) => m.to === email)?.link;
    assert.ok(link);
    const verified = await mf.dispatchFetch(link, { redirect: 'manual' });
    await verified.arrayBuffer();
    assert.ok([200, 302].includes(verified.status));
    response = await call('/api/aircraft-sale/identity/sign-in/email', {
      method: 'POST',
      cookies,
      body: { email, password: 'synthetic-candidate-password-2026' },
    });
    assert.equal(response.status, 200);
    response = await call('/api/aircraft-sale/auth/better-auth', {
      method: 'POST',
      cookies,
      body: {},
    });
    assert.equal(response.status, 200, await response.clone().text());
    return { cookies, seller: await response.json() };
  };
  try {
    mf = new Miniflare(options());
    const db = await mf.getD1Database('SELLER_AUTH_DB', 'seller');
    const schema = await readFile(
      'workers/aircraft-sale/migrations/0001_seller_auth.sql',
      'utf8',
    );
    for (const sql of schema
      .replace(/^--.*$/gm, '')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean))
      await db.prepare(sql).run();
    assert.deepEqual(await (await call('/api/jerry/context')).json(), {
      enabled: false,
    });
    const owner = await signup('jerry+readiness-a@example.test'),
      other = await signup('jerry+readiness-b@example.test');
    const values = {
      workflowVersion: '3',
      listingType: 'tools',
      category: listingCategories.find((c) => c.type === 'tools').id,
      title: 'SAVED SYNTHETIC TOOL',
      description: 'Keep this description',
      sellerLocation: 'Synthetic location',
    };
    assert.equal(
      (
        await call('/api/aircraft-sale/draft/autosave', {
          method: 'PUT',
          ...owner,
          body: { expectedRevision: null, values, step: 2 },
        })
      ).status,
      200,
    );
    withConversations = true;
    enabled = true;
    await mf.setOptions(options());
    const context = await (await call('/api/jerry/context', owner)).json();
    assert.ok(context.identity.owner);
    const expected = {
      owner: context.identity.owner,
      sessionRef: context.identity.sessionRef,
    };
    const website = (
      operation,
      body = {},
      auth = owner,
      scope = 'exchange',
      page = '/aircraft-for-sale',
    ) =>
      call('/api/jerry/website', {
        method: 'POST',
        ...auth,
        body: {
          operation,
          expected: auth === owner ? expected : undefined,
          surface: scope,
          page,
          body,
        },
      });
    assert.equal(
      (await call('/api/aircraft-sale/draft', owner)).status,
      200,
      'Adding the new binding preserves existing seller identity/storage',
    );
    const conversation = (
      await (await website('create', { id: crypto.randomUUID() })).json()
    ).conversation;
    assert.ok(conversation);
    const turn = {
      id: conversation.id,
      generation: 1,
      turnId: crypto.randomUUID(),
      input: {
        message: 'Account question',
        mode: 'chat',
        locale: 'en',
        page: '/aircraft-for-sale',
      },
    };
    const initialReply = await website('message', turn);
    assert.equal(initialReply.status, 200, await initialReply.clone().text());
    assert.equal(provider.length, 1);
    assert.equal((await website('message', turn)).status, 200);
    assert.equal(
      provider.length,
      1,
      'Canonical reply replay does not invoke the provider',
    );
    const otherContext = await (await call('/api/jerry/context', other)).json();
    const foreign = await call('/api/jerry/website', {
      method: 'POST',
      ...other,
      body: {
        operation: 'read',
        expected: {
          owner: otherContext.identity.owner,
          sessionRef: otherContext.identity.sessionRef,
        },
        surface: 'exchange',
        page: '/aircraft-for-sale',
        body: { id: conversation.id },
      },
    });
    assert.equal(foreign.status, 410);
    const detail = await (
      await call('/api/aircraft-sale/admin/activity/' + turn.turnId, {
        admin: true,
      })
    ).json();
    assert.equal(detail.event.actor.email, 'jerry+readiness-a@example.test');
    assert.equal(detail.exchanges[0].messages[0].content, 'Account question');
    const guided = {
      id: conversation.id,
      generation: 1,
      turnId: crypto.randomUUID(),
      input: {
        message: 'I want to resume my saved listing.',
        mode: 'listing',
        resume: true,
        locale: 'en',
        page: '/aircraft-for-sale',
        draftStamp: context.draftStamp,
      },
    };
    const resumed = await website('message', guided);
    assert.equal(resumed.status, 200, await resumed.clone().text());
    const saved = await (await call('/api/aircraft-sale/draft', owner)).json();
    assert.equal(saved.draft.fields.title, values.title);
    assert.equal(
      provider.length,
      1,
      'English deterministic resume never invokes inference',
    );
    const guest = {
      operationId: crypto.randomUUID(),
      issuedAt: Date.now(),
      input: {
        message: 'Guest synthetic question',
        mode: 'chat',
        locale: 'en',
      },
      history: [],
    };
    assert.equal((await website('message', guest, {})).status, 200);
    const count = provider.length;
    const replay = await website('message', guest, {});
    assert.equal(replay.status, 409);
    assert.equal((await replay.json()).code, 'JERRY_ATTEMPT_COMPLETED');
    assert.equal(provider.length, count);
    assert.equal(
      (
        await website(
          'message',
          { ...guest, input: { ...guest.input, message: 'Changed' } },
          {},
        )
      ).status,
      409,
    );
    const begun = new Promise((resolve) => {
      providerStarted = resolve;
    });
    hold = true;
    const inFlight = website(
      'message',
      { ...guest, operationId: crypto.randomUUID(), issuedAt: Date.now() },
      {},
    );
    await begun;
    const blocked = await website(
      'message',
      { ...guest, operationId: crypto.randomUUID(), issuedAt: Date.now() },
      {},
    );
    assert.equal(blocked.status, 429);
    releaseProvider();
    assert.equal((await inFlight).status, 200);
    await mf.setOptions(options());
    const afterRestart = await website('message', guest, {});
    assert.equal((await afterRestart.json()).code, 'JERRY_ATTEMPT_COMPLETED');
    // Fence directly through the isolated native namespace so copy cleanup is
    // pending when the feature is switched off. Platform alarms must still drain.
    if (controlledAlarm) {
      const namespace = await mf.getDurableObjectNamespace(
        'JERRY_CONVERSATIONS',
        'seller',
      );
      const stub = namespace.get(
        namespace.idFromName(context.identity.owner + ':exchange'),
      );
      const fenced = await stub.fetch('https://jerry.internal/delete', {
        method: 'POST',
        headers: {
          'X-Jerry-Owner': context.identity.owner,
          'X-Jerry-Surface': 'exchange',
        },
        body: JSON.stringify({ id: conversation.id, generation: 1 }),
      });
      assert.equal(fenced.status, 200);
      await fenced.arrayBuffer();
    } else {
      const deleted = await website('delete', {
        id: conversation.id,
        generation: 1,
      });
      assert.equal(deleted.status, 200);
      assert.equal(
        (await deleted.json()).deleted,
        true,
        'Unmodified candidate completes all canonical/copy cleanup over native bindings',
      );
      const deletedDetail = await (
        await call('/api/aircraft-sale/admin/activity/' + turn.turnId, {
          admin: true,
        })
      ).json();
      assert.equal(deletedDetail.exchanges.length, 0);
      assert.equal(deletedDetail.conversationUnavailable, 'Deleted or expired');
    }
    enabled = false;
    // Cloudflare documents local alarm failures after hot reload. Use a cold
    // restart with the same persisted local resources to qualify alarm recovery.
    await mf.dispose();
    mf = new Miniflare(options());
    assert.deepEqual(await (await call('/api/jerry/context')).json(), {
      enabled: false,
    });
    assert.equal((await website('message', guest, {})).status, 404);
    if (controlledAlarm) {
      const namespace = await mf.getDurableObjectNamespace(
        'JERRY_CONVERSATIONS',
        'seller',
      );
      const alarm = await namespace
        .get(namespace.idFromName(context.identity.owner + ':exchange'))
        .fetch('https://jerry.internal/__fixture_fire_alarm', {
          method: 'POST',
          body: '{}',
        });
      assert.equal(alarm.status, 200);
      await alarm.arrayBuffer();
    }

    const storeNamespace = await mf.getDurableObjectNamespace(
        'SELLER_STORE',
        'seller',
      ),
      store = storeNamespace.get(storeNamespace.idFromName('seller-v2'));
    const legacyIntake = {
      messages: [{ role: 'user', content: guided.input.message }],
      resume: true,
      jerry: {
        operationId: guided.turnId,
        conversationId: conversation.id,
        generation: 1,
        expectedDraft: guided.input.draftStamp,
      },
    };
    let removed = false,
      lastCleanup = '';
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const result = await store.fetch(origin + '/api/aircraft-sale/intake', {
        method: 'POST',
        headers: {
          Origin: origin,
          Cookie: [...owner.cookies].map(([k, v]) => k + '=' + v).join('; '),
          Authorization: 'Bearer ' + owner.seller.session,
          'X-RWAS-CSRF': owner.seller.csrf,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(legacyIntake),
      });
      removed = result.status === 410;
      lastCleanup = result.status + ':' + (await result.text());
      if (removed) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(
      removed,
      true,
      'Feature-off rollback retains cleanup bindings and drains copy removal: ' +
        lastCleanup,
    );
    const restored = await (
      await call('/api/aircraft-sale/draft', owner)
    ).json();
    assert.deepEqual(restored.draft, saved.draft);
    assert.equal(
      (
        await call('/api/aircraft-sale/admin/activity/' + turn.turnId, {
          admin: true,
        })
      ).status,
      200,
      'Existing activity metadata remains readable after rollback',
    );
  } finally {
    releaseProvider?.();
    await mf?.dispose();
    await rm(temporary, { recursive: true, force: true });
  }
}

test('unmodified complete candidate preserves seller state and enforces guest admission, deletion and feature-off behavior', () =>
  candidate());
test('native alarm handler drains pending conversation cleanup after rollback and cold restart (controlled invocation)', () =>
  candidate(true));
