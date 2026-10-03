#!/usr/bin/env bash
# Set one God's Eye View provider key in this project's .env, then apply it.
# The value is read hidden and handed to Python on stdin: it never appears on screen,
# in shell history, in `ps`, or in any chat. Usage (from your Mac):
#   ssh -t vesta /srv/ai/compose/gods-eye-view/set-key.sh CESIUM_ION_TOKEN
# The staging instance has its own copy and .env: /srv/ai/compose/gods-eye-view-staging/set-key.sh
# Keys typed into the app's own POWER UP panel would land inside the container and be lost
# on the next update, so keys live here instead (the container reads this .env at start).
set -euo pipefail
cd "$(dirname "$0")"
k="${1:-}"
known=$(grep -oE '^[A-Z_][A-Z0-9_]*=' .env | tr -d '=' | tr '\n' ' ')
if [ -z "$k" ]; then echo "usage: $0 KEY_NAME   (keys in .env: $known)"; exit 1; fi
if ! grep -qE "^${k}=" .env; then
  printf '%s is not in .env yet; add it? [y/N] ' "$k"; read -r ans
  [ "$ans" = "y" ] || { echo "nothing changed"; exit 1; }
  printf '\n%s=\n' "$k" >> .env
fi
read -rsp "Paste $k (input hidden), then Enter: " v; echo
[ -n "$v" ] || { echo "empty value, nothing changed"; exit 1; }
printf '%s' "$v" | KEY="$k" python3 -c '
import os, sys
k, v = os.environ["KEY"], sys.stdin.read()
lines = open(".env").read().split("\n")
open(".env", "w").write("\n".join(f"{k}={v}" if l.startswith(k + "=") else l for l in lines))
'
unset v
chmod 600 .env
echo "$k saved. Applying (a browser-side key also rebuilds the page bundle, about a minute)..."
docker compose up -d
echo "Configured providers now:"
sleep 5
docker compose exec -T gods-eye-view npm run --silent doctor 2>/dev/null | sed -n '/Configured providers:/,/^$/p'
