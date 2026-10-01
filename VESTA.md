# vesta recon

A fork of [God's Eye View](https://github.com/bilawalsidhu/gods-eye-view) by Bilawal Sidhu (MIT)
for **vesta**, Hugo's home server: the same live 3D globe, running on vesta's own inference
(Qwen through LiteLLM) and voice (vesta-voice), in the Vesta look. The original README below this
file is upstream's and stays as it is.

## Branches

- `main` mirrors upstream; update it with GitHub's **Sync fork**.
- `vesta` is our work and what runs on vesta at `https://vesta.tail22b555.ts.net:8600`
  (container `gods-eye-view`, compose project `/srv/ai/compose/gods-eye-view`). Upstream updates:
  merge `main` into `vesta`.
- A staging instance comes when it goes live (Hugo, 2026-09-30); until then work lands on `vesta`.

## Deploy on vesta

`deploy/vesta/` holds versioned copies of the wrapper (Dockerfile, entrypoint, compose, `set-key.sh`,
README). The running copies live in `/srv/ai/compose/gods-eye-view/` beside `.env` (provider keys;
never in git; backed up in `~/backups/gods-eye-view-*.tgz`). After a change:

```bash
cd /srv/ai/compose/gods-eye-view && docker compose up -d --build
```

## Configuration added by the fork

| Variable | Meaning |
|---|---|
| `VESTA_LLM_BASE_URL` | vesta's OpenAI-compatible gateway (LiteLLM). When set, the app's text-LLM calls go there instead of OpenAI. |
| `VESTA_LLM_API_KEY` | the gateway key: a LiteLLM virtual key `vesta-recon`, limited to the `default` model |
| `VESTA_LLM_MODEL` | model alias, default `default` (Qwen 27B) |
| `VITE_VESTA_VOICE_OFFER_URL` | vesta-voice's offer URL, read when the page is built; set, the dock's microphone calls vesta-voice instead of OpenAI (now `https://vesta.tail22b555.ts.net/voice-staging/api/offer`) |

## Plan

1. LLM on the box: HUD summaries and typed commands through LiteLLM. **Done 2026-10-01** (below).
2. Voice through vesta-voice: a "globe" profile whose map actions run in this page. **On voice
   staging since 2026-10-01** (below); vesta-voice's production waits for Hugo.
3. The Vesta look and the name, **vesta recon**.

## What the fork adds so far

- **HUD summaries on Qwen.** `server/providers/openai/vesta-llm.js` and a small seam in
  `hud-summary.js`: with `VESTA_LLM_BASE_URL` set, the five-word summary comes from the gateway's
  Chat Completions with thinking off (about 0.3 s); without it, upstream's OpenAI call is unchanged.
- **Ask vesta recon**, a typed command box above the dock (`src/vesta/ask.js`,
  `src/ui/styles/vesta-ask.css`). The page sends the conversation to `POST /api/vesta/agent`
  (`server/providers/openai/vesta-agent.js`): Qwen with the globe's map tools and the voice
  instructions minus the screenshot lines. The tool calls run in the page through the same runner as
  the voice agent. The box keeps clear of the dock, the credits and the HUD readouts.
- **Routing check.** `docker exec gods-eye-view node scripts/vesta-routing-eval.mjs` sends the voice
  QA phrases to the agent: 59 of 62 routed as expected on 2026-09-30, median 1.9 s; the three misses
  need context from an earlier turn.
- **Voice through vesta-voice** (`src/vesta/voiceSession.js`, a session adapter for
  `src/voice/session.js`). With `VITE_VESTA_VOICE_OFFER_URL` set, the dock's microphone calls
  vesta-voice's globe profile with Pipecat's client (`@pipecat-ai/client-js` 1.13.1 and
  `small-webrtc-transport` 1.10.8, as the vesta-voice page; loaded when a call starts). vesta-voice
  fetches the map rules and tools from `GET /api/vesta/voice-brief`
  (`server/providers/openai/vesta-voice-brief.js`), so the page sends no instructions. A map tool
  Qwen calls comes to the page as a `tool-call` message, runs through the same runner as the typed
  box, and goes back as `tool-result`. The ask box shows what voice heard and what Vesta said. Map
  events (drawn outlines) are not sent yet. The microphone is our own (`src/vesta/micMediaManager.js`,
  plain `getUserMedia`; the same file is vesta-voice's `web/mic.js`): the transport's default media
  manager would fetch Daily's call-machine script from `c.daily.co` whenever a call starts.

Server-side notes: `~/vesta-docs/services/gods-eye-view.md` on vesta.

## Rules

- Keys only in the server's `.env`, never in git.
- Changes stay in new files and small seams, so upstream merges stay easy.
- The LICENSE and the credit to Bilawal Sidhu stay.
