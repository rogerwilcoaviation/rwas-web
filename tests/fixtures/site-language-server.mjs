import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, join } from 'node:path';
import { handleSiteLanguage } from '../../functions/_site-language/translate.mjs';
export async function languageServer() {
  const root = resolve('.vercel/output/static');
  async function asset(url, headers = {}) {
    let file = resolve(root, '.' + decodeURIComponent(new URL(url).pathname));
    if (file !== root && !file.startsWith(root + '/'))
      return new Response('Not found', { status: 404 });
    try {
      if ((await stat(file).catch(() => null))?.isDirectory()) {
        const index = join(file, 'index.html');
        file = (await stat(index).catch(() => null)) ? index : file + '.html';
      } else if (!extname(file)) file += headers.rsc === '1' ? '.txt' : '.html';
      let body = await readFile(file);
      const type =
        {
          '.html': 'text/html',
          '.json': 'application/json',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.txt': 'text/x-component',
          '.woff2': 'font/woff2',
          '.svg': 'image/svg+xml',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.webp': 'image/webp',
        }[extname(file)] || 'application/octet-stream';
      if (type === 'text/html' && !body.includes('rwas-react-language'))
        body = Buffer.from(
          body
            .toString()
            .replace(
              '</body>',
              '<link rel="stylesheet" href="/site-language.css"><script defer src="/site-language.js"></script></body>',
            ),
        );
      return new Response(body, { headers: { 'Content-Type': type } });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  }
  const env = { ASSETS: { fetch: (request) => asset(request.url) } };
  const server = createServer(async (req, res) => {
    try {
      const url = 'http://' + req.headers.host + req.url;
      let response;
      if (new URL(url).pathname.startsWith('/api/site-language')) {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        response = await handleSiteLanguage(
          new Request(url, {
            method: req.method,
            headers: req.headers,
            ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
          }),
          env,
          {},
        );
      } else response = await asset(url, req.headers);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      res.writeHead(500);
      res.end();
    }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  return {
    origin: 'http://127.0.0.1:' + server.address().port,
    close: () => new Promise((done) => server.close(done)),
  };
}
