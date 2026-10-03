#!/usr/bin/env bash
# Fully remove the vesta recon STAGING deployment from vesta (production is untouched).
set -euo pipefail
cd "$(dirname "$0")"

echo "== stopping + removing container =="
docker compose down --remove-orphans || true

echo "== removing tailnet exposure (:8601) =="
tailscale serve --https=8601 off 2>/dev/null \
  || sudo tailscale serve --https=8601 off 2>/dev/null \
  || echo "(could not remove serve mapping automatically — run: sudo tailscale serve --https=8601 off)"

echo "== removing image =="
docker image rm gods-eye-view:staging 2>/dev/null || true

echo "Done. To also delete the checkout + deploy files: rm -rf $(pwd)"
