import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';
import { handleHudSummary } from '../../server/providers/openai/hud-summary.js';
import {
  vestaChatRequest,
  vestaChatText,
  vestaLlmConfig,
} from '../../server/providers/openai/vesta-llm.js';

function env(t, name, value) {
  const old = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  t.after(() => {
    if (old === undefined) delete process.env[name];
    else process.env[name] = old;
  });
}

function post(handler, body) {
  return new Promise((resolve, reject) => {
    const req = Readable.from([Buffer.from(body)]);
    Object.assign(req, {
      method: 'POST',
      url: '/api/openai/hud-summary',
      headers: { host: 'localhost:4173', 'content-type': 'application/json' },
      socket: { remoteAddress: '127.0.0.1' },
    });
    const res = {
      statusCode: 200,
      setHeader() {},
      end(payload = '') {
        resolve({ status: this.statusCode, json: JSON.parse(String(payload)) });
      },
    };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

test('the vesta gateway is off unless VESTA_LLM_BASE_URL is set', () => {
  assert.equal(vestaLlmConfig({}), null);
  assert.equal(vestaLlmConfig({ VESTA_LLM_BASE_URL: '  ' }), null);
});

test('the vesta gateway settings are trimmed, with the default model alias', () => {
  assert.deepEqual(
    vestaLlmConfig({
      VESTA_LLM_BASE_URL: ' http://gateway:4000/v1/ ',
      VESTA_LLM_API_KEY: ' fixture-key ',
    }),
    {
      baseUrl: 'http://gateway:4000/v1',
      apiKey: 'fixture-key',
      model: 'default',
    },
  );
});

test('gateway chat requests switch thinking off', () => {
  const request = vestaChatRequest(
    { baseUrl: 'http://gateway:4000/v1', model: 'default' },
    { system: 'Be brief.', user: '{}', maxTokens: 60 },
  );
  assert.equal(request.url, 'http://gateway:4000/v1/chat/completions');
  assert.deepEqual(request.body.chat_template_kwargs, {
    enable_thinking: false,
  });
  assert.deepEqual(request.body.messages, [
    { role: 'system', content: 'Be brief.' },
    { role: 'user', content: '{}' },
  ]);
  assert.equal(request.body.max_tokens, 60);
  assert.equal(vestaChatText({}), '');
  assert.equal(
    vestaChatText({ choices: [{ message: { content: ' hi ' } }] }),
    'hi',
  );
});

test('HUD summaries go to the vesta gateway when it is configured', async (t) => {
  env(t, 'VESTA_LLM_BASE_URL', 'http://gateway:4000/v1');
  env(t, 'VESTA_LLM_API_KEY', 'fixture-key');
  env(t, 'VESTA_LLM_MODEL', undefined);
  env(t, 'OPENAI_API_KEY', undefined);
  env(t, 'GEV_RATELIMIT_OPENAI_PER_MIN', undefined);
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, init });
    return Response.json({
      choices: [{ message: { content: 'Three ships near Dover now' } }],
    });
  });

  const response = await post(
    handleHudSummary,
    JSON.stringify({ place: 'Dover' }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.json.summary, 'Three ships near Dover now');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://gateway:4000/v1/chat/completions');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer fixture-key');
  const sent = JSON.parse(calls[0].init.body);
  assert.equal(sent.model, 'default');
  assert.deepEqual(sent.chat_template_kwargs, { enable_thinking: false });
});

test('without the vesta gateway, HUD summaries still go to OpenAI', async (t) => {
  env(t, 'VESTA_LLM_BASE_URL', undefined);
  env(t, 'OPENAI_API_KEY', 'fixture-openai-key');
  env(t, 'GEV_RATELIMIT_OPENAI_PER_MIN', undefined);
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, init });
    return Response.json({ output_text: 'All feeds nominal right now' });
  });

  await post(handleHudSummary, JSON.stringify({}));

  assert.equal(calls[0].url, 'https://api.openai.com/v1/responses');
  assert.deepEqual(JSON.parse(calls[0].init.body).reasoning, {
    effort: 'minimal',
  });
});
