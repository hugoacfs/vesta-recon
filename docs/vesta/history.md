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
- In production the same night at his word: vesta-voice `stable-2026-10-01-globe` (`cb1b3b6`), and this
  page's voice pointed at `/voice/api/offer`; memory is now his own.

## 2026-10-01 — Phase 3: the Vesta look

- `0b0e360` — the name and the hearth, the wordmark, self-hosted fonts, the build-time palette (609
  literals recoloured, the cyber skin untouched), the HUD and label colours. Hugo: "don't forget we will
  need to theme it".
- The home page: the card **Vesta Recon** (Title Case, Hugo's rule for home-page titles), moved to the
  agents.
- This documentation (`docs/vesta/`).

## 2026-10-02 — draft: the typed box through Vesta

- `eb00006` — with `?vesta-text`, the box talks to Vesta through a text-only call to vesta-voice
  (staging `4168b2a`, `9f1cf09`), so typing reaches her memory and web search too; the call opens when
  the box is focused. Regressions checked on vesta-voice staging (normal and globe voice calls).
- Found: the long globe prompt leaves the model server's cache within minutes when other work runs,
  so a first question can wait about 12 s; opening the call on focus hides most of it.

## 2026-10-02 — CCTV packs (another session)

- `a38c13f`, `7b43722` — two keyless CCTV packs, each behind its own gate: Chichester (the harbour
  webcam) and the M27 corridor (76 National Highways cameras through the trafficcameras.uk mirror).
- `6cdd6e4` — a note in `TESTING.md` on a timing test that fails on the vesta host itself.

## 2026-10-03 — staging

- A staging instance, as vesta-voice and the harness have (Hugo: "Can we now create a vesta recon
  staging, just like we have for voice, harness and memory please"): branch `staging`,
  `https://vesta.tail22b555.ts.net:8601/` (`127.0.0.1:8196`, container `gods-eye-view-staging`,
  `/srv/ai/compose/gods-eye-view-staging`). It calls vesta-voice staging, whose globe brief now
  comes from it; no AIS key (AISStream allows one connection per key); TomTom 1000 tiles a day.
- From now on work happens on `staging`; `vesta` moves on Hugo's word.
- `0ac0bfa` (on `staging`) — a named instance says so: `VITE_VESTA_ENV=staging` puts STAGING beside
  the wordmark and "· staging" in the tab, as vesta-voice and the harness do.
- Checked on `:8601`: the page and the photoreal tiles, a voice call from it ("Fly to Paris" flew
  there), the typed box both ways (map-only, and the `?vesta-text` draft with a memory question), no
  microphone request from the box.
- `set-key.sh` now reports the providers of the instance it runs in (it named production's
  container); `deploy/vesta/staging/` holds staging's compose file and teardown script.

## Open

- The draft typed box through Vesta: Hugo's verdict, then production (vesta-voice and this page).
- Drawn-outline map events for voice.
- The phone layout: upstream's overlapping HUD readouts, the typed box under the CONTEXT panel.
- Production's `?vesta-text` draft calls vesta-voice staging, whose brief now comes from staging; the
  draft could live on staging only.
