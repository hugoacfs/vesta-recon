# History

Newest last. Commits are on `vesta` in this repository unless named otherwise; the server-side record is
the change history of `~/vesta-docs/README.md`.

## 2026-09-20 — on vesta, unconfigured

God's Eye View was set up on vesta by an earlier session (container `gods-eye-view`, Tailscale Serve
`:8600`) and left without keys.

## 2026-09-30 — documented, updated, forked

- Documented on the server, updated to upstream `e7707d9` (rollback image
  `gods-eye-view:pre-update-20260930`), a landing card; Hugo set the Cesium ion, AISStream, TomTom and
  OpenSky keys; everything backed up (`~/backups/gods-eye-view-20260930T152644Z.tgz`).
- Hugo's decisions: a public GitHub fork, **vesta recon**, voice through vesta-voice as a "globe" profile
  (vesta-voice staging until he says otherwise), one instance until it works.
- `3bd5b12` — `VESTA.md` and the versioned deploy wrapper (`deploy/vesta/`).
- `145ab7b` — HUD summaries on Qwen through vesta's gateway (a LiteLLM virtual key `vesta-recon`;
  Chat Completions with thinking off, about 0.3 s).

## 2026-10-01 — Phase 1: Qwen on the box

- `bd21abd` — "Ask vesta recon": the typed agent (`POST /api/vesta/agent`) and the box above the dock;
  the routing check (59 of 62 voice QA phrases routed as expected, median 1.9 s).

## 2026-10-01 — Phase 2: Vesta's voice

- `b231ef2` — the dock's microphone calls vesta-voice: the session adapter, the voice brief route, the
  Pipecat client pinned as on the vesta-voice page; vesta-voice staging `9f81ed5` (the globe profile and
  the tool bridge), `2cbe30b` (the prompt read as the call connects), `62e01a3` (its docs).
- `1d3faec` — our own microphone (`src/vesta/micMediaManager.js`): Pipecat's default media manager had
  fetched Daily's call-machine script from `c.daily.co` at every call, on this page and on vesta-voice's
  (vesta-voice staging `d5cbd97`). Hugo: "address this straight away".
- vesta-voice staging `e09a94a` — globe calls also have memory and web search (Hugo's ask), never the
  house.
- Hugo's test on staging: "The voice works perfectly fine with web search, memory and map controls!"

## 2026-10-01 — Phase 3: the Vesta look

- `0b0e360` — the name and the hearth, the wordmark, self-hosted fonts, the build-time palette (609
  literals recoloured, the cyber skin untouched), the HUD and label colours. Hugo: "don't forget we will
  need to theme it".
- The home page: the card **Vesta Recon** (Title Case, Hugo's rule for home-page titles), moved to the
  agents.
- This documentation (`docs/vesta/`).

## Open

- Voice on vesta-voice production (and Hugo's own memory there), on his word ([voice.md](voice.md)).
- The typed box with memory and web search, like voice.
- Drawn-outline map events for voice.
- The phone layout: upstream's overlapping HUD readouts, the typed box under the CONTEXT panel.
- A staging instance of vesta recon at go-live.
