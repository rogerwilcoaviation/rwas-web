import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import jsQR from 'jsqr';

const component = new URL(
  '../../app/aircraft-for-sale/authenticator-setup.tsx',
  import.meta.url,
).pathname;
const output = join(
  await mkdtemp(join(tmpdir(), 'rwas-authenticator-qr-')),
  'render.cjs',
);
await build({
  stdin: {
    contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import Setup from ${JSON.stringify(component)}; export const render=uri=>renderToStaticMarkup(React.createElement(Setup,{uri}));`,
    resolveDir: process.cwd(),
    loader: 'tsx',
  },
  outfile: output,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
});
const { render } = createRequire(import.meta.url)(output);

test('real local SVG QR decodes to the exact synthetic enrollment URI without plaintext metadata or external resources', async () => {
  const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
  const uri = `otpauth://totp/Roger%20Wilco%20Aviation:fixture%40example.test?secret=${secret}&issuer=Roger%20Wilco%20Aviation&digits=6&period=30`;
  const html = render(uri);
  assert.equal(html.includes(secret), false);
  assert.equal(html.includes(uri), false);
  assert.equal(
    html.includes('<textarea'),
    false,
    'manual URI is absent until requested',
  );
  assert.equal(
    /<(?:image|img|script)\b|\b(?:src|href|data-secret|data-uri)=/.test(html),
    false,
  );
  assert.match(html, /role="img"/);
  assert.match(html, /<title>Authenticator setup QR code<\/title>/);
  const svg = html.match(/<svg\b[\s\S]*?<\/svg>/)?.[0];
  assert.ok(svg);
  const { data, info } = await sharp(Buffer.from(svg))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 4);
  const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height, {
    inversionAttempts: 'dontInvert',
  });
  assert.equal(decoded?.data, uri);
});
