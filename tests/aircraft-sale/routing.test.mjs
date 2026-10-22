import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, copyFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Miniflare } from 'miniflare';
test('Pages advanced wrapper gates missing seller binding and serves current new IDs without static export', async () => {
  const root = await mkdtemp(join(tmpdir(), 'seller-pages-'));
  let mf;
  try {
    await mkdir(join(root, '_worker.js'));
    await writeFile(
      join(root, '_worker.js/index.js'),
      'export default {fetch(){return new Response("old-static-app")}}',
    );
    await writeFile(
      join(root, '_routes.json'),
      JSON.stringify({ version: 1, include: ['/*'], exclude: [] }),
    );
    execFileSync(process.execPath, ['scripts/stage-service-intake.mjs', root]);
    const options = {
      modules: true,
      modulesRules: [{ type: 'ESModule', include: ['**/*.js'] }],
      scriptPath: join(root, '_worker.js/index.js'),
      modulesRoot: join(root, '_worker.js'),
      compatibilityDate: '2026-09-01',
    };
    mf = new Miniflare(options);
    assert.equal(
      (await mf.dispatchFetch('https://fixture.test/api/aircraft-sale/health'))
        .status,
      503,
    );
    assert.equal(
      await (
        await mf.dispatchFetch('https://fixture.test/aircraft-for-sale/new-id')
      ).text(),
      'old-static-app',
    );
    assert.equal((await mf.dispatchFetch('https://fixture.test/aircraft-for-sale/11111111-1111-4111-8111-111111111111')).status,503,'default UUID route fails closed without its Seller service');
    await mf.setOptions({
      ...options,
      bindings: { SELLER_PUBLIC_ROUTES_ENABLED: 'true' },
    });
    assert.equal(
      (await mf.dispatchFetch('https://fixture.test/aircraft-for-sale/new-id'))
        .status,
      503,
    );
    await mf.setOptions({
      ...options,
      bindings: { SELLER_PUBLIC_ROUTES_ENABLED: 'true' },
      serviceBindings: {
        SELLER_API: async (request) =>
          Response.json({
            path: new URL(request.url).pathname,
            accept: request.headers.get('Accept'),
            method: request.method,
          }),
      },
    });
    const data = await (
      await mf.dispatchFetch('https://fixture.test/aircraft-for-sale/new-id')
    ).json();
    assert.equal(data.path, '/api/aircraft-sale/listing/new-id');
    assert.equal(data.accept, 'text/html');
    assert.equal(data.method, 'GET');
    const api = await (
      await mf.dispatchFetch('https://fixture.test/api/aircraft-sale/browse')
    ).json();
    assert.equal(api.path, '/api/aircraft-sale/browse');
    assert.equal(
      await (await mf.dispatchFetch('https://fixture.test/faq')).text(),
      'old-static-app',
    );
    const staging = 'https://intake-restoration-20260922.rwas-web.pages.dev';
    await mf.setOptions({
      ...options,
      bindings: {
        INTAKE_STAGING_MODE: 'true',
        SELLER_PUBLIC_ROUTES_ENABLED: 'true',
      },
      serviceBindings: { SELLER_API: async () => new Response('seller') },
    });
    for (const path of [
      '/api/aircraft-sale/browse',
      '/aircraft-for-sale/new-id',
    ]) {
      const denied = await mf.dispatchFetch('https://fixture.test' + path);
      assert.equal(denied.status, 503);
      assert.equal(denied.headers.get('X-Robots-Tag'), 'noindex, nofollow');
      const permitted = await mf.dispatchFetch(staging + path);
      assert.equal(permitted.status, 200);
      assert.equal(permitted.headers.get('X-Robots-Tag'), 'noindex, nofollow');
    }
    const seller = 'https://repair-aircraft-seller-workf.rwas-web.pages.dev';
    await mf.setOptions({
      ...options,
      bindings: {
        INTAKE_STAGING_MODE: 'true',
        SELLER_STAGING_ORIGIN: seller,
        SELLER_PUBLIC_ROUTES_ENABLED: 'true',
      },
      serviceBindings: {
        SELLER_API: async () => new Response('dedicated-seller'),
      },
    });
    for (const path of [
      '/api/aircraft-sale/health',
      '/aircraft-for-sale/new-id',
    ]) {
      assert.equal(
        await (await mf.dispatchFetch(seller + path)).text(),
        'dedicated-seller',
      );
      for (const other of [
        staging,
        'https://www.rogerwilcoaviation.com',
        'https://abcdef12.rwas-web.pages.dev',
      ])
        assert.equal((await mf.dispatchFetch(other + path)).status, 503);
    }
    // Seller permission does not widen any existing intake endpoint's destination.
    assert.equal(
      (await mf.dispatchFetch(seller + '/api/service-intake-config')).status,
      503,
    );
    assert.match(
      await (await mf.dispatchFetch(seller + '/robots.txt')).text(),
      /Disallow: \//,
    );
  } finally {
    await mf?.dispose();
    await rm(root, { recursive: true, force: true });
  }
});

