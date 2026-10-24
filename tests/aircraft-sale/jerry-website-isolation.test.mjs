import test from 'node:test';
import assert from 'node:assert/strict';
import { serviceFixture, transportReply } from './jerry-fixture.mjs';
import { transportFixture } from './fixtures/jerry-transport-runtime.mjs';
import { WEBSITE_PROTOCOL } from '../../workers/jerry-website-transport/contract.mjs';
const connect = (f, native) => {
  f.env.JERRY_WEBSITE_TRANSPORT = Object.fromEntries(
    ['respond', 'translate', 'status', 'erase'].map((method) => [
      method,
      async (request) => (await native.call(method, request)).body,
    ]),
  );
};
test('verified website authority supplies transport scope; browser identity and legacy/direct transports cannot grant access', async () => {
  const f = await serviceFixture(),
    c = await f.create();
  let captured,
    oldCalls = 0;
  f.env.JERRY_RESPONSE = {
    respond: () => {
      oldCalls++;
      throw Error('Must not reach old path');
    },
  };
  const respond = f.env.JERRY_WEBSITE_TRANSPORT.respond;
  f.env.JERRY_WEBSITE_TRANSPORT.respond = async (envelope) => {
    captured = envelope;
    return respond(envelope);
  };
  await f.call('message', f.message(c));
  assert.equal(captured.scope.owner, f.context.identity.owner);
  assert.equal(captured.scope.sessionRef, f.context.identity.sessionRef);
  assert.equal(captured.scope.category, 'account');
  assert.equal(captured.scope.surface, 'exchange');
  assert.ok(!JSON.stringify(captured).includes('synthetic-cookie'));
  assert.ok(!JSON.stringify(captured).includes(f.profile.email));
  assert.equal(oldCalls, 0);
  await assert.rejects(
    f.call('message', { ...f.message(c), owner: 'f'.repeat(64) }),
    { status: 400 },
  );
  delete f.env.JERRY_WEBSITE_TRANSPORT;
  await assert.rejects(f.call('message', f.message(c)), {
    code: 'JERRY_TRANSPORT_UNAVAILABLE',
  });
  assert.equal(oldCalls, 0);
});
test('wrong owner/surface/session/generation reply envelopes cannot finalize canonical history', async () => {
  for (const change of [
    { owner: 'f'.repeat(64) },
    { surface: 'public' },
    { sessionRef: 'f'.repeat(64) },
    { generation: 2 },
  ]) {
    const f = await serviceFixture(),
      c = await f.create();
    f.env.JERRY_WEBSITE_TRANSPORT.respond = async (e) => ({
      ...transportReply(e, 'Mismatched reply'),
      scope: { ...e.scope, ...change },
    });
    await assert.rejects(f.call('message', f.message(c)), {
      code: 'JERRY_REPLAY_CONFLICT',
    });
    assert.equal(
      (await f.call('read', { id: c.id })).turns[0].result,
      undefined,
    );
  }
});
test('logout/account-session switch during native transport delivery cancels controlled copies and discards the late reply', () =>
  transportFixture(async (native) => {
    for (const signOut of [true, false]) {
      const f = await serviceFixture();
      connect(f, native);
      const c = await f.create(),
        input = f.message(c),
        gate = native.delayed();
      const response = f.call('message', input);
      await gate.started();
      if (signOut) f.signedIn(false);
      else f.identity.providerSessionId = 'new-synthetic-session';
      gate.release();
      await assert.rejects(response, { status: 401 });
      const jobScope = {
        category: 'account',
        owner: f.context.identity.owner,
        surface: 'exchange',
        conversationId: c.id,
        generation: 1,
        sessionRef: f.context.identity.sessionRef,
        sessionExpiresAt: f.context.identity.expiresAt,
      };
      const stored = JSON.stringify(await native.inspect(jobScope));
      assert.ok(!stored.includes('Synthetic question'));
      assert.ok(!stored.includes('Synthetic website-only reply'));
      assert.deepEqual(f.f.state().jerryTransportCleanup, {});
    }
  }));
test('wrong cleanup acknowledgment retains the obligation across restart and recovers through the seller alarm', () =>
  transportFixture(async (native) => {
    for (const wrong of ['owner', 'conversationId', 'generation']) {
      const f = await serviceFixture();
      connect(f, native);
      const c = await f.create(),
        input = f.message(c),
        gate = native.delayed();
      const erase = f.env.JERRY_WEBSITE_TRANSPORT.erase;
      f.env.JERRY_WEBSITE_TRANSPORT.erase = async (request) => {
        const ack = await erase(request);
        return {
          ...ack,
          scope: {
            ...ack.scope,
            [wrong]:
              wrong === 'generation'
                ? 99
                : wrong === 'owner'
                  ? 'f'.repeat(64)
                  : crypto.randomUUID(),
          },
        };
      };
      const response = f.call('message', input);
      await gate.started();
      f.signedIn(false);
      gate.release();
      await assert.rejects(response, { status: 401 });
      let jobs = f.f.state().jerryTransportCleanup;
      assert.equal(Object.keys(jobs).length, 1);
      f.env.JERRY_WEBSITE_TRANSPORT.erase = erase;
      const state = f.f.state();
      for (const job of Object.values(state.jerryTransportCleanup))
        job.cleanupAfter = Date.now() - 1;
      f.f.durable.set('state', state);
      const restarted = f.f.restart();
      await restarted.alarm();
      assert.deepEqual(f.f.state().jerryTransportCleanup, {});
    }
  }));
