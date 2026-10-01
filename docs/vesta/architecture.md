# Architecture

vesta recon is upstream's app with a few seams. Upstream is a Vite app: the Cesium globe, its panels
and HUD run in the browser; `vite preview` serves the built page and, through API middlewares in
`server/providers/`, calls the data providers server-side (flights, ships, fires, traffic, cameras).
The fork adds four things, each in its own files: Qwen for text, Vesta's voice, the Vesta look, and a
microphone without third-party code.

## The picture

```
 browser: the vesta recon page                         vesta (the box)
 ──────────────────────────────                        ──────────────────────────────────────────────
 globe · panels · HUD · dock ──── HTTPS :8600 ──────▶  gods-eye-view container, 127.0.0.1:8096
   │                              (Tailscale Serve)       vite preview + upstream's provider middlewares
   │  POST /api/openai/hud-summary ───────────────▶       hud-summary.js ─┐
   │  POST /api/vesta/agent  (the typed box) ─────▶       vesta-agent.js ─┼─▶ LiteLLM :4000 ─▶ Qwen 27B
   │                                                      GET /api/vesta/voice-brief ◀─┐    (vLLM, RTX 3090)
   │                                                                                   │ loopback
   │  WebRTC: the call (audio both ways + a data channel) ──────────────────────▶  vesta-voice (production)
   │        ◀── tool-call {id, name, args}                                        Qwen3-ASR, Pocket TTS
   │        ── tool-result {id, result} ──▶                                       (RTX 3060); Qwen via
   ▼                                                                              LiteLLM; memory, search
 the map runner: upstream's 30 map actions, run in the page
```

## The map runner: one way to drive the globe

Upstream's voice agent drives the globe through 30 map actions (fly to a place, show a layer, follow an
aircraft, move the camera, annotate, answer questions about what is loaded…). Their argument schemas
are `src/voice/actionSchemas.js`; `src/voice/gevActions.js` runs them in the page
(`createGevActionRunner`). Every agent in vesta recon goes through that same runner:

- upstream's OpenAI voice (still in the code, used when no vesta-voice URL is configured);
- the typed box (`src/vesta/ask.js`);
- Vesta's voice (`src/vesta/voiceSession.js`).

The model-facing wording of the 30 tools and the voice instructions are upstream's
(`server/providers/openai/toolDescriptions.js`, `instructions.js`); the fork reuses them rather than
rewriting them, so new upstream tools reach vesta recon's agents without work here.

## Qwen for text

Two server routes call vesta's LiteLLM gateway with a LiteLLM virtual key that only reaches the
`default` model (Qwen 27B), always as Chat Completions with thinking off. The HUD summary is
upstream's route with a small seam; the typed agent is a new route that returns the model's message,
and the page runs the tool calls itself and loops. → [model.md](model.md)

## Vesta's voice

With `VITE_VESTA_VOICE_OFFER_URL` set when the page is built, the dock's microphone opens a WebRTC call
to vesta-voice and says it is the globe. vesta-voice fetches the map rules and tools from this app's
server, gives the model those plus the clock, memory and web search, and sends each map tool the model
calls back to the page over the call's data channel; the page runs it and answers. Vesta speaks, the
globe moves. → [voice.md](voice.md)

## The Vesta look

The name and the hearth are in the page templates; the colours come from a PostCSS step at build time
that recolours upstream's stylesheets without editing them; the fonts are self-hosted. → [look.md](look.md)

## Where each piece lives

| Piece | Files |
|---|---|
| Gateway config and HUD summaries | `server/providers/openai/vesta-llm.js`, the seam in `server/providers/openai/hud-summary.js` |
| Typed agent (server) | `server/providers/openai/vesta-agent.js`, route in `server/providers/openai.js` |
| Typed box (page) | `src/vesta/ask.js`, `src/ui/styles/vesta-ask.css`, mounted in `src/main.js` |
| Voice brief (server) | `server/providers/openai/vesta-voice-brief.js`, route in `server/providers/openai.js` |
| Voice adapter (page) | `src/vesta/voiceSession.js`, wired in `src/main.js` |
| Microphone | `src/vesta/micMediaManager.js` (the same file is vesta-voice's `web/mic.js`) |
| Voice service | the `hugoacfs/vesta-voice` repository: `brains/globe.py`, `brains/globe.md`, `app.py` |
| Name and hearth | `index.html`, `src/ui/templates/scene-chrome.html`, `hud-loading.html`, `src/vesta/brand.js`, `public/vesta/hearth.svg` |
| Palette | `postcss.config.js`, `build/vesta-palette.mjs`, `src/ui/styles/vesta-theme.css` |
| Fonts | `public/vesta/fonts/`, `src/ui/styles/vesta-fonts.css`, `scripts/vesta-fonts.py` |
| Canvas and HUD colours | `src/overlays/worldOverlayTokens.js`, `src/hud.js` |
| Checks | `src/tooling/vesta*.test.mjs`, `src/vesta/*.test.mjs`, `scripts/vesta-routing-eval.mjs`, `scripts/vesta-shoot.mjs` |
| Deployment (versioned copies) | `deploy/vesta/` |

New server modules are listed in `scripts/package-boundaries.json` (the `openai-provider` package), so
upstream's boundary checks cover them.
