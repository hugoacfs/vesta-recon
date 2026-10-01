// vesta recon: "Ask vesta recon", a typed command box. The conversation goes to
// /api/vesta/agent (Qwen on vesta's gateway, with the globe's map tools); tool
// calls run here, through the same runner the voice agent uses.

const MAX_HISTORY = 24;
const MAX_TOOL_CHARS = 8000;
const MAX_STEPS = 6;
const GAP = 8;

/**
 * What the box keeps clear of: the dock and voice control, the Cesium/Google
 * credits (they have to stay readable) and the HUD's bottom readouts. Measured
 * at runtime, like the obstacle lists in src/ui/panelLayoutController.js.
 */
const OBSTACLE_SELECTOR = [
  '#command-dock',
  '#gev-voice-control',
  '#cesium-credits .cesium-widget-credits',
  '#intel-hud .hud-bottom-left',
  '#intel-hud .hud-bottom-right',
  '#intel-hud .hud-bottom-bar',
].join(', ');

/**
 * Keep the conversation short, starting at a user turn so that no tool result
 * or tool call is left without its partner.
 *
 * @param {object[]} history
 * @param {number} [max]
 * @returns {object[]}
 */
export function trimHistory(history, max = MAX_HISTORY) {
  if (history.length <= max) return history;
  let start = history.length - max;
  while (start < history.length && history[start].role !== 'user') start += 1;
  return history.slice(start);
}

/**
 * Run one typed request to completion: ask, run the tools the model calls,
 * send their results back, until the model answers in text.
 *
 * @param {string} text
 * @param {{ history: object[], runner: Function, fetchImpl?: Function, signal?: AbortSignal }} options
 *   `history` is extended in place.
 * @returns {Promise<{ text: string, ran: number }>}
 */
export async function askVestaRecon(
  text,
  { history, runner, fetchImpl = fetch, signal },
) {
  history.push({ role: 'user', content: text });
  let ran = 0;
  for (let step = 0; step < MAX_STEPS; step += 1) {
    const response = await fetchImpl('/api/vesta/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history }),
      signal,
    });
    if (!response.ok)
      throw new Error(`vesta recon agent HTTP ${response.status}`);
    const { message } = await response.json();
    history.push(message);
    const calls = message?.tool_calls || [];
    if (!calls.length) return { text: message?.content || '', ran };
    for (const call of calls) {
      let result;
      try {
        const args = JSON.parse(call.function?.arguments || '{}');
        result = await runner(call.function?.name, args, { signal });
      } catch (error) {
        result = { ok: false, error: String(error?.message || error) };
      }
      ran += 1;
      history.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result ?? { ok: true }).slice(
          0,
          MAX_TOOL_CHARS,
        ),
      });
    }
  }
  return { text: '', ran };
}

/**
 * Where the box's bottom edge goes (viewport pixels from the top): above every
 * obstacle that shares its columns, starting from the lowest.
 *
 * @param {{ left: number, right: number, height: number }} box
 * @param {DOMRect[]} obstacles
 * @param {number} viewportHeight
 * @returns {number}
 */
export function clearBottom(box, obstacles, viewportHeight) {
  let bottom = viewportHeight;
  const inColumns = obstacles
    .filter(
      (rect) =>
        rect.width > 0 &&
        rect.height > 0 &&
        rect.right > box.left &&
        rect.left < box.right,
    )
    .sort((a, b) => b.top - a.top);
  for (const rect of inColumns) {
    if (rect.top < bottom + GAP && rect.bottom > bottom - box.height - GAP)
      bottom = rect.top - GAP;
  }
  return bottom;
}

function shown(element, windowRef) {
  const style = windowRef.getComputedStyle(element);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    Number(style.opacity) !== 0
  );
}

/** Keep the box clear of the dock, the credits and the HUD readouts. */
function keepClear(form, documentRef, windowRef) {
  const input = form.querySelector('.vesta-ask-input');
  const place = () => {
    const { left, right } = form.getBoundingClientRect();
    const obstacles = [...documentRef.querySelectorAll(OBSTACLE_SELECTOR)]
      .filter((element) => shown(element, windowRef))
      .map((element) => element.getBoundingClientRect());
    const bottom = clearBottom(
      { left, right, height: input.offsetHeight },
      obstacles,
      windowRef.innerHeight,
    );
    form.style.setProperty(
      '--vesta-ask-bottom',
      `${Math.round(windowRef.innerHeight - bottom)}px`,
    );
  };
  place();
  windowRef.addEventListener('resize', place);
  // The credits and readouts change as tiles load and the HUD switches; a
  // light re-measure each second keeps up without hooking the app's layout.
  windowRef.setInterval(place, 1000);
}

/**
 * The map runner, whichever voice the page composed: upstream's controller
 * carries it, vesta-voice's session adapter (src/vesta/voiceSession.js) too.
 *
 * @param {Window} windowRef
 * @returns {Function|undefined}
 */
export function voiceRunner(windowRef) {
  const commands = windowRef.__gevVoiceCommands;
  return commands?.runner ?? commands?.session?.adapter?.runner;
}

/** Show in the reply line what voice heard and what she answered. */
function followVoice(reply, windowRef) {
  let followed = null;
  let unsubscribe = null;
  const follow = () => {
    const session = windowRef.__gevVoiceCommands?.session;
    if (typeof session?.subscribe !== 'function' || session === followed)
      return;
    unsubscribe?.();
    followed = session;
    unsubscribe = session.subscribe((event) => {
      if (event?.type !== 'transcript' || !event.final) return;
      const text = String(event.text || '').trim();
      if (text) reply.textContent = event.role === 'user' ? `“${text}”` : text;
    });
  };
  follow();
  // Voice is composed once the globe has started, and again if it restarts.
  windowRef.setInterval(follow, 1000);
}

/**
 * Add the box to the page. The runner is looked up when a request is sent, so
 * the box can appear before the globe has finished starting.
 *
 * @param {{ documentRef?: Document, windowRef?: Window }} [options]
 * @returns {HTMLFormElement|null}
 */
export function mountAskVestaRecon({
  documentRef = document,
  windowRef = window,
} = {}) {
  if (documentRef.getElementById('vesta-ask')) return null;
  const form = documentRef.createElement('form');
  form.id = 'vesta-ask';
  form.className = 'vesta-ask';
  form.setAttribute('autocomplete', 'off');
  // The reply sits above the input, so the input stays put when it appears.
  form.innerHTML = `
    <div class="vesta-ask-reply" role="status" aria-live="polite"></div>
    <input class="vesta-ask-input" type="text" name="q" maxlength="500"
      placeholder="Ask vesta recon…" aria-label="Ask vesta recon" />
    <button class="vesta-ask-send" type="submit" aria-label="Send">↵</button>`;
  documentRef.body.appendChild(form);
  const input = form.querySelector('.vesta-ask-input');
  const reply = form.querySelector('.vesta-ask-reply');
  let history = [];
  let busy = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || busy) return;
    const runner = voiceRunner(windowRef);
    if (typeof runner !== 'function') {
      reply.textContent = 'The globe is still starting…';
      return;
    }
    busy = true;
    form.dataset.state = 'busy';
    reply.textContent = '…';
    input.value = '';
    try {
      history = trimHistory(history);
      const answer = await askVestaRecon(text, { history, runner });
      reply.textContent = answer.text || (answer.ran ? 'Done.' : '');
    } catch {
      reply.textContent = 'vesta recon could not answer just now.';
    } finally {
      busy = false;
      delete form.dataset.state;
    }
  });
  keepClear(form, documentRef, windowRef);
  followVoice(reply, windowRef);
  return form;
}
