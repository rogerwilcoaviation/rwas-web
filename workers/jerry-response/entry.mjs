import { WorkerEntrypoint } from 'cloudflare:workers';
import { websiteResponse, websiteTranslation } from './response.mjs';
export default class JerryWebsiteResponse extends WorkerEntrypoint {
  async translate(payload) {
    try {
      return await websiteTranslation(this.env, payload);
    } catch {
      return { error: 'Translation is unavailable.' };
    }
  }
  fetch() {
    return new Response('Not found', { status: 404 });
  }
  async respond(payload) {
    try {
      return await websiteResponse(this.env, payload);
    } catch {
      return {
        error:
          'Jerry could not complete this response. Retry your saved message.',
      };
    }
  }
}
