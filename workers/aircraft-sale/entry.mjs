import { WorkerEntrypoint } from 'cloudflare:workers';
import worker from './worker.mjs';
import { readBetterAuthIdentity } from './better-auth-service.mjs';
import { jerryWebsite, jerryActivity } from './jerry-service.mjs';
import {
  handleSellerIdentityRequest,
  isSellerIdentityRequest,
} from './better-auth-router.mjs';
export { SellerStore } from './worker.mjs';
export { JerryConversations } from './jerry-conversations.mjs';

// No public endpoint returns a verification code. Pages alone invokes these
// methods over its service binding; the backend has no public route in staging.
export default class SellerService extends WorkerEntrypoint {
  async jerryWebsite(request) {
    try {
      return await jerryWebsite(this.env, request);
    } catch (error) {
      return {
        error: error.status ? error.message : 'Jerry is unavailable.',
        code: error.code || 'JERRY_UNAVAILABLE',
        status: error.status || 503,
      };
    }
  }
  async jerryActivity(request) {
    try {
      return await jerryActivity(this.env, request);
    } catch (error) {
      return {
        error: error.status
          ? error.message
          : 'Conversation details are unavailable.',
        status: error.status || 503,
      };
    }
  }
  async fetch(request) {
    if (isSellerIdentityRequest(request)) {
      const started = Date.now(),
        requestId = crypto.randomUUID();
      let subject = '';
      // Read verified cookie identity only; never inspect credentials or codes.
      if (request.headers.get('Cookie')) {
        try {
          subject =
            (await readBetterAuthIdentity(this.env, request))?.subject || '';
        } catch {}
      }
      const response = await handleSellerIdentityRequest(request, this.env);
      subject = response.headers.get('X-RWAS-Identity-User') || subject;
      const suffix = new URL(request.url).pathname.slice(
        '/api/aircraft-sale/identity'.length,
      );
      const route =
        '/identity' +
        (/^(?:\/[a-z0-9-]+){1,4}\/?$/.test(suffix) ? suffix : '/other');
      const record = async () => {
        if (!this.env.SELLER_STORE) return;
        const stub = this.env.SELLER_STORE.get(
          this.env.SELLER_STORE.idFromName('seller-v2'),
        );
        await stub.fetch(
          new Request(
            'https://seller-service.internal/api/aircraft-sale/_activity/identity',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                route,
                subject,
                status: response.status,
                method: request.method,
                durationMs: Date.now() - started,
                requestId,
              }),
            },
          ),
        );
      };
      this.ctx.waitUntil(record().catch(() => {}));
      const headers = new Headers(response.headers);
      headers.set('X-RWAS-Request-ID', requestId);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
    return worker.fetch(request, this.env);
  }
  async #mail(path, body, headers = {}) {
    if (!this.env.SELLER_STORE)
      return { status: 503, error: 'Seller service is not configured.' };
    const stub = this.env.SELLER_STORE.get(
      this.env.SELLER_STORE.idFromName('seller-v2'),
    );
    const response = await stub.fetch(
      new Request(
        'https://seller-service.internal/api/aircraft-sale/_mail/' + path,
        {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      ),
    );
    return { status: response.status, ...(await response.json()) };
  }
  createVerification({ email, purpose, authorization, ip, context }) {
    return this.#mail(
      'start',
      { email, purpose, ...(context ? { context } : {}) },
      { Authorization: authorization || '', 'CF-Connecting-IP': ip || '' },
    );
  }
  confirmVerification({ ticket, authorization, context }) {
    return this.#mail(
      'confirm',
      { ticket, ...(context ? { context } : {}) },
      { Authorization: authorization || '' },
    );
  }
  cancelVerification({ ticket }) {
    return this.#mail('cancel', { ticket });
  }
}
