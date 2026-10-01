import assert from 'node:assert/strict';
import test from 'node:test';
import { askVestaRecon, clearBottom, trimHistory } from './ask.js';

function answers(...messages) {
  const bodies = [];
  const fetchImpl = async (url, init) => {
    bodies.push({ url, body: JSON.parse(init.body) });
    return Response.json({ message: messages.shift() });
  };
  return { fetchImpl, bodies };
}

test('a tool call runs through the runner and its result goes back', async () => {
  const { fetchImpl, bodies } = answers(
    {
      role: 'assistant',
      content: '',
      tool_calls: [
        {
          id: 'call_1',
          type: 'function',
          function: { name: 'fly_to_location', arguments: '{"query":"Tokyo"}' },
        },
      ],
    },
    { role: 'assistant', content: 'Flying to Tokyo.' },
  );
  const ran = [];
  const history = [];
  const result = await askVestaRecon('Take me to Tokyo', {
    history,
    fetchImpl,
    runner: async (name, args) => {
      ran.push([name, args]);
      return { ok: true, action: name };
    },
  });

  assert.deepEqual(result, { text: 'Flying to Tokyo.', ran: 1 });
  assert.deepEqual(ran, [['fly_to_location', { query: 'Tokyo' }]]);
  assert.equal(bodies[0].url, '/api/vesta/agent');
  assert.deepEqual(bodies[1].body.messages.at(-1), {
    role: 'tool',
    tool_call_id: 'call_1',
    content: '{"ok":true,"action":"fly_to_location"}',
  });
  assert.equal(history.length, 4);
});

test('a failing tool becomes an ok:false result instead of an exception', async () => {
  const { fetchImpl, bodies } = answers(
    {
      role: 'assistant',
      content: '',
      tool_calls: [
        {
          id: 'call_1',
          type: 'function',
          function: { name: 'track_entity', arguments: 'not json' },
        },
      ],
    },
    { role: 'assistant', content: 'I could not track that.' },
  );
  const result = await askVestaRecon('Track it', {
    history: [],
    fetchImpl,
    runner: async () => ({ ok: true }),
  });
  assert.equal(result.text, 'I could not track that.');
  assert.equal(JSON.parse(bodies[1].body.messages.at(-1).content).ok, false);
});

test('the history is trimmed at a user turn', () => {
  const history = [
    { role: 'user', content: 'a' },
    { role: 'assistant', content: '', tool_calls: [] },
    { role: 'tool', tool_call_id: 'x', content: '{}' },
    { role: 'assistant', content: 'done' },
    { role: 'user', content: 'b' },
    { role: 'assistant', content: 'ok' },
  ];
  assert.deepEqual(trimHistory(history, 3), [
    { role: 'user', content: 'b' },
    { role: 'assistant', content: 'ok' },
  ]);
  assert.equal(trimHistory(history, 10), history);
});

test('the box rises above whatever shares its columns, lowest first', () => {
  const rect = (left, top, width, height) => ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  });
  const box = { left: 460, right: 980, height: 37 };
  const dock = rect(482, 820, 476, 62);
  const credits = rect(24, 774, 525, 28);
  const readout = rect(1165, 706, 216, 68);

  // Above the dock, then above the credits that reach under the box.
  assert.equal(clearBottom(box, [readout, credits, dock], 900), 766);
  // Credits that stay left of the box do not move it.
  assert.equal(clearBottom(box, [dock, rect(24, 774, 400, 28)], 900), 812);
  // Hidden (zero-size) obstacles are ignored; nothing at all means the bottom.
  assert.equal(clearBottom(box, [rect(500, 800, 0, 0)], 900), 900);
});
