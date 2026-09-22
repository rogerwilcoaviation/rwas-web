import {
  Context,
  destinationAllowed,
  configured,
  json,
  methodNotAllowed,
  PRODUCTION_SITE_KEY,
  staging,
  STAGING_FIXTURE,
  STAGING_ORIGIN,
  unavailable,
} from '../_intake/core';
// Runtime configuration contains only public values; no challenge or dispatch secrets.
export async function onRequestGet({ request, env }: Context) {
  if (!destinationAllowed(env, request)) return unavailable();
  const origin = new URL(request.url).origin;
  if (staging(env) || origin === STAGING_ORIGIN) {
    if (!staging(env) || origin !== STAGING_ORIGIN || !configured(env, true))
      return unavailable();
    return json({
      staging: true,
      siteKey: env.INTAKE_STAGING_SITE_KEY,
      requestId: env.INTAKE_STAGING_REQUEST_ID,
      fixture: STAGING_FIXTURE,
    });
  }
  return json({ staging: false, siteKey: PRODUCTION_SITE_KEY });
}
export const onRequest = methodNotAllowed;
