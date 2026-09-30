# God's Eye View on vesta

Self-hosted [bilawalsidhu/gods-eye-view](https://github.com/bilawalsidhu/gods-eye-view)
(live 3D OSINT globe), tailnet-only.

## Topology
```
browser (tailnet) --https--> tailscale serve :8600 --> 127.0.0.1:8096 --> container (vite preview + proxy)
```
Origin: **https://vesta.tail22b555.ts.net:8600** (tailnet only).

## Layout
- `app/`            — git clone of the upstream repo (update: `git -C app pull`)
- `Dockerfile`      — Node 24 image; deps at build, client bundle built at start
- `entrypoint.sh`   — build (if client keys changed / no dist) then `vite preview`
- `docker-compose.yml` — publishes `127.0.0.1:8096` only; `HOST=0.0.0.0` in-container
- `.env`            — API keys + layer config (chmod 600, gitignored)
- `teardown.sh`     — remove container + serve mapping + image

## Run
```bash
docker compose up -d          # first run builds the image, then the bundle
docker compose logs -f        # watch the build + "serving vite preview"
```
Expose on the tailnet (once):
```bash
tailscale serve --bg --https=8600 http://127.0.0.1:8096   # sudo if not tailscale operator
```

## Adding / changing keys
Edit `.env`, then:
```bash
docker compose up -d          # recreates the container -> rebuilds bundle -> keys apply
```
- **Client-baked** (`CESIUM_ION_TOKEN`, `GOOGLE_MAPS_API_KEY`): need the rebuild above.
- **Server-side** (`AISSTREAM_API_KEY`, `FIRMS_MAP_KEY`, `TOMTOM_API_KEY`): also applied on that restart, no image rebuild needed.

Without any keys the app still runs on keyless Esri/OSM imagery and the free
layers (flights, satellites, quakes, mil ADS-B, radio, launches, CCTV).

## Update the app
```bash
git -C app pull && docker compose up -d --build
```

## Why HOST=0.0.0.0 is safe here
`0.0.0.0` is the *container* bind. The host publishes only `127.0.0.1:8096`, and
the sole external path is tailnet Tailscale Serve. `HOST=0.0.0.0` also sets the
app's `allowedHosts: true`, so it accepts the `vesta.tail22b555.ts.net` Host
header. Container-published ports bypass ufw on vesta, so the loopback bind is
load-bearing — do not change it to `0.0.0.0` on the host side.