test('seller API wildcard is staged on restrictive route builds and conflicting exclusions stop publishing', async () => {
  for (const exclude of [[], ['/api/*']]) {
    const root = await mkdtemp(join(tmpdir(), 'seller-route-gate-'));
    try {
      await mkdir(join(root, '_worker.js'));
      await writeFile(
        join(root, '_worker.js/index.js'),
        'export default {fetch(){return new Response("static")}}',
      );
      await writeFile(
        join(root, '_routes.json'),
        JSON.stringify({
          version: 1,
          include: ['/api/service-intake'],
          exclude,
        }),
      );
      if (exclude.length) {
        assert.throws(
          () =>
            execFileSync(
              process.execPath,
              ['scripts/stage-service-intake.mjs', root],
              { stdio: 'pipe' },
            ),
          /bypass intake or seller API/,
        );
      } else {
        execFileSync(process.execPath, [
          'scripts/stage-service-intake.mjs',
          root,
        ]);
        const routes = JSON.parse(
          await readFile(join(root, '_routes.json'), 'utf8'),
        );
        assert.ok(routes.include.includes('/api/aircraft-sale'));
        assert.ok(routes.include.includes('/api/aircraft-sale/*'));
        const source = await readFile(
          join(root, '_worker.js/index.js'),
          'utf8',
        );
        assert.match(source, /env\.SELLER_API\.fetch\(request\)/);
        assert.match(source, /Seller service is not configured/);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

// The actual SellerStore implementation remains the only visibility decision.
// Its durable storage and mail adapters are local fixtures, never providers.
test('default UUID canonical routes preserve real seller publication, unpublish and expiry authority', async () => {
  const { fixture, create, submit, approve } = await import('./fixture.mjs');
  const f = fixture();
  const session = await f.login();
  const listing = await create(f, session);
  assert.match(listing.id, /^[0-9a-f-]{36}$/);
  const root = await mkdtemp(join(tmpdir(), 'seller-uuid-default-'));
  let mf;
  let sellerCalls = 0;
  try {
    const staticApp = 'export default {fetch(request){return new Response("static:"+new URL(request.url).pathname,{headers:{"X-Static-Fixture":"preserved"}})}}';
    await mkdir(join(root, '_worker.js'));
    await writeFile(join(root, '_worker.js/index.js'), staticApp);
    await writeFile(join(root, '_routes.json'), JSON.stringify({version:1,include:['/*'],exclude:[]}));
    execFileSync(process.execPath, ['scripts/stage-service-intake.mjs', root]);

    // Exercise the tracked production script's default output path in an
    // isolated build root. No external, previously built artifact is needed.
    const productionRoot = join(root, 'production-build');
    const productionOutput = join(productionRoot, '.vercel/output/static');
    await mkdir(join(productionRoot, 'scripts'), { recursive: true });
    await mkdir(join(productionOutput, '_worker.js'), { recursive: true });
    await copyFile('scripts/stage-service-intake.mjs', join(productionRoot, 'scripts/stage-service-intake.mjs'));
    await symlink(resolve('functions'), join(productionRoot, 'functions'), 'dir');
    await symlink(resolve('node_modules'), join(productionRoot, 'node_modules'), 'dir');
    await writeFile(join(productionOutput, '_worker.js/index.js'), staticApp);
    await writeFile(join(productionOutput, '_routes.json'), JSON.stringify({version:1,include:['/*'],exclude:[]}));
    execFileSync(process.execPath, ['scripts/stage-service-intake.mjs'], { cwd: productionRoot });
    assert.equal(await readFile(join(root,'_worker.js/index.js'),'utf8'),
      await readFile(join(productionOutput,'_worker.js/index.js'),'utf8'),
      'explicit staging exactly matches the production script default output path');
    assert.equal(await readFile(join(productionOutput,'_worker.js/rwas-csp-wrapper.js'),'utf8'),
      staticApp, 'production staging preserves the original application exactly once');
    // The prebuild suite is self-contained. CI supplies its completed Pages
    // output explicitly after pages:build to verify the deployable wrapper too.
    if (process.env.SELLER_PAGES_ARTIFACT_DIR !== undefined) {
      assert.ok(process.env.SELLER_PAGES_ARTIFACT_DIR.trim(), 'artifact directory must be explicit and nonempty');
      const artifactRoot = resolve(process.env.SELLER_PAGES_ARTIFACT_DIR);
      assert.equal(await readFile(join(root,'_worker.js/index.js'),'utf8'),
        await readFile(join(artifactRoot,'_worker.js/index.js'),'utf8'),
        'built Pages artifact wrapper exactly matches source generation');
    }
    const options = {
      modules:true,
      modulesRules:[{type:'ESModule',include:['**/*.js']}],
      scriptPath:join(root,'_worker.js/index.js'),
      modulesRoot:join(root,'_worker.js'),
      compatibilityDate:'2026-09-01',
      serviceBindings:{SELLER_API:async request => {
        sellerCalls++;
        return f.callRaw(new Request(request.url, {method:request.method, headers:request.headers}));
      }},
    };
    mf = new Miniflare(options);
    const canonical = 'https://fixture.test/aircraft-for-sale/' + listing.id;
    // A signed-in owner's cookie/header must not turn a private HTML route public.
    for (const method of ['GET','HEAD']) {
      const privatePage = await mf.dispatchFetch(canonical,{method,headers:{Authorization:'Bearer '+session}});
      assert.equal(privatePage.status,404);
      assert.doesNotMatch(await privatePage.text(), /<title>Synthetic/);
    }
    assert.equal((await submit(f,session,listing)).status,200);
    assert.equal((await approve(f,listing)).status,200);
    const live = await mf.dispatchFetch(canonical);
    assert.equal(live.status,200);
    assert.match(live.headers.get('Content-Type'),/text\/html/);
    assert.equal(live.headers.get('Cache-Control'),'no-store');
    const policy = live.headers.get('Content-Security-Policy');
    assert.ok(policy);
    assert.match(await live.text(),/Synthetic Fixture/);
    const head = await mf.dispatchFetch(canonical,{method:'HEAD'});
    assert.equal(head.status,200);
    assert.equal(head.headers.get('Content-Security-Policy'),policy);
    assert.equal(await head.text(),'');
    const beforeMethods = sellerCalls;
    for (const method of ['POST','PUT','DELETE']) {
      const response = await mf.dispatchFetch(canonical,{method});
      assert.equal(response.status,405);
      assert.equal(response.headers.get('Allow'),'GET, HEAD');
    }
    assert.equal(sellerCalls,beforeMethods,'unsupported methods never become seller GETs');
    assert.equal((await f.call('/admin/review','POST',{listingId:listing.id,revision:listing.revision,decision:'unpublish'},'fixture-reviewer')).status,200);
    assert.equal((await mf.dispatchFetch(canonical)).status,404,'unpublished content never falls back to static content');
    // Actual bounded publication still requires the exact server tuple and expiry.
    f.env.PUBLIC_LISTINGS_ENABLED='false';
    f.env.CLERK_ACCEPTANCE_ENABLED='true';
    assert.equal((await submit(f,session,listing)).status,200);
    const current=structuredClone(f.state().listings[listing.id]);
    const grant={listingId:current.id,ownerId:current.ownerId,revision:current.revision,expiresAt:Date.now()+60000};
    f.env.CLERK_ACCEPTANCE_SCOPE=JSON.stringify(grant);
    assert.equal((await f.call('/admin/review','POST',{listingId:current.id,revision:current.revision,decision:'acceptance-approve'},'fixture-reviewer')).status,200);
    assert.equal((await mf.dispatchFetch(canonical)).status,200,'exact bounded publication is visible');
    f.env.CLERK_ACCEPTANCE_SCOPE=JSON.stringify({...grant,expiresAt:Date.now()-1});
    assert.equal((await mf.dispatchFetch(canonical)).status,404,'expired server grant denies content despite retained marker');
    for (const path of ['/aircraft-for-sale/legacy-slug','/aircraft-for-sale','/_next/static/example.js','/favicon.ico','/faq']) {
      const response = await mf.dispatchFetch('https://fixture.test'+path);
      assert.equal(await response.text(),'static:'+path);
      assert.equal(response.headers.get('X-Static-Fixture'),'preserved');
    }
    const browse=await mf.dispatchFetch('https://fixture.test/api/aircraft-sale/browse');
    assert.equal(browse.status,200);
    assert.deepEqual((await browse.json()).listings,[]);
    await mf.setOptions({...options,bindings:{SELLER_PUBLIC_ROUTES_ENABLED:'false'}});
    const beforeDisabled=sellerCalls;
    assert.equal(await(await mf.dispatchFetch(canonical)).text(),'static:/aircraft-for-sale/'+listing.id);
    assert.equal(sellerCalls,beforeDisabled,'explicit false is the static fallback kill-switch');
    await mf.setOptions({...options,bindings:{SELLER_PUBLIC_ROUTES_ENABLED:'unexpected'}});
    assert.equal(await(await mf.dispatchFetch(canonical)).text(),'static:/aircraft-for-sale/'+listing.id);
    await mf.setOptions({...options,bindings:{INTAKE_STAGING_MODE:'true'}});
    assert.equal((await mf.dispatchFetch(canonical)).status,503);
    const staging='https://intake-restoration-20260922.rwas-web.pages.dev';
    const denied=await mf.dispatchFetch(staging+'/aircraft-for-sale/'+listing.id);
    assert.equal(denied.status,404);
    assert.equal(denied.headers.get('X-Robots-Tag'),'noindex, nofollow');
  } finally {
    await mf?.dispose();
    await rm(root,{recursive:true,force:true});
  }
});
