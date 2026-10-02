import assert from 'node:assert/strict';
import test from 'node:test';
import { createVestaTextSession, vestaTextDraft } from './textSession.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A stand-in for Pipecat's client: records what the page sends, lets the test play the service. */
function fakeService() {
  const fake = { clients: [], sent: [], texts: [] };
  fake.create = (options) => {
    const callbacks = options.callbacks;
    const client = {
      options,
      callbacks,
      connected: null,
      connect: async (params) => {
        client.connected = params;
        setTimeout(() => callbacks.onBotReady(), 0);
      },
      disconnect: async () => {
        client.closed = true;
      },
      sendText: async (text, opts) => fake.texts.push({ text, opts }),
      sendClientMessage: (type, data) => fake.sent.push({ type, data }),
    };
    fake.clients.push(client);
    return client;
  };
  fake.say = (text) => {
    const cb = fake.clients.at(-1).callbacks;
    cb.onBotLlmStarted();
    cb.onBotLlmText({ text });
    cb.onBotLlmStopped();
  };
  return fake;
}

function session(fake, runner = async () => ({ ok: true })) {
  return createVestaTextSession({
    offerUrl: 'https://vesta.example/voice-staging/api/offer',
    runner,
    createClient: fake.create,
    settleMs: 20,
    turnTimeoutMs: 2000,
    connectTimeoutMs: 500,
  });
}

test('a typed turn opens a text-only globe call and comes back as text', async () => {
  const fake = fakeService();
  const vesta = session(fake);
  const answer = vesta.ask('Hello', { onText: () => {} });
  await sleep(10);
  const client = fake.clients[0];
  assert.equal(client.options.enableMic, false);
  assert.deepEqual(client.connected, {
    webrtcRequestParams: {
      endpoint: 'https://vesta.example/voice-staging/api/offer',
      requestData: { profile: 'globe', text: true },
    },
  });
  assert.deepEqual(fake.texts, [
    { text: 'Hello', opts: { run_immediately: true, audio_response: false } },
  ]);
  fake.say('Hello, Hugo.');
  assert.deepEqual(await answer, { text: 'Hello, Hugo.', ran: 0 });
  assert.equal(vesta.connected, true);
});

test('a map tool runs here and the turn waits for her answer after it', async () => {
  const fake = fakeService();
  const ran = [];
  const vesta = session(fake, async (name, args) => {
    ran.push([name, args]);
    return { ok: true, label: 'Paris' };
  });
  const answer = vesta.ask('Fly to Paris');
  await sleep(10);
  const cb = fake.clients[0].callbacks;
  cb.onBotLlmStarted();
  cb.onBotLlmStopped(); // a run that only calls the tool
  cb.onServerMessage({
    type: 'tool-call',
    id: 'c1',
    name: 'fly_to_location',
    args: { locationId: 'paris' },
  });
  await sleep(40); // longer than the settle time: the turn must not end here
  assert.deepEqual(ran, [['fly_to_location', { locationId: 'paris' }]]);
  assert.deepEqual(fake.sent, [
    {
      type: 'tool-result',
      data: { id: 'c1', result: { ok: true, label: 'Paris' } },
    },
  ]);
  fake.say('Flying to Paris.');
  assert.deepEqual(await answer, { text: 'Flying to Paris.', ran: 1 });
});

test('a tool on the service (memory, search) also holds the turn open', async () => {
  const fake = fakeService();
  const vesta = session(fake);
  const answer = vesta.ask('What is the news?');
  await sleep(10);
  const cb = fake.clients[0].callbacks;
  cb.onBotLlmStarted();
  cb.onBotLlmText({ text: 'One moment.' });
  cb.onBotLlmStopped();
  cb.onLLMFunctionCallStarted({ function_name: 'news_search' });
  await sleep(40);
  fake.say('The big story today is the launch.');
  assert.equal((await answer).text, 'The big story today is the launch.');
});

test('a call that ends fails the turn, and the next question opens a new call', async () => {
  const fake = fakeService();
  const vesta = session(fake);
  const first = vesta.ask('Hello');
  await sleep(10);
  fake.clients[0].callbacks.onDisconnected();
  await assert.rejects(first, /the call ended/);
  const second = vesta.ask('Hello again');
  await sleep(10);
  assert.equal(fake.clients.length, 2);
  fake.say('Hello.');
  assert.equal((await second).text, 'Hello.');
});

test('the draft is on only when configured and asked for in the address', () => {
  const at = (search) => ({ location: { search } });
  assert.equal(vestaTextDraft(at('?vesta-text'), 'https://x/api/offer'), true);
  assert.equal(vestaTextDraft(at(''), 'https://x/api/offer'), false);
  assert.equal(vestaTextDraft(at('?vesta-text'), ''), false);
  assert.equal(vestaTextDraft(at('?vesta-text'), undefined), false);
});

test('prepare opens the call before the first question, and asks nothing', async () => {
  const fake = fakeService();
  const vesta = session(fake);
  assert.equal(await vesta.prepare(), true);
  assert.equal(fake.clients.length, 1);
  assert.deepEqual(fake.texts, []);
  const answer = vesta.ask('Hello');
  await sleep(10);
  assert.equal(fake.clients.length, 1, 'the prepared call is the one used');
  fake.say('Hello.');
  assert.equal((await answer).text, 'Hello.');
});
