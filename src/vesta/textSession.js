// vesta recon: the typed box through Vesta (a draft, 2026-10-02). A text-only
// call to vesta-voice's globe profile (`"text": true`): no microphone and
// nothing spoken, Vesta's replies come back as text, her map tools run here and
// her memory and web search on the service, so typing reaches the same Vesta as
// a voice call. The call stays open between questions, so she keeps the
// conversation; it is opened again if the service ended it.
import { micTransport } from './micMediaManager.js';

const CONNECT_TIMEOUT_MS = 25000;
const TURN_TIMEOUT_MS = 90000;
// A reply is complete once the model has stopped and nothing follows for this
// long: a tool call can be announced just after a reply ends, and vesta-voice's
// follow-through net runs the model again 1.5 s after a reply that promised an
// action without one.
const SETTLE_MS = 1800;
const MAX_RESULT_CHARS = 8000;

async function pipecatTextClient(options) {
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

function resultPayload(result) {
  const text = JSON.stringify(result ?? { ok: true });
  return text.length <= MAX_RESULT_CHARS
    ? JSON.parse(text)
    : { truncated: true, result: text.slice(0, MAX_RESULT_CHARS) };
}

/**
 * Whether the draft is on for this page: configured, and asked for with
 * `?vesta-text` in the address.
 *
 * @param {Window} windowRef
 * @param {string|undefined} offerUrl
 */
export function vestaTextDraft(windowRef, offerUrl) {
  if (typeof offerUrl !== 'string' || !offerUrl.trim()) return false;
  try {
    return new URLSearchParams(windowRef.location?.search || '').has(
      'vesta-text',
    );
  } catch {
    return false;
  }
}

/**
 * @param {object} options
 * @param {string} options.offerUrl vesta-voice's /api/offer
 * @param {Function} options.runner runs one map action: (name, args, { signal }) => result
 */
export function createVestaTextSession({
  offerUrl,
  runner,
  createClient = pipecatTextClient,
  settleMs = SETTLE_MS,
  turnTimeoutMs = TURN_TIMEOUT_MS,
  connectTimeoutMs = CONNECT_TIMEOUT_MS,
}) {
  let client = null;
  let connecting = null;
  let ready = null;
  let turn = null;

  function end(outcome) {
    const current = turn;
    if (!current) return;
    turn = null;
    clearTimeout(current.settle);
    clearTimeout(current.deadline);
    if (outcome instanceof Error) current.reject(outcome);
    else current.resolve(outcome);
  }

  function settleLater() {
    clearTimeout(turn.settle);
    turn.settle = setTimeout(
      () => end({ text: turn?.text ?? '', ran: turn?.ran ?? 0 }),
      settleMs,
    );
  }

  async function runToolCall(call, from) {
    let result;
    try {
      result = await runner(
        call.name,
        call.args && typeof call.args === 'object' ? call.args : {},
        {},
      );
    } catch (error) {
      result = { ok: false, error: String(error?.message || error) };
    }
    if (turn) turn.ran += 1;
    if (client !== from) return; // the call ended meanwhile
    try {
      from.sendClientMessage('tool-result', {
        id: call.id,
        result: resultPayload(result),
      });
    } catch {
      /* the call is closing */
    }
  }

  function callbacks(own) {
    return {
      onBotReady: () => own.markReady?.(),
      onBotLlmStarted: () => {
        if (!turn) return;
        clearTimeout(turn.settle);
        turn.run = '';
        turn.waiting = false;
      },
      onBotLlmText: (data) => {
        if (!turn) return;
        turn.run += String(data?.text ?? '');
        if (turn.run.trim()) {
          turn.text = turn.run.trim();
          turn.onText?.(turn.text);
        }
      },
      onLLMFunctionCallStarted: () => {
        if (!turn) return;
        turn.waiting = true; // the model carries on once the tool has answered
        clearTimeout(turn.settle);
      },
      onBotLlmStopped: () => {
        if (turn && !turn.waiting && turn.run.trim()) settleLater();
      },
      onServerMessage: (data) => {
        if (client !== own.client) return;
        if (data?.type === 'tool-call' && typeof data.name === 'string') {
          if (turn) {
            turn.waiting = true;
            clearTimeout(turn.settle);
          }
          void runToolCall(data, own.client);
        } else if (data?.type === 'brain' && data.state === 'down') {
          end(new Error('vesta is not answering'));
        }
      },
      onDisconnected: () => {
        if (own.client && client === own.client) client = null;
        end(new Error('the call ended'));
      },
    };
  }

  async function connect() {
    if (client) return client;
    if (!connecting) {
      connecting = (async () => {
        const own = { client: null };
        ready = new Promise((resolve) => (own.markReady = resolve));
        own.client = await createClient({
          enableMic: false,
          enableCam: false,
          callbacks: callbacks(own),
        });
        let timer;
        const limit = new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('vesta did not answer in time')),
            connectTimeoutMs,
          );
        });
        try {
          await Promise.race([
            (async () => {
              await own.client.connect({
                webrtcRequestParams: {
                  endpoint: offerUrl,
                  requestData: { profile: 'globe', text: true },
                },
              });
              await ready;
            })(),
            limit,
          ]);
        } catch (error) {
          void Promise.resolve(own.client.disconnect?.()).catch(() => {});
          throw error;
        } finally {
          clearTimeout(timer);
        }
        client = own.client;
        return client;
      })().finally(() => {
        connecting = null;
      });
    }
    return connecting;
  }

  return {
    /**
     * One typed turn. `onText` sees her reply as it comes in.
     * @returns {Promise<{ text: string, ran: number }>}
     */
    async ask(text, { onText } = {}) {
      if (turn) throw new Error('a question is already on its way');
      const own = await connect();
      return new Promise((resolve, reject) => {
        turn = {
          run: '',
          text: '',
          ran: 0,
          waiting: false,
          onText,
          resolve,
          reject,
          settle: null,
        };
        turn.deadline = setTimeout(
          () =>
            turn?.text
              ? end({ text: turn.text, ran: turn.ran })
              : end(new Error('no answer in time')),
          turnTimeoutMs,
        );
        Promise.resolve(
          own.sendText(String(text), {
            run_immediately: true,
            audio_response: false,
          }),
        ).catch((error) =>
          end(error instanceof Error ? error : new Error(String(error))),
        );
      });
    },
    /**
     * Open the call ahead of the first question: vesta-voice starts reading
     * the long globe prompt as a call begins, so opening it while Hugo types
     * spares the first answer that wait (about 12 s when the model server
     * has let the prompt go).
     * @returns {Promise<boolean>}
     */
    prepare() {
      return connect().then(
        () => true,
        () => false,
      );
    },
    get connected() {
      return Boolean(client);
    },
    close() {
      const own = client;
      client = null;
      end(new Error('closed'));
      if (own) void Promise.resolve(own.disconnect()).catch(() => {});
    },
  };
}
