// Offline bundle and source custody receipt. Never deploys or selects a provider.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const dependencies = [
  'workers/jerry-website-transport/entry.mjs',
  'workers/jerry-website-transport/contract.mjs',
  'workers/jerry-website-transport/copies.mjs',
  'workers/jerry-response/admission.mjs',
  'workers/aircraft-sale/jerry-protocol.mjs',
].sort();
const result = await build({
  entryPoints: ['workers/jerry-website-transport/entry.mjs'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'neutral',
  external: ['cloudflare:workers'],
  target: 'es2022',
  logLevel: 'silent',
  metafile: true,
});
const actual = Object.keys(result.metafile.inputs).sort();
if (JSON.stringify(actual) !== JSON.stringify(dependencies))
  throw Error(
    'Website contract dependency inventory changed; review before packaging.',
  );
const sourceFiles = [
  ...dependencies,
  'workers/jerry-website-transport/wrangler.local.toml',
  'workers/aircraft-sale/jerry-website-client.mjs',
  'workers/aircraft-sale/jerry-service.mjs',
  'workers/aircraft-sale/jerry-conversations.mjs',
  'workers/aircraft-sale/worker.mjs',
  'workers/aircraft-sale/wrangler.jerry.local.toml',
  'workers/aircraft-sale/jerry-release-plan.mjs',
  'public/jerry-widget.js',
  'public/jerry-account-chat.mjs',
  'functions/_jerry/gateway.mjs',
  'tests/aircraft-sale/jerry-authorization.test.mjs',
  'tests/aircraft-sale/jerry-browser.test.mjs',
  'tests/aircraft-sale/jerry-conversations.test.mjs',
  'tests/aircraft-sale/jerry-fixture.mjs',
  'tests/aircraft-sale/jerry-native.test.mjs',
  'tests/aircraft-sale/jerry-release-plan.test.mjs',
  'tests/aircraft-sale/jerry-neutral-candidate.test.mjs',
  'tests/aircraft-sale/jerry-transport.test.mjs',
  'tests/aircraft-sale/jerry-website-isolation.test.mjs',
  'tests/aircraft-sale/fixtures/jerry-transport-runtime.mjs',
  'package.json',
  'scripts/build-jerry-website-contract.mjs',
];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const bytes = result.outputFiles[0].contents;
if (bytes.length > 2 * 1024 * 1024)
  throw Error('Unexpected contract bundle size.');
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sourceFiles.map(async (path) => [path, hash(await readFile(path))]),
  ),
);
const out = 'artifacts/jerry-neutral-contract-20261024';
const pausedSources = [
  'workers/jerry-response/response.mjs',
  'workers/jerry-response/wrangler.local.toml',
  'tests/aircraft-sale/jerry-response.test.mjs',
  'tests/aircraft-sale/jerry-candidate.test.mjs',
];
const paused = Object.fromEntries(
  await Promise.all(
    pausedSources.map(async (path) => [path, hash(await readFile(path))]),
  ),
);
if (process.argv[2]) {
  const baseline = JSON.parse(await readFile(process.argv[2], 'utf8'));
  for (const path of pausedSources) {
    if (paused[path] !== baseline[path])
      throw Error(`Paused source changed: ${path}`);
  }
}
const production = 'workers/aircraft-sale/wrangler.production.toml';
const transportManifest = await readFile(
  'workers/jerry-website-transport/wrangler.local.toml',
  'utf8',
);
const sellerManifest = await readFile(
  'workers/aircraft-sale/wrangler.jerry.local.toml',
  'utf8',
);
if (
  !transportManifest.includes('JERRY_TRANSPORT_MODE = "disabled"') ||
  !transportManifest.includes('routes = []') ||
  !transportManifest.includes('workers_dev = false') ||
  !sellerManifest.includes('JERRY_CONVERSATIONS_ENABLED = "false"') ||
  /OPENAI_|OAUTH_|JERRY_MODEL|JERRY_RELAY/.test(transportManifest)
)
  throw Error('Local disabled/unconfigured manifest contract changed.');
const receipt = {
  bundleSha256: hash(bytes),
  bundleBytes: bytes.length,
  sourceDependencies: actual,
  sourceHashes,
  productionManifestSha256: hash(await readFile(production)),
  pausedSourceHashes: paused,
  pausedBaselineVerified: !!process.argv[2],
  mode: 'disabled',
  providerSelected: false,
  externalCalls: 0,
  deployed: false,
  hostedAlarmDeliveryQualified: false,
};
await mkdir(out, { recursive: true });
await writeFile(`${out}/contract-${receipt.bundleSha256}.mjs`, bytes);
await writeFile(
  `${out}/build-receipt.json`,
  JSON.stringify(receipt, null, 2) + '\n',
);
console.log(
  JSON.stringify({
    out,
    bundleSha256: receipt.bundleSha256,
    bundleBytes: bytes.length,
    deployed: false,
  }),
);
