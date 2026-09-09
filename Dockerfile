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
    PATH="/venv/bin:$PATH"

WORKDIR /code

# Dependencies first, so a source change does not invalidate the install layer.
COPY pyproject.toml uv.lock /code/
RUN uv sync --frozen --no-dev

COPY . /code/

EXPOSE 8000
CMD ["uv", "run", "--no-sync", "gunicorn", "pizza_project.wsgi:application", "--bind", "0.0.0.0:8000"]
