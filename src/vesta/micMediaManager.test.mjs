import assert from 'node:assert/strict';
import test from 'node:test';
import { MicMediaManager, micTransport } from './micMediaManager.js';

function fakeTrack(deviceId) {
  return {
    kind: 'audio',
    label: `mic ${deviceId}`,
    enabled: true,
    stopped: false,
    stop() {
      this.stopped = true;
    },
    getSettings: () => ({ deviceId, groupId: 'g' }),
    addEventListener() {},
  };
}

function fakeDevices({ deny = false, missing = [] } = {}) {
  const asked = [];
  return {
    asked,
    listeners: 0,
    async getUserMedia(constraints) {
      asked.push(constraints);
      if (deny)
        throw Object.assign(new Error('Permission denied'), {
          name: 'NotAllowedError',
        });
      const wanted = constraints.audio.deviceId?.exact ?? 'default';
      if (missing.includes(wanted))
        throw Object.assign(new Error('gone'), {
          name: 'OverconstrainedError',
        });
      const track = fakeTrack(wanted);
      return { getAudioTracks: () => [track], getTracks: () => [track] };
    },
    async enumerateDevices() {
      return [
        { kind: 'audioinput', deviceId: 'default', label: 'Built-in' },
        { kind: 'audioinput', deviceId: 'airpods', label: 'AirPods' },
        { kind: 'audiooutput', deviceId: 'default', label: 'Speakers' },
        { kind: 'videoinput', deviceId: 'cam', label: 'Camera' },
      ];
    },
    addEventListener() {
      this.listeners += 1;
    },
    removeEventListener() {
      this.listeners -= 1;
    },
  };
}

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
    map,
  };
}

function manager(options = {}) {
  const events = [];
  const replaced = [];
  const devices = fakeDevices(options);
  const storage = memoryStorage(options.stored);
  const mic = new MicMediaManager({
    mediaDevices: devices,
    storage,
    onTrackReplaced: async (track) => replaced.push(track),
  });
  const record = (name) => (arg) => events.push([name, arg]);
  mic.setClientOptions({
    enableMic: true,
    callbacks: {
      onMicUpdated: record('mic'),
      onTrackStarted: record('started'),
      onTrackStopped: record('stopped'),
      onDeviceError: record('error'),
      onAvailableMicsUpdated: record('mics'),
      onAvailableCamsUpdated: record('cams'),
    },
  });
  return { mic, events, replaced, devices, storage };
}

test('the microphone opens with the browser’s own voice processing, and no camera', async () => {
  const { mic, events, devices } = manager();
  await mic.initialize();
  await mic.connect();
  assert.deepEqual(devices.asked[0], {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });
  assert.equal(mic.tracks().local.audio.label, 'mic default');
  assert.equal(mic.tracks().local.video, undefined);
  assert.equal(mic.selectedMic.deviceId, 'default');
  assert.deepEqual(
    events.find(([name]) => name === 'mics')[1].map((d) => d.deviceId),
    ['default', 'airpods'],
  );
  assert.deepEqual(events.find(([name]) => name === 'cams')[1], []);
  assert.equal(mic.supportsScreenShare, false);
  assert.equal(mic.isCamEnabled, false);
});

test('a refused microphone is reported and the call can still go ahead', async () => {
  const { mic, events } = manager({ deny: true });
  await mic.initialize();
  await mic.connect();
  const error = events.find(([name]) => name === 'error')[1];
  assert.equal(error.type, 'permissions');
  assert.deepEqual(error.devices, ['mic']);
  assert.equal(mic.tracks().local.audio, undefined);
});

test('a remembered microphone that is gone gives way to the default one', async () => {
  const { mic, devices } = manager({
    stored: { 'vesta.voice.mic': 'usb' },
    missing: ['usb'],
  });
  await mic.initialize();
  assert.equal(devices.asked[0].audio.deviceId.exact, 'usb');
  assert.equal(devices.asked[1].audio.deviceId, undefined);
  assert.equal(mic.tracks().local.audio.label, 'mic default');
});

test('switching microphones in a call replaces the track being sent', async () => {
  const { mic, replaced, storage, events } = manager();
  await mic.initialize();
  await mic.connect();
  const first = mic.tracks().local.audio;
  mic.updateMic('airpods');
  await new Promise((resolve) => setTimeout(resolve, 0));
  const second = mic.tracks().local.audio;
  assert.equal(second.label, 'mic airpods');
  assert.deepEqual(replaced, [second]);
  assert.equal(first.stopped, true);
  assert.equal(storage.map.get('vesta.voice.mic'), 'airpods');
  assert.ok(
    events.some(([name, track]) => name === 'stopped' && track === first),
  );
});

test('mute keeps the track and silences it', async () => {
  const { mic } = manager();
  await mic.initialize();
  await mic.enableMic(false);
  assert.equal(mic.isMicEnabled, false);
  assert.equal(mic.tracks().local.audio.enabled, false);
  await mic.enableMic(true);
  assert.equal(mic.tracks().local.audio.enabled, true);
});

test('ending the call stops the microphone and drops an answer that comes late', async () => {
  const { mic, devices } = manager();
  await mic.initialize();
  const track = mic.tracks().local.audio;
  const late = mic._openMic(null);
  await mic.disconnect();
  assert.equal(track.stopped, true);
  assert.equal(await late, null);
  assert.equal(mic.tracks().local.audio, undefined);
  assert.equal(devices.listeners, 0);
});

test('the transport is built on this microphone and swaps its sender’s track', async () => {
  const sent = [];
  class FakeTransport {
    constructor(options) {
      this.options = options;
      this.pc = {};
    }
    getAudioTransceiver() {
      return { sender: { replaceTrack: async (track) => sent.push(track) } };
    }
  }
  const transport = micTransport(FakeTransport, { waitForICEGathering: true });
  assert.equal(transport.options.waitForICEGathering, true);
  assert.ok(transport.options.mediaManager instanceof MicMediaManager);
  const track = fakeTrack('airpods');
  await transport.options.mediaManager._onTrackReplaced(track);
  assert.deepEqual(sent, [track]);
});
