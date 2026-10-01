import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';
import {
  handleVestaAgent,
  sanitizeAgentMessages,
  vestaAgentInstructions,
  VESTA_AGENT_TOOLS,
} from '../../server/providers/openai/vesta-agent.js';

function env(t, name, value) {
  const old = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  t.after(() => {
    if (old === undefined) delete process.env[name];
    else process.env[name] = old;
  });
}

function post(body) {
  return new Promise((resolve, reject) => {
    const req = Readable.from([Buffer.from(body)]);
    Object.assign(req, {
      method: 'POST',
      url: '/api/vesta/agent',
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
    Promise.resolve(handleVestaAgent(req, res)).catch(reject);
  });
}

test('the typed agent drops the screenshot guidance a text-only model cannot use', () => {
  const instructions = vestaAgentInstructions();
  assert.match(instructions, /TYPED session/);
  assert.doesNotMatch(instructions, /screenshot/i);
});

test('the map tools are offered in the Chat Completions shape', () => {
  assert.equal(VESTA_AGENT_TOOLS.length > 20, true);
  for (const tool of VESTA_AGENT_TOOLS) {
    assert.equal(tool.type, 'function');
    assert.equal(typeof tool.function.name, 'string');
    assert.equal(typeof tool.function.parameters, 'object');
  }
  assert.ok(
    VESTA_AGENT_TOOLS.some((tool) => tool.function.name === 'fly_to_location'),
  );
});

test('only this loop’s message shapes are accepted', () => {
  assert.equal(sanitizeAgentMessages([]), null);
  assert.equal(sanitizeAgentMessages([{ role: 'system', content: 'x' }]), null);
  assert.equal(sanitizeAgentMessages([{ role: 'user', content: 7 }]), null);
  assert.deepEqual(
    sanitizeAgentMessages([
      { role: 'user', content: 'Take me to Tokyo', extra: 'dropped' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'fly_to_location',
              arguments: '{"query":"Tokyo"}',
            },
          },
        ],
      },
      { role: 'tool', tool_call_id: 'call_1', content: '{"ok":true}' },
    ]),
    [
      { role: 'user', content: 'Take me to Tokyo' },
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'fly_to_location',
              arguments: '{"query":"Tokyo"}',
            },
          },
        ],
      },
      { role: 'tool', tool_call_id: 'call_1', content: '{"ok":true}' },
    ],
  );
});

test('the agent asks the vesta gateway with the tools, thinking off', async (t) => {
  env(t, 'VESTA_LLM_BASE_URL', 'http://gateway:4000/v1');
  env(t, 'VESTA_LLM_API_KEY', 'fixture-key');
  env(t, 'VESTA_LLM_MODEL', undefined);
  env(t, 'GEV_RATELIMIT_OPENAI_PER_MIN', undefined);
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, init });
    return Response.json({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: {
                  name: 'fly_to_location',
                  arguments: '{"query":"Tokyo"}',
                },
              },
            ],
          },
        },
      ],
    });
  });

  const response = await post(
    JSON.stringify({
      messages: [{ role: 'user', content: 'Take me to Tokyo' }],
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(
    response.json.message.tool_calls[0].function.name,
    'fly_to_location',
  );
  assert.equal(calls[0].url, 'http://gateway:4000/v1/chat/completions');
  const sent = JSON.parse(calls[0].init.body);
  assert.equal(sent.model, 'default');
  assert.equal(sent.messages[0].role, 'system');
  assert.equal(sent.messages[1].content, 'Take me to Tokyo');
  assert.equal(sent.tools.length, VESTA_AGENT_TOOLS.length);
  assert.deepEqual(sent.chat_template_kwargs, { enable_thinking: false });
});

test('the agent refuses without the gateway and never relays upstream errors', async (t) => {
  env(t, 'VESTA_LLM_BASE_URL', undefined);
  assert.equal(
    (
      await post(
        JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
      )
    ).status,
    503,
  );

  env(t, 'VESTA_LLM_BASE_URL', 'http://gateway:4000/v1');
  env(t, 'GEV_RATELIMIT_OPENAI_PER_MIN', undefined);
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json(
      { error: { message: 'gateway-internal-detail' } },
      { status: 500 },
    ),
  );
  const failed = await post(
    JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
  );
  assert.equal(failed.status, 502);
  assert.equal(JSON.stringify(failed.json).includes('gateway-internal'), false);
  assert.equal((await post('{"messages":"nope"}')).status, 400);
});
