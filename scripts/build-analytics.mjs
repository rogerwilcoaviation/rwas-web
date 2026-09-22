import { build } from 'esbuild';
await build({
  stdin: { contents: "export {onCLS,onINP,onLCP,onFCP,onTTFB} from 'web-vitals';", resolveDir: process.cwd() },
  bundle: true, format: 'esm', minify: true, target: 'es2020',
  outfile: 'public/rwas-web-vitals.js', legalComments: 'eof',
});
