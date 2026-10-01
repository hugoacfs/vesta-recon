// vesta recon: voice through vesta-voice. A session adapter (the contract is
// src/voice/session.js) that calls vesta-voice's globe profile over WebRTC with
// Pipecat's browser client. The map tools the model calls arrive as server
// messages ("tool-call"), run here through the session's runAction, and go back
// as client messages ("tool-result"). The prompt and the tools are fetched by
// vesta-voice from this app's server; the page only says it is the globe. The
// microphone is our own (micMediaManager.js), so no Daily script is fetched.
import { micTransport } from './micMediaManager.js';

const CONNECT_TIMEOUT_MS = 25000;
const MAX_RESULT_CHARS = 8000;
// 24 kHz, 8 samples of silence: played inside the click, so that her reply may
// play later (Safari and iOS only allow audio that a gesture started).
const SILENCE =
  'data:audio/wav;base64,UklGRjQAAABXQVZFZm10IBAAAAABAAEAwF0AAIC7AAACABAAZGF0YRAAAAAAAAAAAAAAAAAAAAAAAAAA';

/**
 * The application's voice option: vesta-voice when its offer URL is set
 * (VITE_VESTA_VOICE_OFFER_URL when the page is built), upstream's own voice
 * otherwise.
 *
 * @param {string|undefined} offerUrl
 * @returns {{ createSession?: Function }}
 */
export function vestaVoiceOption(offerUrl) {
  const url = typeof offerUrl === 'string' ? offerUrl.trim() : '';
  if (!url) return {};
  return {
    createSession: (hooks) =>
      createVestaVoiceSession({ ...hooks, offerUrl: url }),
  };
}

/** A tool result small enough for the data channel and the model. */
export function toolResultPayload(result) {
  const text = JSON.stringify(result ?? { ok: true });
  return text.length <= MAX_RESULT_CHARS
    ? JSON.parse(text)
    : { truncated: true, result: text.slice(0, MAX_RESULT_CHARS) };
}

// Pipecat's client is loaded when a call starts, not with the page.
async function pipecatClient(options) {
  const [{ PipecatClient }, { SmallWebRTCTransport }] = await Promise.all([
    import('@pipecat-ai/client-js'),
    import('@pipecat-ai/small-webrtc-transport'),
  ]);
  return new PipecatClient({
    ...options,
    transport: micTransport(SmallWebRTCTransport, {
      waitForICEGathering: true,
    }),
  });
}

