import { handleJerry } from '../../_jerry/gateway.mjs';
export const onRequest = ({
  request,
  env,
}: {
  request: Request;
  env: Record<string, unknown>;
}) => handleJerry(request, env);
