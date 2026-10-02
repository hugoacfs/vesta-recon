# Model: Qwen on the box

Upstream calls OpenAI for two text features: the HUD's five-word summary and (in voice) the agent that
drives the map. vesta recon sends its text work to **vesta's LiteLLM gateway** instead, where `default`
is Qwen 27B on the RTX 3090.

## The gateway

| Variable (server `.env`) | Meaning |
|---|---|
| `VESTA_LLM_BASE_URL` | the OpenAI-compatible gateway, `http://192.168.0.2:4000/v1` (reachable from the container) |
| `VESTA_LLM_API_KEY` | a LiteLLM virtual key named `vesta-recon`, limited to the `default` model and 4 requests at a time, so a leak could not reach the cloud models |
| `VESTA_LLM_MODEL` | the model alias, `default` |

`server/providers/openai/vesta-llm.js` reads them (`vestaLlmConfig`, `null` when no base URL is set) and
builds the requests. Every request is **Chat Completions with `chat_template_kwargs.enable_thinking:
false`**: the gateway's Responses route cannot switch Qwen's thinking off, and there a one-line answer
spent 860 reasoning tokens and 8 s, past the page's 5 s limit. With thinking off a summary takes about
0.3 s.

Without `VESTA_LLM_BASE_URL` both features fall back to upstream's OpenAI code, unchanged.

## HUD summaries

`server/providers/openai/hud-summary.js` (upstream's route, `POST /api/openai/hud-summary`) has one seam:
with the gateway configured it sends upstream's own summary instructions and the HUD context to Qwen
(`max_tokens` 60) and reads the answer with `vestaChatText`; the five-word shaping
(`toFiveWordHudSummary`) and the page's fallback line are upstream's. Example: "Dover vessels feed
stale".

## The typed agent: "Ask vesta recon"

A box above the dock. The conversation stays in the page; each turn is one or more calls to the server,
which asks Qwen and returns its message; the page runs any tool calls itself and sends the results back
until Qwen answers in words.

**Server**, `server/providers/openai/vesta-agent.js`, `POST /api/vesta/agent`:

| | |
|---|---|
| Request | `{"messages": [...]}`, at most 512 KB; only the shapes this loop produces are accepted: user text, assistant text with tool calls (at most 16), tool results; at most 60 messages of at most 16,000 characters |
| Prompt | a short preface for a typed session, then upstream's voice instructions (`server/providers/openai/instructions.js`) without the lines about viewport screenshots (a text model cannot see) |
| Tools | upstream's 30 map tools in Chat Completions shape, `tool_choice: auto`, `max_tokens` 800, thinking off, a 60 s limit |
| Answer | `{"message": {"role": "assistant", "content", "tool_calls"?}}` |
| Errors | 405 not a POST; 503 no gateway configured; 400 a conversation it does not accept; 502 the gateway failed (its own error text is never passed on) |
| Rate limit | upstream's opt-in limiter for its OpenAI routes (`GEV_RATELIMIT_OPENAI_PER_MIN`) |

**Page**, `src/vesta/ask.js` (styles in `src/ui/styles/vesta-ask.css`):

- the loop: up to 6 rounds per request; each tool call goes through the map runner
  (`window.__gevVoiceCommands`, upstream's controller or vesta-voice's session); a failing tool becomes
  `{ok: false, error}`; a result is cut at 8,000 characters; the history is trimmed to 24 messages,
  always starting at a user turn;
- the reply line shows the answer, "Done." when only tools ran, "vesta recon could not answer just
  now." on an error; it also shows what voice heard and what Vesta said during a call;
- placement: centred above the dock, and raised above anything sharing its columns (the dock and voice
  control, the map credits, which must stay readable, and the HUD's bottom readouts), measured again
  every second as tiles load and panels change; hidden in clean view and while recording.

The typed agent has the map tools only; memory and web search are on voice calls, and on the
draft below.

## Draft: the box through Vesta

Hugo, 2026-10-02: the box should reach the same Vesta as a voice call, memory and web search included
("Do option 2 as a draft for now - I want to see no regressions affecting vesta voice you know, you can
have staging"). With `VITE_VESTA_TEXT_OFFER_URL` set (vesta-voice **staging**,
`https://vesta.tail22b555.ts.net/voice-staging/api/offer`) and **`?vesta-text` in the address**
(`https://vesta.tail22b555.ts.net:8600/?vesta-text`), the box says "Ask Vesta… (draft: through
vesta-voice)" and `src/vesta/textSession.js` replaces its own agent:

- a text-only globe call to vesta-voice, `requestData: {"profile": "globe", "text": true}`: no
  microphone (never asked for), nothing spoken;
- each question goes as `send-text` with `audio_response: false`; her reply shows as it streams
  (`bot-llm-text`);
- her map tools come as `tool-call` messages and run here, as on a voice call; memory and web search run
  on the service;
- a turn ends once the model has stopped and nothing follows for 1.8 s (a tool call can be announced just
  after a reply ends, and the follow-through net runs the model again 1.5 s after a reply that promised an
  action without one);
- the call opens when the box is focused, so the long globe prompt is read while Hugo types, and it
  stays open between questions (she keeps the conversation), opened again if it ended.

Measured 2026-10-02 in a browser: "Fly to Paris." flew there and answered in 5.4 s; a memory question
answered in 6.8 s; no microphone request. On staging the memory is the staging memory server. Without
the flag the box is the map-only agent above, unchanged.

## The routing check

`scripts/vesta-routing-eval.mjs` sends each of upstream's 62 voice QA phrases
(`scripts/qa-voice-routing.mjs`) to the typed agent as a one-message conversation and checks the tools
of the first answer (nothing is executed):

```bash
docker exec gods-eye-view node scripts/vesta-routing-eval.mjs                 # all phrases
docker exec gods-eye-view node scripts/vesta-routing-eval.mjs --only 10       # the first ten
```

2026-09-30: **59 of 62** routed as expected, median 1.9 s, the first call about 10 s (the long prompt
not yet cached by the model server). The three misses ask to track, to follow, and to "fly the route we
just drew": they refer to an earlier turn, which a one-message test does not have.
