# One image, two jobs: the DRF API and the single-page app it serves.
#
# The frontend still has its own image (frontend/Dockerfile) for the
# two-origin Docker Compose setup, but a deployment that answers on one
# hostname needs one thing behind that hostname, so the bundle is built here
# too and WhiteNoise serves it at the web root (FRONTEND_DIST in settings.py).
FROM node:22-alpine AS frontend

WORKDIR /app
# Lock file first, so a source change does not reinstall node_modules.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build
# Vite copies public/config.js into dist/, and that copy points at port 8000 on
# the page's own host — right for the two-container setup, wrong for a server
# that is both. Same origin needs no configuration at all, so say so.
RUN printf '%s\n' \
    '// Generated in the image build: the API is this server.' \
    'window.PIZZA_API_URL = window.location.origin;' \
    > dist/config.js


FROM python:3.12-slim

# uv ships as a static binary; take it from the official image.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    # /code is bind-mounted in development, so the venv must live outside it.
    UV_PROJECT_ENVIRONMENT=/venv \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_FROZEN=1 \
    PATH="/venv/bin:$PATH" \
    # Both outside /code for the same reason as the venv: the development bind
    # mount would hide them, and the admin needs its manifest at every boot.
    STATIC_ROOT=/srv/static \
    FRONTEND_DIST=/srv/pizza-frontend

WORKDIR /code

# Dependencies first, so a source change does not invalidate the install layer.
COPY pyproject.toml uv.lock /code/
RUN uv sync --frozen --no-dev

COPY --from=frontend /app/dist/ /srv/pizza-frontend/
COPY . /code/

# The admin's and the browsable API's assets, hashed and compressed. Nothing
# collects them at run time: the container filesystem is the release.
RUN uv run --no-sync manage.py collectstatic --noinput

EXPOSE 8000
CMD ["uv", "run", "--no-sync", "gunicorn", "pizza_project.wsgi:application", "--bind", "0.0.0.0:8000"]
