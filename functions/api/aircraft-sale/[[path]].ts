interface Env {
  SELLER_API?: { fetch(request: Request): Promise<Response> };
}
export const onRequest = async ({
  request,
  env,
}: {
  request: Request;
  env: Env;
}) => {
  if (!env.SELLER_API)
    return Response.json(
      { error: 'Seller service is not configured.' },
      { status: 503 },
    );
  // Internal service binding: never fall back to the production sale API.
  return env.SELLER_API.fetch(request);
};
