import {
  Context,
  destinationAllowed,
  configured,
  json,
  methodNotAllowed,
  secretEquals,
  unavailable,
} from '../_intake/core';
import { drain } from '../_intake/dispatch';
export async function onRequestPost({ request, env }: Context) {
  if (!destinationAllowed(env, request)) return unavailable();
  if (!env.INTAKE_DISPATCH_SECRET || env.INTAKE_DISPATCH_SECRET.length < 32)
    return unavailable();
  const supplied =
    request.headers.get('Authorization')?.match(/^Bearer (\S{1,512})$/)?.[1] ||
    '';
  if (!(await secretEquals(supplied, env.INTAKE_DISPATCH_SECRET)))
    return json({ error: 'Unauthorized.' }, 401);
  if (!configured(env)) return unavailable();
  try {
    return json({ processed: await drain(env) });
  } catch {
    return unavailable();
  }
}
export const onRequest = methodNotAllowed;
