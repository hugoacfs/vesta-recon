// vesta recon: the typed "Ask vesta recon" agent. The page posts the
// conversation; this asks vesta's gateway (Qwen, thinking off) with the globe's
// instructions and its map tools, and returns the assistant message. The page
// runs any tool calls itself, through the same runner the voice agent uses, and
// posts the results back for the next turn.
import { enforceOptInRateLimit, openAiRateLimiter } from './rate-limit.js';
import { readRequestBody } from '../common/request.js';
import { realtimeInstructions } from './instructions.js';
import { GEV_REALTIME_TOOLS } from './tools.js';
import { vestaLlmConfig } from './vesta-llm.js';

const MAX_MESSAGES = 60;
const MAX_CONTENT_CHARS = 16000;
const UPSTREAM_TIMEOUT_MS = 60000;

/**
 * The voice agent's instructions, for a typed session on a text-only model:
 * the lines about viewport screenshots are dropped (the model cannot see).
 *
 * @returns {string}
 */
export function vestaAgentInstructions() {
  return [
    'This is a TYPED session on vesta recon: the user types, you act through the tools exactly as in a voice session, and you answer in one or two short plain sentences.',
    ...realtimeInstructions()
      .split('\n')
      .filter((line) => !/screenshot/i.test(line)),
  ].join('\n');
}

/** The globe's map tools in the Chat Completions shape. */
export const VESTA_AGENT_TOOLS = Object.freeze(
  GEV_REALTIME_TOOLS.map(({ name, description, parameters }) => ({
    type: 'function',
    function: { name, description, parameters },
  })),
);

function isText(value, max = MAX_CONTENT_CHARS) {
  return typeof value === 'string' && value.length <= max;
}

/**
 * Accept only the message shapes this loop produces: user text, assistant text
 * and tool calls, and tool results.
 *
 * @param {unknown} value
 * @returns {object[]|null}
 */
export function sanitizeAgentMessages(value) {
  if (!Array.isArray(value) || !value.length || value.length > MAX_MESSAGES)
    return null;
  const out = [];
  for (const message of value) {
    if (!message || typeof message !== 'object') return null;
    if (message.role === 'user' && isText(message.content)) {
      out.push({ role: 'user', content: message.content });
    } else if (message.role === 'tool') {
      if (!isText(message.tool_call_id, 200) || !isText(message.content))
        return null;
      out.push({
        role: 'tool',
        tool_call_id: message.tool_call_id,
        content: message.content,
      });
    } else if (message.role === 'assistant') {
      const content = message.content ?? '';
      if (!isText(content)) return null;
      const calls = message.tool_calls;
      if (calls !== undefined && (!Array.isArray(calls) || calls.length > 16))
        return null;
      const toolCalls = (calls || []).map((call) => ({
        id: call?.id,
        type: 'function',
        function: {
          name: call?.function?.name,
          arguments: call?.function?.arguments ?? '{}',
        },
      }));
      if (
        toolCalls.some(
          (call) =>
            !isText(call.id, 200) ||
            !isText(call.function.name, 100) ||
            !isText(call.function.arguments),
        )
      )
        return null;
      out.push(
        toolCalls.length
          ? { role: 'assistant', content, tool_calls: toolCalls }
          : { role: 'assistant', content },
      );
    } else {
      return null;
    }
  }
  return out;
}

function send(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

async function handleVestaAgent(req, res) {
  if (req.method !== 'POST') {
    send(res, 405, { error: 'Method not allowed' });
    return;
  }
  const vesta = vestaLlmConfig();
  if (!vesta) {
    send(res, 503, { error: 'The vesta gateway is not configured' });
    return;
  }
  if (!enforceOptInRateLimit(openAiRateLimiter(), req, res)) return;

  let messages = null;
  try {
    const body = await readRequestBody(req, 512 * 1024);
    messages = sanitizeAgentMessages(JSON.parse(body || '{}').messages);
  } catch {
    messages = null;
  }
  if (!messages) {
    send(res, 400, { error: 'Invalid conversation' });
    return;
  }

  try {
    const response = await fetch(`${vesta.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${vesta.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: vesta.model,
        messages: [
          { role: 'system', content: vestaAgentInstructions() },
          ...messages,
        ],
        tools: VESTA_AGENT_TOOLS,
        tool_choice: 'auto',
        max_tokens: 800,
        chat_template_kwargs: { enable_thinking: false },
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const data = await response.json().catch(() => ({}));
    const message = data?.choices?.[0]?.message;
    if (!response.ok || !message) {
      console.warn(`[vesta-agent] upstream HTTP ${response.status}`);
      // Never relay the gateway's own error text.
      send(res, 502, { error: 'vesta recon agent request failed' });
      return;
    }
    const toolCalls = Array.isArray(message.tool_calls)
      ? message.tool_calls.map((call) => ({
          id: call.id,
          type: 'function',
          function: {
            name: call.function?.name,
            arguments: call.function?.arguments ?? '{}',
          },
        }))
      : [];
    send(res, 200, {
      message: toolCalls.length
        ? {
            role: 'assistant',
            content: message.content ?? '',
            tool_calls: toolCalls,
          }
        : { role: 'assistant', content: message.content ?? '' },
    });
  } catch {
    console.warn('[vesta-agent] request failed');
    send(res, 502, { error: 'vesta recon agent request failed' });
  }
}

export { handleVestaAgent };
