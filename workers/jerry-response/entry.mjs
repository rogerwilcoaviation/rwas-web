import { WorkerEntrypoint } from 'cloudflare:workers';
import {
  websiteResponse,
  websiteTranslation,
  validateWebsiteResponse,
  validateWebsiteTranslation,
  validateProviderConfiguration,
} from './response.mjs';
import { admittedResponse } from './admission.mjs';
import { jerryKeys, jerryAssert } from '../aircraft-sale/jerry-protocol.mjs';
export { JerryAdmission } from './admission.mjs';
const failure = (error, translation = false) => ({
  error: error.status
    ? error.message
    : translation
      ? 'Translation is unavailable.'
      : 'Jerry could not complete this response. Retry your saved message.',
  status: error.status || 503,
  code: /^JERRY_[A-Z_]+$/.test(error.code || '')
    ? error.code
    : 'JERRY_RESPONSE_UNAVAILABLE',
  ...(Number.isSafeInteger(error.retryAfterMs) &&
  error.retryAfterMs > 0 &&
  error.retryAfterMs <= 300000
    ? { retryAfterMs: error.retryAfterMs }
    : {}),
});
export async function guardedResponse(env, kind, payload) {
  jerryKeys(
    payload,
    kind === 'respond'
      ? ['history', 'input', 'reference', 'pageContext', 'admission']
      : ['text', 'locale', 'admission'],
  );
  const { admission, ...data } = payload;
  if (kind === 'respond') validateWebsiteResponse(data);
  else validateWebsiteTranslation(data);
  validateProviderConfiguration(env);
  jerryAssert(admission?.kind === kind, 400, 'Invalid response admission.');
  return admittedResponse(env, admission, () =>
    kind === 'respond'
      ? websiteResponse(env, data)
      : websiteTranslation(env, data),
  );
}
export default class JerryWebsiteResponse extends WorkerEntrypoint {
  async translate(payload) {
    try {
      return await guardedResponse(this.env, 'translate', payload);
    } catch (error) {
      return failure(error, true);
    }
  }
  fetch() {
    return new Response('Not found', { status: 404 });
  }
  async respond(payload) {
    try {
      return await guardedResponse(this.env, 'respond', payload);
    } catch (error) {
      return failure(error);
    }
  }
}
