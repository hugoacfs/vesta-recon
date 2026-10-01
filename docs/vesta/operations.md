# Operations

Everything runs on vesta (`ssh vesta`, user `hugo`, passwordless sudo). This repository is checked out
at `/srv/ai/compose/gods-eye-view/app` on branch `vesta`; the wrapper around it (Dockerfile, entrypoint,
compose file, key script) sits one level up, with versioned copies in `deploy/vesta/`.

## Where things are

| | |
|---|---|
| Page | `https://vesta.tail22b555.ts.net:8600/` (Tailscale Serve, tailnet only); `https://vesta.tail22b555.ts.net/gods-eye` redirects there; the home page card **Vesta Recon** under *agents* |
| Container | `gods-eye-view`, image `gods-eye-view:local`, published on `127.0.0.1:8096` only (container ports bypass ufw on vesta, so never `0.0.0.0`) |
| Compose project | `/srv/ai/compose/gods-eye-view/` (`docker-compose.yml`, `Dockerfile`, `entrypoint.sh`, `set-key.sh`, `teardown.sh`, `.env`) |
| Source | `/srv/ai/compose/gods-eye-view/app` (this repository: `origin` = `hugoacfs/vesta-recon`, `upstream` = `bilawalsidhu/gods-eye-view`) |
| Gateway | LiteLLM on `192.168.0.2:4000`, key `vesta-recon` |
| Voice | vesta-voice staging, `https://vesta.tail22b555.ts.net/voice-staging/` (container `vesta-voice-staging`, `127.0.0.1:8097`) |
| Server docs | `~/vesta-docs/services/gods-eye-view.md` |

## Deploy a change

Commit on `vesta` in the checkout, then:

```bash
cd /srv/ai/compose/gods-eye-view && docker compose up -d --build
```

The image installs the dependencies (`npm ci`, cached until the lockfile changes) and copies the
source. At container start `entrypoint.sh` builds the page (`npm run build`) unless a bundle already
exists for the same client keys, then serves it with `vite preview` on port 8096. A recreated container
(after `--build`, or `up -d` after an `.env` change) always rebuilds; a plain restart reuses the bundle.
Variables read by the page (`VITE_*`, `CESIUM_ION_TOKEN`, `GOOGLE_MAPS_API_KEY`) are baked in at that
build; server-side keys are read at runtime. Then push: `git push origin vesta`.

## Configuration

`/srv/ai/compose/gods-eye-view/.env` (mode 0600, never in git; values never printed):

| Name | Read by | Meaning |
|---|---|---|
| `CESIUM_ION_TOKEN` | page | Google Photorealistic 3D and terrain through Cesium ion |
| `GOOGLE_MAPS_API_KEY` | page | direct Google 3D tiles and place search (not set) |
| `AISSTREAM_API_KEY` | server | live ships |
| `FIRMS_MAP_KEY` | server | NASA active fires (not set) |
| `TOMTOM_API_KEY`, `TOMTOM_DAILY_TILE_BUDGET` | server | live traffic speeds and their daily cap |
| `OPENSKY_AUTH_MODE`, `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET` | server | OpenSky OAuth for more flight polling |
| `VITE_AIS_LIVE_API_URL`, `VITE_AIS_LIVE_MAX_ROWS`, `VITE_AIS_LIVE_LABEL_MAX_ROWS` | page | upstream's live-ships layer settings (see upstream's `docs/CURRENT-STATE.md`) |
| `VESTA_LLM_BASE_URL`, `VESTA_LLM_API_KEY`, `VESTA_LLM_MODEL` | server | vesta's gateway ([model.md](model.md)) |
| `VITE_VESTA_VOICE_OFFER_URL` | page | vesta-voice's offer URL; unset = upstream's own voice ([voice.md](voice.md)) |

**Setting a key**, typed hidden, never on screen or in history:

```bash
ssh -t vesta /srv/ai/compose/gods-eye-view/set-key.sh CESIUM_ION_TOKEN
```

