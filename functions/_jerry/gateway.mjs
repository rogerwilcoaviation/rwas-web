import {
  jerryAssert,
  jerryJson,
  jerryKeys,
  jerryPage,
  jerryResult,
} from '../../workers/aircraft-sale/jerry-protocol.mjs';
import { pageKey, LANGUAGE_VERSION } from '../../lib/site-language.mjs';

export async function handleJerry(request, env) {
  try {
    const url = new URL(request.url);
    jerryAssert(
      request.headers.get('Sec-Fetch-Site') !== 'cross-site' &&
        (!request.headers.get('Origin') ||
          request.headers.get('Origin') === url.origin),
      403,
      'Use Jerry from this website.',
    );
    if (request.method === 'GET' && url.pathname === '/api/jerry/context') {
      if (env.JERRY_CONVERSATIONS_ENABLED !== 'true')
        return jerryResult({ enabled: false });
      jerryAssert(
        env.SELLER_API?.jerryWebsite,
        503,
        'Jerry account service is unavailable.',
      );
      const context = await env.SELLER_API.jerryWebsite({
        operation: 'context',
        proof: {
          cookie: request.headers.get('Cookie') || '',
          origin: url.origin,
        },
      });
      return jerryResult(context, context.status || 200);
    }
    jerryAssert(
      env.JERRY_CONVERSATIONS_ENABLED === 'true',
      404,
      'Jerry conversations are not enabled.',
    );
    jerryAssert(
      request.method === 'POST' && url.pathname === '/api/jerry/website',
      405,
      'Unsupported Jerry request.',
    );
    jerryAssert(
      request.headers.get('Origin') === url.origin &&
        request.headers.get('X-RWAS-Jerry') === 'website-v1' &&
        (request.headers.get('Content-Type') || '').startsWith(
          'application/json',
        ),
      403,
      'Same-origin website request required.',
    );
    jerryAssert(
      env.SELLER_API?.jerryWebsite,
      503,
      'Jerry account service is unavailable.',
    );
    const body = await jerryJson(request);
    jerryKeys(body, ['operation', 'expected', 'surface', 'page', 'body']);
    // Initial syntax/scope checks precede asset access. Staff authorization is
    // repeated against the current verified provider identity inside the RPC.
    const path = jerryPage(body.page, body.surface, 'super-admin');
    let pageContext = '';
    if (!/^\/aircraft-for-sale\/[a-f0-9-]{36}$/i.test(path)) {
      jerryAssert(
        env.ASSETS,
        503,
        'Published page references are unavailable.',
      );
      const published = await env.ASSETS.fetch(
        new Request(
          url.origin +
            '/_site-language/pages/' +
            (await pageKey(path)) +
            '.json',
        ),
      );
      jerryAssert(
        published.ok &&
          (published.headers.get('Content-Type') || '').includes(
            'application/json',
          ),
        404,
        'This page is not in the published website catalog.',
      );
      const catalog = await published.json();
      jerryAssert(
        catalog.version === LANGUAGE_VERSION &&
          Array.isArray(catalog.entries) &&
          catalog.entries.length,
        404,
        'This page is not in the published website catalog.',
      );
      pageContext = catalog.entries
        .map((entry) => entry.text)
        .filter((value) => typeof value === 'string')
        .join('\n')
        .slice(0, 12000);
    }
    const result = await env.SELLER_API.jerryWebsite({
      ...body,
      page: path,
      pageContext,
      proof: {
        cookie: request.headers.get('Cookie') || '',
        origin: url.origin,
        authorization: request.headers.get('Authorization') || '',
        csrf: request.headers.get('X-RWAS-CSRF') || '',
        admissionAddress: request.headers.get('CF-Connecting-IP') || '',
      },
    });
    if (result.error) return jerryResult(result, result.status || 503);
    return jerryResult(result);
  } catch (error) {
    return jerryResult(
      {
        error: error.status
          ? error.message
          : 'Jerry is unavailable. Your saved work has not been removed.',
        code: error.code || 'JERRY_UNAVAILABLE',
      },
      error.status || 503,
    );
  }
}
