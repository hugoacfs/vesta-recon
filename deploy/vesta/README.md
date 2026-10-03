# vesta recon on vesta: the deploy wrapper

[hugoacfs/vesta-recon](https://github.com/hugoacfs/vesta-recon), Hugo's fork of
[bilawalsidhu/gods-eye-view](https://github.com/bilawalsidhu/gods-eye-view) (live 3D OSINT globe),
tailnet-only. Two instances, each a folder holding these files, its own `.env` and the fork's checkout
in `app/`:

| | Production | Staging (since 2026-10-03) |
|---|---|---|
| Folder | `/srv/ai/compose/gods-eye-view` | `/srv/ai/compose/gods-eye-view-staging` |
| `app/` on branch | `vesta` | `staging` |
| Origin (tailnet) | https://vesta.tail22b555.ts.net:8600 | https://vesta.tail22b555.ts.net:8601 |
| Published on | `127.0.0.1:8096` | `127.0.0.1:8196` |
| Container, image | `gods-eye-view`, `gods-eye-view:local` | `gods-eye-view-staging`, `gods-eye-view:staging` |

Staging's `docker-compose.yml` and `teardown.sh` are in `staging/` here; the other files are the same
in both folders. Work goes to staging first; production moves on Hugo's word (the fork's
`docs/vesta/operations.md`).

## Topology
```
browser (tailnet) --https--> tailscale serve :8600 --> 127.0.0.1:8096 --> gods-eye-view (vite preview + proxy)
browser (tailnet) --https--> tailscale serve :8601 --> 127.0.0.1:8196 --> gods-eye-view-staging
```

## Layout
- `app/`            — the fork's checkout (`origin` = hugoacfs/vesta-recon, `upstream` = bilawalsidhu)
- `Dockerfile`      — Node 24 image; deps at build, client bundle built at start
- `entrypoint.sh`   — build (if client keys changed / no dist) then `vite preview`
- `docker-compose.yml` — publishes the loopback port only; `HOST=0.0.0.0` in-container
- `.env`            — API keys + layer config (chmod 600, gitignored)
- `set-key.sh`      — set one key in this folder's `.env`, typed hidden, and apply it
- `teardown.sh`     — remove this instance's container + serve mapping + image

## Run
```bash
docker compose up -d          # first run builds the image, then the bundle
docker compose logs -f        # watch the build + "serving vite preview"
```
Expose on the tailnet (once per instance):
```bash
tailscale serve --bg --https=8600 http://127.0.0.1:8096   # production (sudo if not tailscale operator)
tailscale serve --bg --https=8601 http://127.0.0.1:8196   # staging
```

## Adding / changing keys
`ssh -t vesta <folder>/set-key.sh KEY_NAME` (input hidden; it applies the key and shows which
providers that instance has), or edit `.env`, then:
```bash
docker compose up -d          # recreates the container -> rebuilds bundle -> keys apply
```
- **Client-baked** (`CESIUM_ION_TOKEN`, `GOOGLE_MAPS_API_KEY`, `VITE_*`): need the rebuild above.
- **Server-side** (`AISSTREAM_API_KEY`, `FIRMS_MAP_KEY`, `TOMTOM_API_KEY`): also applied on that restart, no image rebuild needed.

AISStream allows one connection per key, so the two instances cannot share one: staging has none (no
live ships) unless it gets a second key.

Without any keys the app still runs on keyless Esri/OSM imagery and the free
layers (flights, satellites, quakes, mil ADS-B, radio, launches, CCTV).

## Update the app
Commit in `app/`, then `docker compose up -d --build` in the folder. Upstream updates, and the way from
staging to production: the fork's `docs/vesta/upstream.md` and `docs/vesta/operations.md`.

## Why HOST=0.0.0.0 is safe here
`0.0.0.0` is the *container* bind. The host publishes only the loopback port, and
the sole external path is tailnet Tailscale Serve. `HOST=0.0.0.0` also sets the
app's `allowedHosts: true`, so it accepts the `vesta.tail22b555.ts.net` Host
header. Container-published ports bypass ufw on vesta, so the loopback bind is
load-bearing — do not change it to `0.0.0.0` on the host side.
