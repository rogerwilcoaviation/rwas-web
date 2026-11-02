// Bounded hosted qualification. All inputs/content are fixed synthetic fixtures.
import { JerryConversations } from '../aircraft-sale/jerry-conversations.mjs';
import { WebsiteTransportCopies } from '../jerry-website-transport/copies.mjs';
import { runWebsiteResponse } from '../jerry-website-transport/entry.mjs';
import {
  scopeKey,
  WEBSITE_PROTOCOL,
} from '../jerry-website-transport/contract.mjs';
export { JerryAdmission } from '../jerry-response/admission.mjs';
const owner = 'c'.repeat(64);
const conversationId = '00000000-0000-4000-8000-000000000101';
const operationId = '00000000-0000-4000-8000-000000000102';
const stub = (env, binding, name) =>
  env[binding].get(env[binding].idFromName(name));
const control = (env) => stub(env, 'QA_CONTROL', 'fixed-synthetic-control');
async function call(target, path, body = {}, headers = {}) {
  const response = await target.fetch(
    new Request('https://jerry.internal/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
  );
  const value = await response.json();
  if (!response.ok)
    throw Error('Synthetic qualification operation failed: ' + path);
  return value;
}
async function receipt(env, kind, info) {
  await call(control(env), 'receipt', {
    kind,
    at: Date.now(),
    runtimeCallback: !!info && Number.isInteger(info.retryCount),
    retryCount: info?.retryCount || 0,
  });
}
export class QualificationCopies extends WebsiteTransportCopies {
  async fetch(request) {
    if (new URL(request.url).pathname === '/inspect') {
      await request.arrayBuffer();
      const rows = [
        ...(await this.ctx.storage.list({ prefix: 'op:' })).values(),
      ];
      return Response.json({
        contentCopies: rows.filter((r) => r.payload || r.reply).length,
        alarm: await this.ctx.storage.getAlarm(),
      });
    }
    return super.fetch(request);
  }
  async alarm(info) {
    await super.alarm();
    await receipt(this.env, 'copies', info);
  }
}
export class QualificationConversations extends JerryConversations {
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/shorten') {
      await request.arrayBuffer();
      await this.tx(async (tx) => {
        const meta = await tx.get('c:' + conversationId);
        meta.expiresAt = Date.now() + 60000;
        await tx.put('c:' + conversationId, meta);
      });
      return Response.json({ ok: true });
    }
    if (path === '/inspect') {
      await request.arrayBuffer();
      const rows = await this.ctx.storage.list();
      return Response.json({
        turns: [...rows.keys()].filter((k) => k.startsWith('t:')).length,
        live: [...rows.entries()].filter(
          ([k, v]) => k.startsWith('c:') && v.status === 'active',
        ).length,
        alarm: await this.ctx.storage.getAlarm(),
      });
    }
    return super.fetch(request);
  }
  async alarm(info) {
    await super.alarm();
    await receipt(this.env, 'canonical', info);
  }
}
export class QualificationControl {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (
      path.endsWith('/_jerry/erase') ||
      path.endsWith('/_jerry/log-committed') ||
      path.endsWith('/_jerry/cleanup-complete')
    ) {
      await request.arrayBuffer();
      return Response.json({ ok: true });
    }
    if (path === '/receipt') {
      const body = await request.json();
      if (!['copies', 'canonical'].includes(body.kind))
        return new Response('Not found', { status: 404 });
      await this.ctx.storage.put('receipt:' + body.kind, body);
      return Response.json({ ok: true });
    }
    if (path === '/start') {
      await request.arrayBuffer();
      if (Date.now() > Number(this.env.QA_EXPIRES_AT))
        return new Response('Qualification closed', { status: 410 });
      const began = await this.ctx.storage.transaction(async (tx) => {
        if (await tx.get('started')) return false;
        await tx.put('started', Date.now());
        await tx.put('draft-preserved', true);
        return true;
      });
      if (!began) return Response.json({ alreadyStarted: true });
      try {
        const headers = {
          'X-Jerry-Owner': owner,
          'X-Jerry-Surface': 'exchange',
        };
        const conversations = stub(
          this.env,
          'JERRY_CONVERSATIONS',
          'synthetic-qualification-only',
        );
        await call(conversations, 'create', { id: conversationId }, headers);
        const reservation = await call(
          conversations,
          'reserve',
          {
            id: conversationId,
            generation: 1,
            turnId: operationId,
            input: {
              message: 'Synthetic retention check',
              mode: 'chat',
              locale: 'en',
              page: '/aircraft-for-sale',
            },
          },
          headers,
        );
        await call(
          conversations,
          'finalize',
          {
            id: conversationId,
            generation: 1,
            turnId: operationId,
            lease: reservation.turn.lease,
            result: { reply: 'Synthetic canonical response' },
          },
          headers,
        );
        await call(conversations, 'shorten');
        const now = Date.now();
        const envelope = {
          protocol: WEBSITE_PROTOCOL,
          scope: {
            category: 'account',
            owner,
            surface: 'exchange',
            conversationId,
            generation: 1,
            sessionRef: 'd'.repeat(64),
            sessionExpiresAt: now + 900000,
          },
          operationId,
          issuedAt: now,
          expiresAt: now + 60000,
          kind: 'respond',
          payload: {
            input: {
              message: 'Reply with JERRY_ACCOUNT_QA_OK.',
              mode: 'chat',
              locale: 'en',
              page: '/aircraft-for-sale',
            },
            history: [],
            reference: null,
            pageContext: 'Synthetic qualification only',
          },
          admission: {
            category: 'account',
            principal: 'e'.repeat(64),
            surface: 'exchange',
            kind: 'respond',
            operationId,
            issuedAt: now,
            fingerprint: 'f'.repeat(64),
          },
        };
        await this.ctx.storage.put('scope', envelope.scope);
        const result = await runWebsiteResponse(this.env, 'respond', envelope);
        await this.ctx.storage.put(
          'modelPassed',
          result.reply.includes('JERRY_ACCOUNT_QA_OK'),
        );
        return Response.json({
          started: true,
          modelPassed: result.reply.includes('JERRY_ACCOUNT_QA_OK'),
          expiresAt: envelope.expiresAt,
        });
      } catch {
        await this.ctx.storage.put('failed', true);
        return Response.json(
          {
            error:
              'Synthetic hosted qualification failed; do not retry inference automatically.',
          },
          { status: 503 },
        );
      }
    }
    if (path === '/status') {
      await request.arrayBuffer();
      const scope = await this.ctx.storage.get('scope');
      const canonical = await call(
        stub(this.env, 'JERRY_CONVERSATIONS', 'synthetic-qualification-only'),
        'inspect',
      );
      const copies = scope
        ? await call(
            stub(this.env, 'JERRY_TRANSPORT_COPIES', scopeKey(scope)),
            'inspect',
          )
        : { contentCopies: null };
      return Response.json({
        started: await this.ctx.storage.get('started'),
        failed: !!(await this.ctx.storage.get('failed')),
        modelPassed: !!(await this.ctx.storage.get('modelPassed')),
        canonical,
        copies,
        canonicalAlarm: await this.ctx.storage.get('receipt:canonical'),
        copiesAlarm: await this.ctx.storage.get('receipt:copies'),
        draftPreserved: !!(await this.ctx.storage.get('draft-preserved')),
      });
    }
    return new Response('Not found', { status: 404 });
  }
}
const qualification = {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/' && request.method === 'GET')
      return new Response(
        '<!doctype html><html><head><title>Jerry synthetic qualification</title></head><body><h1>Fixed synthetic qualification</h1><p>No customer data. One fixed model prompt and native expiry checks.</p><form method="post" action="/start"><button>Start fixed synthetic test</button></form><p><a href="/status">Read qualification status</a></p></body></html>',
        {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
            'Content-Security-Policy':
              "default-src 'none'; form-action 'self'; frame-ancestors 'none'",
          },
        },
      );
    if (
      (path === '/start' && request.method === 'POST') ||
      (path === '/status' && request.method === 'GET')
    )
      return control(env).fetch(
        new Request('https://qualification.internal' + path, {
          method: 'POST',
        }),
      );
    return new Response('Not found', { status: 404 });
  },
};
export default qualification;