test('conversation deletion drains every controlled transport copy while preserving the listing draft', () =>
  transportFixture(async (native) => {
    const f = await serviceFixture();
    connect(f, native);
    const c = await f.create();
    await f.f.call(
      '/draft',
      'PUT',
      { make: 'Synthetic', model: 'Preserved' },
      f.proof.authorization.slice(7),
    );
    const draft = structuredClone(f.f.state().drafts);
    await f.call('message', f.message(c));
    const scope = {
      category: 'account',
      owner: f.context.identity.owner,
      surface: 'exchange',
      conversationId: c.id,
    };
    assert.ok(
      JSON.stringify(await native.inspect(scope)).includes(
        'Synthetic question',
      ),
    );
    const result = await f.call('delete', { id: c.id, generation: 1 });
    assert.equal(result.deleted, true);
    const content = JSON.stringify(await native.inspect(scope));
    assert.ok(!content.includes('Synthetic question'));
    assert.ok(!content.includes('Synthetic website-only reply'));
    assert.deepEqual(f.f.state().drafts, draft);
    await assert.rejects(f.call('read', { id: c.id }), { status: 410 });
    assert.equal(f.f.state().jerryConversationRefs[c.id].cleanupComplete, true);
  }));
test('an abandoned result keeps a durable cleanup obligation until the seller alarm erases its copies', () =>
  transportFixture(async (native) => {
    const f = await serviceFixture();
    connect(f, native);
    const c = await f.create(),
      respond = f.env.JERRY_WEBSITE_TRANSPORT.respond;
    f.env.JERRY_WEBSITE_TRANSPORT.respond = async (envelope) => {
      await respond(envelope);
      throw Error('Synthetic caller lost after completion');
    };
    await assert.rejects(f.call('message', f.message(c)));
    const state = f.f.state(),
      jobs = Object.values(state.jerryTransportCleanup);
    assert.equal(jobs.length, 1);
    assert.ok(
      JSON.stringify(await native.inspect(jobs[0].scope)).includes(
        'Synthetic question',
      ),
    );
    jobs[0].cleanupAfter = Date.now() - 1;
    f.f.durable.set('state', state);
    await f.f.restart().alarm();
    assert.deepEqual(f.f.state().jerryTransportCleanup, {});
    const erased = JSON.stringify(await native.inspect(jobs[0].scope));
    assert.ok(!erased.includes('Synthetic question'));
    assert.ok(!erased.includes('Synthetic website-only reply'));
  }));
test('expired sessions, account switches and role changes during delivery cannot publish or retain a late transport reply', () =>
  transportFixture(async (native) => {
    for (const change of [
      (f) => {
        f.identity.expiresAt = Date.now() - 1;
      },
      (f) => {
        f.identity.subject = 'another-verified-user';
      },
      (f) => {
        f.identity.isAdministrator = true;
      },
    ]) {
      const f = await serviceFixture();
      connect(f, native);
      const c = await f.create(),
        gate = native.delayed(),
        response = f.call('message', f.message(c));
      await gate.started();
      change(f);
      gate.release();
      await assert.rejects(response, { status: 401 });
      const content = JSON.stringify(
        await native.inspect({
          category: 'account',
          owner: f.context.identity.owner,
          surface: 'exchange',
          conversationId: c.id,
        }),
      );
      assert.ok(!content.includes('Synthetic question'));
      assert.ok(!content.includes('Synthetic website-only reply'));
      assert.deepEqual(f.f.state().jerryTransportCleanup, {});
    }
  }));
test('a mismatched whole-conversation erase receipt cannot complete canonical deletion', () =>
  transportFixture(async (native) => {
    const f = await serviceFixture();
    connect(f, native);
    const c = await f.create();
    await f.call('message', f.message(c));
    const erase = f.env.JERRY_WEBSITE_TRANSPORT.erase;
    f.env.JERRY_WEBSITE_TRANSPORT.erase = async (request) => ({
      ...(await erase(request)),
      scope: { ...request.scope, conversationId: crypto.randomUUID() },
    });
    assert.equal(
      (await f.call('delete', { id: c.id, generation: 1 })).pending,
      true,
    );
    assert.notEqual(
      f.f.state().jerryConversationRefs[c.id].cleanupComplete,
      true,
    );
    f.env.JERRY_WEBSITE_TRANSPORT.erase = erase;
    await f.objects
      .get(f.owner + ':exchange')
      .object()
      .alarm();
    assert.equal(f.f.state().jerryConversationRefs[c.id].cleanupComplete, true);
  }));
test('translation and administrator status remain deterministic, advisory and incapable of management actions', async () => {
  const f = await serviceFixture(),
    c = await f.create();
  f.identity.isAdministrator = true;
  const result = await f.call(
    'message',
    f.message(c, 'Account status', 'status'),
  );
  assert.match(result.result.reply, /moderation queue/);
  assert.equal(f.relayCalls(), 0);
  await assert.rejects(
    f.call('message', f.message(c, 'Create listing', 'listing')),
    { status: 403 },
  );
  await assert.rejects(f.call('delete-user', { owner: 'x' }), { status: 400 });
  assert.equal(WEBSITE_PROTOCOL, 'jerry-website-transport-v1');
});
