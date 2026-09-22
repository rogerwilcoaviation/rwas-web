import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
const fields = [
  'name',
  'email',
  'aircraftYear',
  'aircraftMake',
  'aircraftModel',
  'aircraftSerialNumber',
  'nNumber',
  'message',
  'aircraftStatus',
];
const dir = mkdtempSync(join(tmpdir(), 'rwas-a11y-'));
let calls = 0;
globalThis.fetch = () => {
  calls++;
  throw Error('Network prohibited in accessibility fixture');
};
// Render the actual component with isolated form state; no submit handler is invoked.
await build({
  entryPoints: ['components/shared/ContactForm.tsx'],
  outfile: join(dir, 'form.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  jsx: 'automatic',
  external: ['react', 'react-dom'],
  plugins: [
    {
      name: 'offline-form-state',
      setup(b) {
        b.onResolve({ filter: /^react-hook-form$/ }, () => ({
          path: 'form-state',
          namespace: 'fixture',
        }));
        b.onResolve({ filter: /^@hookform\/resolvers\/zod$/ }, () => ({
          path: 'resolver',
          namespace: 'fixture',
        }));
        b.onResolve({ filter: /^next\/script$/ }, () => ({
          path: 'script',
          namespace: 'fixture',
        }));
        b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({
          contents:
            path === 'resolver'
              ? 'export const zodResolver=()=>()=>{}'
              : path === 'script'
                ? 'export default () => null'
                : `export const useForm=()=>({register:()=>({}),handleSubmit:()=>()=>{},reset:()=>{},setValue:()=>{},watch:(key)=>globalThis.__formFixture[key]||'',formState:{errors:globalThis.__formFixture.errors}})`,
        }));
      },
    },
  ],
});
const Module = require('node:module');
process.env.NODE_PATH = resolve('node_modules');
Module._initPaths();
const Form = require(join(dir, 'form.cjs')).default;
for (const reason of ['quote', 'general'])
  for (const invalid of [false, true]) {
    globalThis.__formFixture = {
      reason,
      aircraftStatus: 'registered',
      errors: invalid
        ? Object.fromEntries(
            fields.map((f) => [f, { message: `Fixture error ${f}` }]),
          )
        : {},
    };
    const html = renderToStaticMarkup(React.createElement(Form));
    const select = html.match(/<select[^>]*id="aircraftStatus"[^>]*>/)[0];
    assert.equal(/required=""/.test(select), reason === 'quote');
    for (const f of fields) {
      const control = html.match(
        new RegExp(`<(?:input|select|textarea)[^>]*id="${f}"[^>]*>`),
      )[0];
      assert.equal(control.includes(`aria-describedby="${f}-error"`), invalid);
      assert.equal(html.includes(`id="${f}-error"`), invalid);
      assert.ok(control.includes(`aria-invalid="${invalid}"`));
    }
  }
assert.equal(calls, 0);
const layout = readFileSync('app/layout.tsx', 'utf8');
assert.ok(!/<main[\s>]/.test(layout));
assert.ok(layout.includes('href="#main-content"'));
const files = execFileSync('git', ['ls-files', 'app', 'components/shopify'], {
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter((f) => f.endsWith('.tsx'));
let mainFiles = 0;
for (const f of files) {
  const s = readFileSync(f, 'utf8');
  const mains = [...s.matchAll(/<main(?=\s|>)[^>]*>/g)];
  if (mains.length) {
    mainFiles++;
    for (const [tag] of mains)
      assert.ok(
        tag.includes('id="main-content"') && tag.includes('tabIndex={-1}'),
        f,
      );
  }
}
const axis = readFileSync('components/shopify/AxisBuildPlanner.tsx', 'utf8');
assert.equal(
  (axis.match(/detailOpenerRef.current = event.currentTarget/g) || []).length,
  2,
);
assert.ok(axis.includes('onCloseAutoFocus'));
assert.ok(
  axis.includes('detailOpenerRef.current?.focus({ preventScroll: true })'),
);
assert.ok(axis.includes('[overflow-wrap:anywhere]'));
const services = readFileSync('app/services/page.tsx', 'utf8');
assert.ok(services.includes('mainEntity: serviceFaq'));
assert.ok(services.includes('serviceFaq.map((question)'));
assert.ok(services.includes('id="faq"'));
assert.equal((services.match(/'@type': 'Question'/g) || []).length, 7);
const old = execFileSync('git', ['show', 'bd94a41:app/services/page.tsx'], {
  encoding: 'utf8',
});
assert.deepEqual(
  [...services.matchAll(/text: '([^']+)'/g)].map((m) => m[1]),
  [...old.matchAll(/text: '([^']+)'/g)].map((m) => m[1]),
);
function lum(hex) {
  return hex
    .match(/\w\w/g)
    .map((h) => parseInt(h, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
}
function contrast(a, b) {
  const x = lum(a),
    y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const contrastRatios = {
  cta: contrast('ffffff', '9c2f3e'),
  ctaHoverFocus: contrast('ffffff', '842330'),
  folio: contrast('45688f', 'f4f0e6'),
};
for (const ratio of Object.values(contrastRatios)) assert.ok(ratio >= 4.5);
assert.ok(
  readFileSync('app/about/page.tsx', 'utf8').includes(
    '<h2 className="jerry-card-heading">Talk to Captain Jerry</h2>',
  ),
);
console.log(
  JSON.stringify(
    {
      fixture: 'actual ContactForm SSR with mocked form state',
      formStates: 4,
      associatedFieldsPerInvalidState: 9,
      networkCalls: calls,
      mainSourceFiles: mainFiles,
      faqAnswersPreserved: 7,
      contrastRatios,
      browserRuntimeVerified: false,
    },
    null,
    2,
  ),
);
