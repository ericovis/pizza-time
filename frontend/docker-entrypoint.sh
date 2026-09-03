#!/bin/sh
# Point the app at its API. Runs before nginx starts (nginx images execute
# everything in /docker-entrypoint.d/ on boot).
set -e

API_URL="${API_URL:-http://localhost:8000}"

cat > /usr/share/nginx/html/static/js/config.js <<CONFIG
// Generated at container start-up from the API_URL environment variable.
window.PIZZA_API_URL = "${API_URL}";
CONFIG

echo "pizza-time frontend: API_URL=${API_URL}"