It writes `.env`, runs `docker compose up -d` and shows the app's own doctor (which providers are
configured, never the values): `docker exec gods-eye-view npm run --silent doctor`. Not the app's
POWER UP panel: that writes inside the container, which the next update replaces. Cesium and Google
keys end up in the page, so restrict them at the provider to the `:8600` origin.

## Checks before a push

Run in a throwaway container from the current image, on a copy of the checkout (the boundary checks
read git history; the copy gets the image's `node_modules`):

```bash
cd /srv/ai/compose/gods-eye-view/app
docker run --rm --entrypoint sh -v "$PWD:/src:ro" gods-eye-view:local -c '
  cp -a /src /tmp/w && cd /tmp/w && rm -rf node_modules && ln -s /app/node_modules node_modules &&
  git config --global --add safe.directory /tmp/w &&
  npm run -s check:boundaries && npm run -s format:check && npm test && npx vite build'
```

Formatting a file in place: `docker run --rm --entrypoint sh -v "$PWD:/w" -w /w gods-eye-view:local -c
"ln -s /app/node_modules node_modules; npx prettier --write <files>; rm node_modules"`. On 2026-10-01 the
suite was 5,405 passing tests and one skip (a Windows-only test).

**In a browser**, from the Mac:

- `node scripts/vesta-shoot.mjs <label>`: screenshots at desktop (1440×900) and phone (390×844) width, in
  headless Chrome with software WebGL. It needs Google Chrome
  (`/Applications/Google Chrome.app`, or `CHROME=<path>`) and puppeteer-core: from this repository's own
  `node_modules` when there is one, otherwise from `PUPPETEER_FROM=<a package.json beside a
  node_modules with puppeteer-core>` (on Hugo's Mac the harness repository's
  `deploy/vesta/verify/ffdrive/package.json`). `LOADING=<ms>` also shoots the loading screen;
  `OPEN_PANELS=data-panel` opens panels first; `ONLY=desktop|phone`.
- `node checks/mic-check.mjs` in the vesta-voice repository: a call from this page with a fake
  microphone (`ONLY=globe`).
- The routing check: `docker exec gods-eye-view node scripts/vesta-routing-eval.mjs` ([model.md](model.md)).

## Rollback

- A change: `git revert` the commit on `vesta`, then deploy as above.
- Upstream before the fork: the image `gods-eye-view:pre-update-20260930` (upstream `0d41b6b`):
  `docker tag gods-eye-view:pre-update-20260930 gods-eye-view:local && docker compose up -d`.
- `.env` backups beside it: `.env.bak-before-vesta-llm-20260930T160723Z`,
  `.env.bak-before-vesta-voice-20261001T102319Z`.
- Whole project (keys, wrapper, source) as of 2026-09-30: `~/backups/gods-eye-view-20260930T152644Z.tgz`.
- Off entirely: `./teardown.sh` in the compose project (container, the Serve mapping on `:8600`, image).

## Troubleshooting

| Symptom | Look at |
|---|---|
| Voice: "vesta voice did not answer in 25 s" | `docker ps` (is `vesta-voice-staging` up?); its log: `docker logs --since 5m vesta-voice-staging`; "a globe call where the globe profile is off or the globe is down" means `VESTA_VOICE_GLOBE_BRIEF_URL` is unset there or this app is down |
| Voice connects but the map does not move | a hidden page does not render (the globe only animates when the tab is visible); the service log shows the `tool-call`s |
| The microphone is refused | the browser's site permission for `:8600`; the call still connects for typed turns |
| HUD summary missing | `docker logs gods-eye-view` for the hud-summary route; the gateway key in `.env` |
| The typed box: "vesta recon could not answer just now." | `POST /api/vesta/agent`: 503 no gateway configured, 502 the gateway failed |
| Icons shown as words, or plain fonts | `https://vesta.tail22b555.ts.net:8600/vesta/fonts/material-symbols-outlined.woff2` must answer 200 |
