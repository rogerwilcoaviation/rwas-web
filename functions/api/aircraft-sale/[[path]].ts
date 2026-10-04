import { STAGING_ORIGIN } from '../../_intake/core';
import { sellerDestinationAllowed, sellerMail } from '../../_seller/mail.mjs';

interface Env {
  SELLER_API?: { fetch(request: Request): Promise<Response> };
  INTAKE_STAGING_MODE?: string;
  SELLER_STAGING_ORIGIN?: string;
  SELLER_MAIL_VIA_PAGES?: string;
}
export const onRequest = async ({
  request,
  env,
}: {
  request: Request;
  env: Env;
}) => {
  if (!sellerDestinationAllowed(request, env, STAGING_ORIGIN))
    return Response.json(
      { error: 'Staging destination not allowed.' },
      { status: 503 },
    );
  if (!env.SELLER_API)
    return Response.json(
      { error: 'Seller service is not configured.' },
      { status: 503 },
    );
  // Internal service binding: never fall back to the production sale API.
  const mailed = await sellerMail(request, env);
  if (mailed) return mailed;
  return env.SELLER_API.fetch(request);
};
