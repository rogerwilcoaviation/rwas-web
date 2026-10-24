// Local deterministic bundle/evidence only. No deployment or network client.
import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  resourceManifest,
  assertIsolatedManifest,
} from '../workers/jerry-alarm-qualification/plan.mjs';
const sources = [
  'workers/jerry-alarm-qualification/entry.mjs',
  'workers/jerry-alarm-qualification/plan.mjs',
  'workers/jerry-alarm-qualification/wrangler.local.toml',
  'workers/aircraft-sale/jerry-conversations.mjs',
  'workers/aircraft-sale/jerry-protocol.mjs',
  'workers/jerry-response/admission.mjs',
  'tests/aircraft-sale/jerry-alarm-probe.test.mjs',
  'scripts/build-jerry-alarm-probe.mjs',
];
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const hashes = Object.fromEntries(
  await Promise.all(
    sources.map(async (path) => [path, sha(await readFile(path))]),
  ),
);
const result = await build({
  entryPoints: [sources[0]],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'neutral',
  external: ['cloudflare:workers'],
  target: 'es2022',
  logLevel: 'silent',
  metafile: true,
});
const bytes = result.outputFiles[0].contents;
if (bytes.length > 2 * 1024 * 1024)
  throw Error('Probe bundle exceeds approved local envelope');
const manifest = resourceManifest();
assertIsolatedManifest(manifest);
const hash = sha(bytes),
  out = 'artifacts/jerry-alarm-probe-20261024';
await mkdir(out, { recursive: true });
await writeFile(`${out}/probe-${hash}.mjs`, bytes);
await writeFile(
  `${out}/resource-manifest.json`,
  JSON.stringify(manifest, null, 2) + '\n',
);
const receipt = {
  bundleSha256: hash,
  bundleBytes: bytes.length,
  sourceHashes: hashes,
  resourceManifestSha256: sha(JSON.stringify(manifest, null, 2) + '\n'),
  hostedDeliveryQualified: false,
  deployed: false,
  providerCalls: 0,
  sourceDependencies: Object.keys(result.metafile.inputs).sort(),
};
await writeFile(
  `${out}/build-receipt.json`,
  JSON.stringify(receipt, null, 2) + '\n',
);
console.log(
  JSON.stringify({
    out,
    bundleSha256: hash,
    bundleBytes: bytes.length,
    hostedDeliveryQualified: false,
  }),
);
