import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createVestaVoiceSession,
  toolResultPayload,
  vestaVoiceOption,
} from './voiceSession.js';

function fakeDocument() {
  const appended = [];
  return {
    appended,
    body: { appendChild: (el) => appended.push(el) },
    createElement: () => ({
      dataset: {},
      play: async () => {},
      pause() {},
      remove() {},
      removeAttribute() {},
    }),
  };
}

function fakeClient() {
  const fake = {
    sent: [],
    callbacks: null,
    connected: null,
    disconnected: false,
  };
  fake.create = (options) => {
    fake.callbacks = options.callbacks;
    return {
      initDevices: async () => {},
      connect: async (params) => {
        fake.connected = params;
        fake.callbacks.onBotReady();
      },
      disconnect: async () => {
        fake.disconnected = true;
      },
      sendClientMessage: (type, data) => fake.sent.push({ type, data }),
      sendText: async (text) => fake.sent.push({ type: 'text', data: text }),
      tracks: () => ({ local: { audio: null } }),
    };
  };
  return fake;
}

function adapter({ runAction = async () => ({ ok: true }) } = {}) {
  const events = [];
  const fake = fakeClient();
  const runner = async () => ({ ok: true });
  const session = createVestaVoiceSession({
    emit: (event) => events.push(event),
    runAction,
    runner,
    offerUrl: 'https://vesta.example/voice-staging/api/offer',
    createClient: fake.create,
    documentRef: fakeDocument(),
  });
  return { session, events, fake, runner };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('a call asks vesta-voice for the globe profile and is live once the bot is ready', async () => {
  const { session, events, fake, runner } = adapter();
  assert.deepEqual(session.capabilities, {
    costControls: false,
    pushToTalk: false,
  });
  assert.equal(session.runner, runner);
  await session.start();
  assert.deepEqual(fake.connected, {
    webrtcRequestParams: {
      endpoint: 'https://vesta.example/voice-staging/api/offer',
      requestData: { profile: 'globe' },
    },
  });
  assert.deepEqual(
    events.map((event) => event.state),
    ['connecting', 'listening'],
  );
});

test('a map tool from the service runs here and its result goes back', async () => {
  const ran = [];
  const { session, fake, events } = adapter({
    runAction: async (name, args) => {
      ran.push([name, args]);
      return { ok: true, arrived: 'London' };
    },
  });
  await session.start();
  fake.callbacks.onServerMessage({
    type: 'tool-call',
    id: 'call_1',
    name: 'fly_to_location',
    args: { locationId: 'london' },
  });
  await tick();
  assert.deepEqual(ran, [['fly_to_location', { locationId: 'london' }]]);
  assert.deepEqual(fake.sent, [
    {
      type: 'tool-result',
      data: { id: 'call_1', result: { ok: true, arrived: 'London' } },
    },
  ]);
  assert.ok(events.some((event) => event.state === 'executing'));
  assert.equal(events.at(-1).state, 'listening');
});

test('a failing map tool answers ok:false instead of leaving the model waiting', async () => {
  const { session, fake } = adapter({
    runAction: async () => {
      throw new Error('Nothing matched');
    },
  });
  await session.start();
  fake.callbacks.onServerMessage({
    type: 'tool-call',
    id: 'c',
    name: 'track_entity',
  });
  await tick();
  assert.deepEqual(fake.sent[0].data, {
    id: 'c',
    result: { ok: false, error: 'Nothing matched' },
  });
});

test('a result that arrives after the call ended is not sent', async () => {
  let finish;
  const { session, fake } = adapter({
    runAction: () => new Promise((resolve) => (finish = resolve)),
  });
  await session.start();
  fake.callbacks.onServerMessage({
    type: 'tool-call',
    id: 'c',
    name: 'move_camera',
  });
  session.stop();
  finish({ ok: true });
  await tick();
  assert.equal(fake.disconnected, true);
  assert.deepEqual(fake.sent, []);
});

test('the service ending the call turns voice off; her words become a transcript', async () => {
  const { session, fake, events } = adapter();
  await session.start();
  fake.callbacks.onServerMessage({
    type: 'heard',
    text: 'Fly to London.',
    final: true,
  });
  fake.callbacks.onBotStartedSpeaking();
  fake.callbacks.onBotTtsText({ text: 'Flying to London.' });
  fake.callbacks.onBotStoppedSpeaking();
  fake.callbacks.onDisconnected();
  const transcripts = events.filter((event) => event.type === 'transcript');
  assert.deepEqual(transcripts.at(0), {
    type: 'transcript',
    role: 'user',
    text: 'Fly to London.',
    final: true,
  });
  assert.deepEqual(transcripts.at(-1), {
    type: 'transcript',
    role: 'assistant',
    text: 'Flying to London.',
    final: true,
  });
  assert.deepEqual(events.at(-1), {
    type: 'state',
    state: 'idle',
    detail: 'Call ended',
  });
});

test('a large tool result is cut to what the data channel and model take', () => {
  const big = { ok: true, rows: 'x'.repeat(20000) };
  const payload = toolResultPayload(big);
  assert.equal(payload.truncated, true);
  assert.equal(payload.result.length, 8000);
  assert.deepEqual(toolResultPayload(undefined), { ok: true });
});

test('vesta-voice is used only when its offer URL is configured', () => {
  assert.deepEqual(vestaVoiceOption(undefined), {});
  assert.deepEqual(vestaVoiceOption('  '), {});
  const option = vestaVoiceOption(
    'https://vesta.example/voice-staging/api/offer',
  );
  assert.equal(typeof option.createSession, 'function');
});
