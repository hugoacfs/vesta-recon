#!/usr/bin/env bash
# Fully remove the God's Eye View deployment from vesta.
set -euo pipefail
cd "$(dirname "$0")"

echo "== stopping + removing container =="
docker compose down --remove-orphans || true

echo "== removing tailnet exposure (:8600) =="
tailscale serve --https=8600 off 2>/dev/null \
  || sudo tailscale serve --https=8600 off 2>/dev/null \
  || echo "(could not remove serve mapping automatically — run: sudo tailscale serve --https=8600 off)"

echo "== removing image =="
docker image rm gods-eye-view:local 2>/dev/null || true

echo "Done. To also delete the checkout + deploy files: rm -rf $(pwd)"
