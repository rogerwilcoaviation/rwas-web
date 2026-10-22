import { clerkProductionIdentity } from '../../../workers/aircraft-sale/clerk-production.mjs';

export default {
  async fetch(request, env) {
    try {
      await clerkProductionIdentity(env, request);
      return Response.json({ ok: true });
    } catch (error) {
      const stage = typeof error?.authStage === 'string' ? error.authStage : '';
      return Response.json(
        { ok: false, stage },
        {
          status: Number.isInteger(error?.status) ? error.status : 503,
          headers: stage ? { 'X-RWAS-Clerk-Failure-Stage': stage } : {},
        },
      );
    }
  },
};
