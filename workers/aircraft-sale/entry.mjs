import { WorkerEntrypoint } from 'cloudflare:workers';
import worker from './worker.mjs';
export { SellerStore } from './worker.mjs';

// No public endpoint returns a verification code. Pages alone invokes these
// methods over its service binding; the backend has no public route in staging.
export default class SellerService extends WorkerEntrypoint {
  fetch(request) {
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
  createVerification({ email, purpose, authorization, ip }) {
    return this.#mail(
      'start',
      { email, purpose },
      { Authorization: authorization || '', 'CF-Connecting-IP': ip || '' },
    );
  }
  confirmVerification({ ticket, authorization }) {
    return this.#mail(
      'confirm',
      { ticket },
      { Authorization: authorization || '' },
    );
  }
  cancelVerification({ ticket }) {
    return this.#mail('cancel', { ticket });
  }
}
