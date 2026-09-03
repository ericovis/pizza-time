// Overwritten at container start-up from the API_URL environment variable
// (see frontend/docker-entrypoint.sh). When hosting the built folder on S3,
// edit this file to point at your API endpoint.
window.PIZZA_API_URL = "http://localhost:8000";
