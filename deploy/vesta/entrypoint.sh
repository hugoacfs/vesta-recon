#!/usr/bin/env bash
set -euo pipefail
cd /app

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8096}"

# Client-exposed keys (Cesium/Google) are baked into the bundle at BUILD time
# via Vite `define`, so a change means a rebuild. Server-side keys (FIRMS/AIS/
# TomTom/OpenSky/...) are read at RUNTIME by the preview proxy — no rebuild.
# We hash only the client-baked keys; when they are unchanged and a dist already
# exists (e.g. a plain container restart after reboot), we skip the rebuild for
# a fast start. A recreate (image rebuild or `up -d` after an .env change)
# starts with an empty dist and therefore always rebuilds.
KEYHASH="$(printf '%s' "${CESIUM_ION_TOKEN:-}|${GOOGLE_MAPS_API_KEY:-}" | sha256sum | cut -d' ' -f1)"
MARKER="dist/.gev-client-keyhash"

if [ -f dist/index.html ] && [ "$(cat "$MARKER" 2>/dev/null || true)" = "$KEYHASH" ]; then
  echo "[entrypoint] Reusing existing client bundle (client keys unchanged)."
else
  echo "[entrypoint] Building client bundle (npm run build)..."
  npm run build
  printf '%s' "$KEYHASH" > "$MARKER"
fi

echo "[entrypoint] Serving vite preview on ${HOST}:${PORT} (allowedHosts=true when HOST=0.0.0.0)."
exec node_modules/.bin/vite preview --host "$HOST" --port "$PORT" --strictPort
