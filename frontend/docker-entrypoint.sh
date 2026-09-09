#!/bin/sh
# Point the app at its API. Runs before nginx starts (nginx images execute
# everything in /docker-entrypoint.d/ on boot). index.html loads this file with
# a plain <script src="/config.js"> before the module bundle.
set -e

API_URL="${API_URL:-http://localhost:8000}"

cat > /usr/share/nginx/html/config.js <<CONFIG
// Generated at container start-up from the API_URL environment variable.
window.PIZZA_API_URL = "${API_URL}";
CONFIG

echo "pizza-time frontend: API_URL=${API_URL}"
