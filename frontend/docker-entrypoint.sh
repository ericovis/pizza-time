#!/bin/sh
# Point the app at its API. Runs before nginx starts (nginx images execute
# everything in /docker-entrypoint.d/ on boot). index.html loads this file with
# a plain <script src="/config.js"> before the module bundle.
set -e

# Empty means "same host as the page, port 8000", resolved in the browser, so
# the same image works from the laptop and from a phone on the same network.
API_URL="${API_URL:-}"

# The value lands inside a JavaScript string literal, so anything that could
# close it early is dropped rather than written out.
SAFE_API_URL=$(printf '%s' "$API_URL" | tr -d '"\\<>' | tr -d '\n\r')

cat > /usr/share/nginx/html/config.js <<CONFIG
// Generated at container start-up from the API_URL environment variable.
window.PIZZA_API_URL = "${SAFE_API_URL}";
CONFIG

echo "pizza-time frontend: API_URL=${SAFE_API_URL:-<same host as the page, port 8000>}"
