# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A demo pizza-ordering app — Django REST Framework API plus an AngularJS 1.5 frontend. It is a Docker-only project: Docker Compose is the sole supported way to run it, and there are no cloud deployment assets (the former Elastic Beanstalk, CloudFormation, EC2 and CloudWatch material was removed).

The stack was modernized from Python 2.7 / Django 1.9 / MySQL to **Python 3.12, Django 5.2 LTS, DRF, PostgreSQL**. Do not reintroduce Python 2 idioms.

## Development commands

Everything runs through Docker Compose (v2 syntax, `docker compose`):

```bash
docker compose up --build              # db + api + frontend; api runs migrate on boot
docker compose exec api python manage.py loaddata initial_data   # seed, first run only
docker compose down -v                 # reset, including the Postgres volume
```

Ports: frontend `:8080`, API `:8000` (browsable at `/api/`, admin at `/admin/`).
Seed login: `jklimber` / `start123`.

```bash
docker compose run --rm api python manage.py test
docker compose run --rm api python manage.py test delivery.tests.OrderTests.test_create_order
docker compose run --rm api python manage.py makemigrations
docker compose run --rm api python manage.py shell
```

`delivery/tests.py` holds an API-level suite (auth, order creation, ownership, seed-fixture loading). It is the regression net for further modernization — run it after any change to settings, serializers or routing. There is no linter or CI configured.

Config comes from environment variables (`.env.example` documents them all; Compose reads `.env` automatically). `settings.py` has development-friendly fallbacks for everything, so a missing variable degrades silently rather than erroring — check the env first when behavior looks wrong.

## Architecture

### The two-service split is the point

The API and the frontend are deliberately separate origins: the `api` and `frontend` containers. Consequences that keep mattering:

- **CORS is always live.** `CORS_ALLOW_ALL_ORIGINS` is on unless `CORS_ALLOWED_ORIGINS` is set. Don't "simplify" by making the frontend same-origin.
- **The frontend gets its API base at runtime**, from `window.PIZZA_API_URL` in `frontend/static/js/config.js`. `frontend/docker-entrypoint.sh` regenerates that file on container start from `API_URL` (nginx images run everything in `/docker-entrypoint.d/`). Never hardcode an API host in `main.js` or a controller.
- Django serves no app templates. `STATIC_ROOT`/`collectstatic` exist only for the admin and the DRF browsable API.

There used to be a second copy of the frontend under `delivery/static/` and `delivery/templates/`, Django-served and kept in sync by hand. It's gone — `frontend/` is the only copy.

### API routing — read and write are separate endpoints

`delivery/urls.py` registers the same `Order` model twice with **explicit, different basenames** (`order` and `order-new`). This is load-bearing: modern DRF raises `ImproperlyConfigured` on duplicate derived basenames, which is what you'd get without them.

| Route | ViewSet | Serializer |
|---|---|---|
| `/api/orders/get/` | `GetOrderViewSet` (read-only) | `GetOrderSerializer` — pizzas as names via `Pizza.__str__`, user as username |
| `/api/orders/new/` | `NewOrderViewSet` | `NewOrderSerializer` — pizzas posted as hyperlinks |
| `/api/pizzas/get/` | `PizzaViewSet` | `PizzaSerializer` |
| `/api/users/` | `UserViewSet` (read-only) | `UserSerializer` |

Because the basenames differ, `NewOrderSerializer.url` sets `view_name="order-detail"` explicitly so a created order links back to its read endpoint. `GetOrderSerializer` gets that by default.

Serializers are `HyperlinkedModelSerializer`, so **clients POST resource URLs, not IDs** (`new-order-controller.js` pushes `pizza.url`). `GetOrderSerializer.pizzas` is a `StringRelatedField` — removing `Pizza.__str__` would silently change the API response.

`Order.user` is read-only and assigned in `NewOrderViewSet.perform_create` from `request.user`; a `user` in the payload is ignored. The frontend therefore never needs to look up its own user URL.

### Auth

`djangorestframework-jwt` is dead and was replaced by `djangorestframework-simplejwt`. The response shape changed from `{"token": ...}` to `{"access": ..., "refresh": ...}`. `SIMPLE_JWT["AUTH_HEADER_TYPES"]` accepts both `Bearer` (sent by the current frontend) and `JWT` (the legacy prefix), so older clients still work.

Frontend token handling lives in `frontend/static/js/services/auth.js` — the `auth` factory owns sessionStorage, and an `$httpProvider` interceptor attaches the header. Controllers should depend on `auth` rather than touching sessionStorage.

DRF defaults to `IsAuthenticated` globally, so **every** `/api/` endpoint needs a token.

### Still legacy

AngularJS 1.5 with vendored, committed copies of Angular, jQuery and Bootstrap, and no package manager or build step. That was a deliberate decision to keep the demo recognizable; a framework rewrite is a separate, not-yet-started piece of work.
