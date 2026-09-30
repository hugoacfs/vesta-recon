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

## Plan

1. LLM on the box: HUD summaries and typed commands through LiteLLM.
2. Voice through vesta-voice: a "globe" profile whose map actions run in this page.
3. The Vesta look and the name, **vesta recon**.

Server-side notes: `~/vesta-docs/services/gods-eye-view.md` on vesta.

## Rules

- Keys only in the server's `.env`, never in git.
- Changes stay in new files and small seams, so upstream merges stay easy.
- The LICENSE and the credit to Bilawal Sidhu stay.
