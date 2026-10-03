# Upstream: taking God's Eye View updates

`main` mirrors `bilawalsidhu/gods-eye-view`; the fork is worked on in `staging`, and `vesta` is
production. Upstream moves fast, so the fork keeps
its changes in new files and small seams. This page lists every upstream file the fork touches and what
to do when a merge meets it.

## How

1. Bring `main` up to date: GitHub's **Sync fork** on `hugoacfs/vesta-recon`, or in a checkout
   `git fetch upstream && git push origin upstream/main:main`.
2. On vesta, in the staging checkout `/srv/ai/compose/gods-eye-view-staging/app` on branch
   `staging`: `git fetch origin && git merge origin/main`.
3. Resolve conflicts with the table below; keep both sides wherever both added something.
4. If `package-lock.json` changed: rebuild the image (`docker compose build`) before the checks.
5. Run the checks ([operations.md](operations.md)), take screenshots (`scripts/vesta-shoot.mjs`), make
   a voice call and a typed command on staging (`:8601`), run the routing check if upstream changed its
   voice instructions or tools.
6. Deploy staging and push `staging`.
7. On Hugo's word, production: `staging` into `vesta` ([operations.md](operations.md#deploy-a-change)).

## Upstream files the fork changes

| File | What the fork changed | On a conflict |
|---|---|---|
| `index.html` | the title, the hearth favicon and theme colour; the Google Fonts links replaced by a comment that keeps upstream's icon list | keep the fork's head; copy upstream's new `icon_names=` list into the comment (a test reads it); add no Google Fonts link back |
| `package.json`, `package-lock.json` | `@pipecat-ai/client-js` 1.13.1 and `@pipecat-ai/small-webrtc-transport` 1.10.8, exact | take upstream's, then re-add the two: `npm install --save-exact --package-lock-only --ignore-scripts @pipecat-ai/client-js@1.13.1 @pipecat-ai/small-webrtc-transport@1.10.8` (in a container from the image) |
| `scripts/package-boundaries.json` | the fork's three modules in the `openai-provider` package | keep both sides' entries |
| `server/providers/openai.js` | two routes, `/api/vesta/agent` and `/api/vesta/voice-brief`, and their imports | keep both |
| `server/providers/openai/hud-summary.js` | the gateway seam: Chat Completions through `vesta-llm.js` when configured | re-apply the seam on upstream's new code |
| `src/hud.js` | the default style's HUD colours through `var(--vr-0-255-255, …)` | keep the fork's values |
| `src/main.js` | the typed box, the brand link and the instance's name, the voice option | keep both |
| `src/overlays/worldOverlayTokens.js` | Vesta values for the label and card chrome | keep the fork's values; check upstream's new chrome colours |
| `src/overlays/worldOverlayDraw.test.mjs` | the pinned CCTV leader colour follows the fork's value | keep the fork's value |
| `src/ui/templates/scene-chrome.html` | the title bar: hearth, wordmark, home link and credit | keep the fork's title bar |
| `src/ui/templates/hud-loading.html` | the loading screen: hearth and wordmark | keep the fork's |
| `src/ui/templates/welcome.html` | the first-run tip | keep the fork's sentence |
| `src/voice/control.js` | "vesta" for "AI AGENT" | keep the fork's word |
| `.env.example`, `README.md`, `DATA_SOURCES.md`, `TESTING.md`, `scripts/format-scope.json`, `server/providers/cctv/catalog.js`, `constants.js`, `sources.js`, `src/data/dataCredits.js` | the CCTV packs of 2026-10-02 (Chichester and the M27 corridor, `a38c13f` and `7b43722`, from another session; `6cdd6e4` a note in `TESTING.md`): their gates, sources, credits and notes | keep both sides; the packs' own files are new (`config/cctv_sources.*.json`, `src/data/cctv*.test.mjs`, `docs/future-cctv-candidates.md`) |
| `style.css` | imports of `vesta-fonts.css`, `vesta-theme.css`, `vesta-ask.css`, before `cyber.css` | keep both; `cyber.css` stays last (a test checks it) |

Everything else the fork has is new files: `VESTA.md`, `docs/vesta/`, `deploy/vesta/`, `build/vesta-palette.mjs`,
`postcss.config.js`, `public/vesta/`, `scripts/vesta-*`, `server/providers/openai/vesta-*.js`,
`src/vesta/`, `src/ui/styles/vesta-*.css`, `src/tooling/vesta*.test.mjs`.

## What follows upstream by itself

- **New or changed map tools and voice instructions**: the typed agent and the voice brief are built
  from upstream's `GEV_REALTIME_TOOLS` and `realtimeInstructions()` at runtime.
- **New colours in upstream's stylesheets**: the palette step recolours any new cyan, teal or blue
  literal.
- **New icons**: the icon font is the whole Material Symbols set.

## What to look at after a merge

- Upstream changed its fonts: run `scripts/vesta-fonts.py` again.
- New colours set from JavaScript (canvas or inline styles) are not seen by the palette step; look for
  cyan in the screenshots.
- The voice contract (`src/voice/session.js`, `sessionCommands.js`) changed: check
  `src/vesta/voiceSession.js` against it.
- The voice instructions changed: the brief drops lines that mention screenshots and the line that
  starts "You are GEV Voice Control"; check `vestaVoiceInstructions()` still reads well
  (`GET /api/vesta/voice-brief`).
- Upstream's changelog and its other docs need no merge care; its `README.md`, `DATA_SOURCES.md` and
  `TESTING.md` carry the CCTV packs' lines (above).
