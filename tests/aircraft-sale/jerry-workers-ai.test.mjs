import test from 'node:test';
import assert from 'node:assert/strict';
import {
  workersAiMessages,
  workersAiReply,
} from '../../workers/jerry-website-transport/workers-ai.mjs';
import {
  WORKERS_AI_MODEL,
  WORKERS_AI_CAPABILITIES,
  websiteTransport,
} from '../../workers/jerry-website-transport/contract.mjs';

const envelope = () => ({
  kind: 'respond',
  scope: {
    owner: 'owner-must-not-reach-provider',
    sessionRef: 'session-must-not-reach-provider',
  },
  admission: { principal: 'admission-must-not-reach-provider' },
  payload: {
    input: { message: 'Help me describe a used aircraft tool.', locale: 'en' },
    history: [],
    pageContext: 'Published marketplace guidance',
    reference: null,
  },
});
test('Workers AI uses the approved binding and fixed model without tools, credentials or ownership metadata', async () => {
  const e = envelope();
  let captured;
  const env = {
    AI: {
      run: async (...args) => {
        captured = args;
        return {
          response: 'Describe documented condition and the part number.',
        };
      },
    },
  };
  assert.match(await workersAiReply(env, e), /documented condition/);
  assert.equal(captured[0], WORKERS_AI_MODEL);
  assert.deepEqual(Object.keys(captured[1]).sort(), [
    'max_tokens',
    'messages',
    'stream',
    'temperature',
  ]);
  assert.equal(captured[1].stream, false);
  assert.ok(!JSON.stringify(captured).includes('must-not-reach-provider'));
  assert.equal(
    captured[1].messages.filter((m) => m.role === 'system').length,
    1,
  );
  assert.match(captured[1].messages[0].content, /cannot execute tools/);
});
test('model context stays bounded without truncating the current user message or authorized listing identifiers', () => {
  const e = envelope();
  e.payload.history = Array.from({ length: 12 }, () => ({
    role: 'assistant',
    content: '字'.repeat(14000),
  }));
  e.payload.pageContext = '字'.repeat(12000);
  e.payload.reference = {
    listing: { id: 'identifier-preserved', nNumber: 'N123AB' },
  };
  const messages = workersAiMessages(e);
  assert.ok(
    messages.reduce(
      (n, m) => n + new TextEncoder().encode(m.content).length,
      0,
    ) <= 18000,
  );
  assert.equal(messages.at(-1).content, e.payload.input.message);
  assert.ok(JSON.stringify(messages).includes('N123AB'));
});
test('translation stays stateless and protects original identifiers', async () => {
  const e = {
    kind: 'translate',
    payload: { text: 'N123AB listing 145 is pending.', locale: 'pt-BR' },
  };
  let captured;
  const answer = await workersAiReply(
    {
      AI: {
        run: async (_model, body) => {
          captured = body;
          return { response: 'O anúncio 145 de N123AB está pendente.' };
        },
      },
    },
    e,
  );
  assert.match(answer, /N123AB/);
  assert.match(captured.messages[0].content, /Preserve every number/);
  assert.equal(captured.messages[1].content, e.payload.text);
  assert.equal(captured.max_tokens, 2048);
});
test('provider failures, tool requests, empty or oversized output do not fabricate a successful answer', async () => {
  for (const response of [
    { response: '' },
    { response: 'x'.repeat(14001) },
    { response: 'Do it', tool_calls: [{ name: 'delete-user' }] },
    { response: 'Done', action: { type: 'approve' } },
  ]) {
    await assert.rejects(
      workersAiReply({ AI: { run: async () => response } }, envelope()),
      { status: 503 },
    );
  }
  await assert.rejects(
    workersAiReply(
      {
        AI: {
          run: async () => {
            throw Error('provider credential details must stay private');
          },
        },
      },
      envelope(),
    ),
    (error) =>
      error.status === 503 && !error.message.includes('credential details'),
  );
});
test('client accepts only the exact approved live capability contract', async () => {
  const transport = {
    respond() {},
    translate() {},
    erase() {},
    status: async () => ({ ...WORKERS_AI_CAPABILITIES }),
  };
  assert.equal(
    await websiteTransport({ JERRY_WEBSITE_TRANSPORT: transport }),
    transport,
  );
  for (const change of [
    { tools: true },
    { model: 'some-other-model' },
    { provider: 'personal-oauth' },
    { extra: 'exec' },
  ]) {
    transport.status = async () => ({ ...WORKERS_AI_CAPABILITIES, ...change });
    await assert.rejects(
      websiteTransport({ JERRY_WEBSITE_TRANSPORT: transport }),
      { status: 503 },
    );
  }
});
