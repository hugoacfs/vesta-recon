# vesta recon

**vesta recon** is Hugo's fork of [God's Eye View](https://github.com/bilawalsidhu/gods-eye-view) by
Bilawal Sidhu (MIT) for **vesta**, his home server: the same live 3D globe of public data, running on
vesta's own model (Qwen through LiteLLM) and voice (vesta-voice), in the Vesta look. Upstream's
`README.md` is left as it is; everything the fork adds is described here and in
[`docs/vesta/`](docs/vesta/README.md).

## What the fork adds

- **Vesta's voice.** The dock's microphone calls vesta-voice over WebRTC. She moves the map with the
  globe's 30 map tools, and has Hugo's memory and web search as on any call with her (never the house).
  → [voice](docs/vesta/voice.md)
- **Qwen on the box.** "Ask vesta recon", a typed command box above the dock, and the HUD's five-word
  summary, both through vesta's LiteLLM gateway with thinking off. A draft (2026-10-02, on vesta-voice
  staging, with `?vesta-text` in the address) sends the box through Vesta instead, so typing gets her
  memory and web search too. → [model](docs/vesta/model.md)
- **The Vesta look.** The hearth and the "vesta recon" wordmark, ember on the Vesta ground, Space
  Grotesk, a link home and the credit to God's Eye View. The palette is a build step, so no upstream
  stylesheet is edited, and upstream's cyber skin keeps its own look. → [look](docs/vesta/look.md)
- **Nothing fetched from third parties it does not need.** The fonts are self-hosted (no Google Fonts)
  and the microphone layer is our own (no Daily call-machine script).

## Where it runs

`https://vesta.tail22b555.ts.net:8600/` on the tailnet (Tailscale Serve → `127.0.0.1:8096`), container
`gods-eye-view`, compose project `/srv/ai/compose/gods-eye-view`, whose `app/` is this repository. The
vesta home page lists it as **Vesta Recon** among the agents. Staging, since 2026-10-03:
`https://vesta.tail22b555.ts.net:8601/` (`127.0.0.1:8196`, container `gods-eye-view-staging`,
`/srv/ai/compose/gods-eye-view-staging`, branch `staging`). → [operations](docs/vesta/operations.md)

## Branches

- `main` mirrors upstream; update it with GitHub's **Sync fork**.
- `staging` is where work happens: commit there, deploy the staging instance (`:8601`), check it.
- `vesta` is production, what runs on `:8600`, and GitHub's default branch. It moves on Hugo's word,
  by merging `staging` into it, as for vesta-voice and the harness. Upstream updates take the same
  road: `main` into `staging`, then on to `vesta`. → [upstream](docs/vesta/upstream.md)
- Voice: production calls vesta-voice's production instance (since 2026-10-01, its tag
  `stable-2026-10-01-globe`); staging calls vesta-voice's staging instance, which reads its globe
  brief from this staging instance.

## Documentation

| Page | What it covers |
|---|---|
| [docs/vesta/architecture.md](docs/vesta/architecture.md) | the pieces and how they talk: the page, its server, the gateway, vesta-voice |
| [docs/vesta/voice.md](docs/vesta/voice.md) | voice through vesta-voice: the globe profile, the tool bridge, the microphone, tests, figures |
| [docs/vesta/model.md](docs/vesta/model.md) | Qwen on the box: the gateway key, HUD summaries, the typed agent, the routing check |
| [docs/vesta/look.md](docs/vesta/look.md) | the name, the palette step, the tokens, the fonts, how to tune them |
| [docs/vesta/operations.md](docs/vesta/operations.md) | the two instances, deploy (staging, then production), configuration, keys, checks, screenshots, rollback, troubleshooting |
| [docs/vesta/upstream.md](docs/vesta/upstream.md) | taking upstream updates, and every upstream file the fork touches |
| [docs/vesta/history.md](docs/vesta/history.md) | what was done, when, with the commits |

Server-side notes: `~/vesta-docs/services/gods-eye-view.md` on vesta. The voice service is its own
project, `hugoacfs/vesta-voice` (its `docs/architecture.md` describes the globe profile).

## Rules

- Keys only in the server's `.env` (typed hidden with `set-key.sh`), never in git, docs or chat.
- Changes stay in new files and small seams, so upstream merges stay easy.
- The LICENSE and the credit to Bilawal Sidhu stay; the title bar carries the credit too.
- A change is committed, rebuilt, checked (tests, format, boundaries, build, a look in a browser) and
  pushed.
- Work on `staging` and its instance; production (`vesta`, `:8600`) moves on Hugo's word. vesta-voice
  keeps the same rule.
- `vesta` marks what production runs. It moves only in a promotion, by fast-forward to the approved
  commits; docs commits go to `staging` like everything else, and the production checkout stays on the
  deployed commit (the harness learned this on 2026-10-03). Before any push to `vesta`,
  `git log --oneline origin/vesta..<commit>` lists exactly what would move.
