import test from 'node:test';
import assert from 'node:assert/strict';
import {
  websiteResponse,
  websiteTranslation,
} from '../../workers/jerry-response/response.mjs';
import { serviceFixture } from './jerry-fixture.mjs';
const env = {
  OPENAI_API_KEY: 'synthetic-key-not-real',
  JERRY_MODEL: 'synthetic-model',
  OPENAI_PROJECT_ID: 'proj_synthetic',
  JERRY_PROMPT_CACHE_RETENTION: 'in_memory',
};
test('responder rejects oversized/forged context and translation uses the same stateless provider contract', async () => {
  const valid = {
    history: [],
    input: { message: 'Question', page: '/', locale: 'en' },
  };
  for (const bad of [
    { ...valid, input: { ...valid.input, page: '/' + 'x'.repeat(401) } },
    { ...valid, input: { ...valid.input, locale: 'fake' } },
    {
      ...valid,
      reference: {
        listing: {
          id: 'valid',
          status: 'active',
          revision: 1,
          title: 'x'.repeat(513),
          nNumber: '',
        },
      },
    },
    { ...valid, tools: ['exec'] },
    {
      ...valid,
      history: Array.from({ length: 12 }, () => ({
        role: 'assistant',
        content: '字'.repeat(14000),
      })),
    },
  ])
    await assert.rejects(
      websiteResponse(env, bad, () => {
        throw Error('Must not reach provider');
      }),
    );
  let body;
  const result = await websiteTranslation(
    env,
    { text: 'N123AB, required.', locale: 'es' },
    async (url, init) => {
      body = JSON.parse(init.body);
      return Response.json({
        status: 'completed',
        output: [
          {
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'N123AB, obligatorio.' }],
          },
        ],
      });
    },
  );
  assert.equal(result.reply, 'N123AB, obligatorio.');
  assert.equal(body.store, false);
  assert.match(body.instructions, /Spanish/);
  assert.equal(body.tools, undefined);
});
test('stateless website provider uses fixed destination, no tools or persistent session, and selected locale', async () => {
  let captured;
  const result = await websiteResponse(
    env,
    {
      history: [{ role: 'user', content: 'Synthetic history' }],
      input: {
        message: 'Synthetic question',
        page: '/aircraft-for-sale',
        locale: 'pt-BR',
      },
      pageContext: 'Published public source',
      reference: null,
    },
    async (url, init) => {
      captured = { url, init };
      return Response.json({
        status: 'completed',
        output: [
          {
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'Resposta sintética.' }],
          },
        ],
      });
    },
  );
  assert.equal(result.reply, 'Resposta sintética.');
  assert.equal(captured.url, 'https://api.openai.com/v1/responses');
  const body = JSON.parse(captured.init.body);
  assert.equal(body.store, false);
  assert.equal(body.model, 'synthetic-model');
  assert.match(body.instructions, /Brazilian Portuguese/);
  for (const key of [
    'tools',
    'previous_response_id',
    'conversation',
    'metadata',
    'sessionKey',
    'background',
  ])
    assert.equal(body[key], undefined);
  assert.equal(captured.init.redirect, 'manual');
  assert.equal(captured.init.headers['OpenAI-Project'], 'proj_synthetic');
  assert.equal(body.prompt_cache_retention, 'in_memory');
});
test('provider redirects are rejected and a named project/cache policy is required', async () => {
  const payload = {
    history: [],
    input: { message: 'Synthetic question', page: '/', locale: 'en' },
  };
  let calls = 0;
  await assert.rejects(
    websiteResponse(env, payload, async () => {
      calls++;
      return new Response('', {
        status: 302,
        headers: { Location: 'https://unapproved.invalid' },
      });
    }),
    /unavailable/,
  );
  assert.equal(calls, 1);
  for (const missing of [
    'OPENAI_PROJECT_ID',
    'JERRY_PROMPT_CACHE_RETENTION',
    'JERRY_MODEL',
  ]) {
    const candidate = { ...env };
    delete candidate[missing];
    await assert.rejects(
      websiteResponse(candidate, payload, () => {
        throw Error('Must not invoke provider');
      }),
      { code: 'JERRY_PROVIDER_UNCONFIGURED' },
    );
  }
});
test('provider configuration and incomplete responses fail closed; no fallback to internal Jerry', async () => {
  await assert.rejects(websiteResponse({}, {}), {
    code: 'JERRY_PROVIDER_UNCONFIGURED',
  });
  const payload = {
    history: [],
    input: { message: 'Question', page: '/', locale: 'en' },
  };
  await assert.rejects(
    websiteResponse(env, payload, async () =>
      Response.json({ status: 'incomplete', output: [] }),
    ),
    /incomplete/,
  );
  const f = await serviceFixture(),
    c = await f.create();
  delete f.env.JERRY_RESPONSE;
  await assert.rejects(f.call('message', f.message(c)), { status: 503 });
  assert.equal(f.relayCalls(), 0);
});