function withTimeout(promise, ms, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * @param {object} options
 * @param {Function} options.emit session events (state, transcript)
 * @param {Function} options.runAction runs one map action
 * @param {Function} options.runner the plain action runner, kept for the typed box
 * @param {string} options.offerUrl vesta-voice's /api/offer
 */
export function createVestaVoiceSession({
  emit,
  runAction,
  runner,
  offerUrl,
  createClient = pipecatClient,
  documentRef = document,
}) {
  let client = null;
  let audio = null;
  let live = false;
  let running = 0;
  let spoken = '';
  let attempts = 0;

  const state = (name, detail) => emit({ type: 'state', state: name, detail });
  const listening = (detail = 'Ask or command') => {
    if (live && !running) state('listening', detail);
  };

  function player() {
    if (!audio) {
      audio = documentRef.createElement('audio');
      audio.autoplay = true;
      audio.hidden = true;
      audio.dataset.vestaVoiceAudio = 'true';
      documentRef.body.appendChild(audio);
    }
    return audio;
  }

  async function runToolCall(call, from) {
    running += 1;
    state('executing', 'Running command');
    let result;
    try {
      result = await runAction(
        call.name,
        call.args && typeof call.args === 'object' ? call.args : {},
      );
    } catch (error) {
      result = { ok: false, error: String(error?.message || error) };
    } finally {
      running -= 1;
    }
    // A call that ended meanwhile has nobody waiting for the answer.
    if (client !== from) return;
    try {
      from.sendClientMessage('tool-result', {
        id: call.id,
        result: toolResultPayload(result),
      });
    } catch {
      /* the call is closing */
    }
    listening();
  }

  // `own.client` is this call's client once it exists; a callback from an
  // older call (one that was stopped) finds it is no longer the current one.
  function callbacks(own) {
    return {
      onBotReady: () => {
        if (client !== own.client) return;
        live = true;
        listening();
      },
      onTrackStarted: (track, participant) => {
        if (track?.kind !== 'audio' || participant?.local) return;
        if (own.client?.tracks?.()?.local?.audio === track) return; // our own microphone
        const el = player();
        el.removeAttribute('src');
        el.srcObject = new MediaStream([track]);
        el.play().catch(() => {
          /* blocked until the next click */
        });
      },
      onUserStartedSpeaking: () => listening('Hearing you'),
      onUserStoppedSpeaking: () => listening('Thinking'),
      onBotStartedSpeaking: () => {
        spoken = '';
        listening('Vesta is speaking');
      },
      onBotTtsText: (data) => {
        const text = String(data?.text || '').trim();
        if (!text) return;
        spoken = spoken ? `${spoken} ${text}` : text;
        emit({ type: 'transcript', role: 'assistant', text, final: false });
      },
      onBotStoppedSpeaking: () => {
        if (spoken)
          emit({
            type: 'transcript',
            role: 'assistant',
            text: spoken,
            final: true,
          });
        spoken = '';
        listening();
      },
      onServerMessage: (data) => {
        if (client !== own.client) return;
        if (data?.type === 'tool-call' && typeof data.name === 'string') {
          void runToolCall(data, own.client);
        } else if (data?.type === 'heard' && data.final) {
          emit({
            type: 'transcript',
            role: 'user',
            text: String(data.text || ''),
            final: true,
          });
        } else if (data?.type === 'brain') {
          if (data.state === 'retrying') listening('Brain restarting');
          else if (data.state === 'down') listening('Brain not answering');
          else listening();
        }
      },
      onDisconnected: () => {
        // The service ended the call (idle, restart): back to off.
        if (!own.client || client !== own.client) return;
        client = null;
        live = false;
        state('idle', 'Call ended');
      },
    };
  }

  return {
    runner,
    capabilities: { costControls: false, pushToTalk: false },
    async start() {
      const el = player();
      el.srcObject = null;
      el.src = SILENCE;
      el.play().catch(() => {
        /* the reply's own play() tries again */
      });
      state('connecting', 'Calling vesta');
      const attempt = ++attempts;
      const own = { client: null };
      await withTimeout(
        (async () => {
          const created = await createClient({
            enableMic: true,
            enableCam: false,
            callbacks: callbacks(own),
          });
          if (attempt !== attempts) {
            // Stopped while the client library was loading.
            void Promise.resolve(created.disconnect?.()).catch(() => {});
            throw new Error('Voice stopped');
          }
          own.client = created;
          client = created;
          await own.client.initDevices();
          await own.client.connect({
            webrtcRequestParams: {
              endpoint: offerUrl,
              requestData: { profile: 'globe' },
            },
          });
        })(),
        CONNECT_TIMEOUT_MS,
        'vesta voice did not answer in 25 s',
      );
      if (client === own.client && !live) {
        live = true;
        listening();
      }
    },
    stop({ removeUi } = {}) {
      attempts += 1;
      const own = client;
      client = null;
      live = false;
      spoken = '';
      if (own) void Promise.resolve(own.disconnect()).catch(() => {});
      if (audio) {
        audio.pause();
        audio.srcObject = null;
        audio.removeAttribute('src');
        if (removeUi) {
          audio.remove();
          audio = null;
        }
      }
    },
    sendText(text) {
      if (!live || !client) return false;
      void Promise.resolve(client.sendText(String(text))).catch(() => {});
      return true;
    },
    // Upstream adds map events (drawn outlines) to the conversation. A note in
    // the middle of a tool round would break the conversation on vesta-voice,
    // so they are not sent for now.
    sendMapEvent: () => false,
  };
}
