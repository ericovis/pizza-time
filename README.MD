Pizza Time!
===========

A small pizza-ordering demo app — a Django REST Framework API and an AngularJS
frontend — that runs entirely under Docker Compose.

The API and the frontend are separate services, each in its own container.

Stack: Python 3.12, Django 5.2, Django REST Framework, PostgreSQL, AngularJS 1.5.

Running locally
---------------

You need Docker with Compose v2.

```
docker compose up --build
```

That starts three containers: `db` (Postgres), `api` (Django, migrations run
automatically on boot) and `frontend` (nginx).

Load the seed data the first time:

```
docker compose exec api python manage.py loaddata initial_data
```

Then open:

- Frontend — http://localhost:8080
- API (browsable) — http://localhost:8000/api/
- Admin — http://localhost:8000/admin/

Seed login: `jklimber` / `start123`.

Configuration lives in environment variables; copy `.env.example` to `.env` to
override any of them. Compose picks `.env` up automatically.

Tests
-----

```
docker compose run --rm api python manage.py test
docker compose run --rm api python manage.py test delivery.tests.OrderTests
```

The API
-------

Every endpoint requires authentication. `POST /api/auth/` with a username and
password returns a simplejwt `access`/`refresh` pair; send the access token as
`Authorization: Bearer <token>` (the older `JWT <token>` prefix is also
accepted).

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/auth/` | POST | obtain an access/refresh token pair |
| `/api/auth/refresh/` | POST | exchange a refresh token for a new access token |
| `/api/pizzas/get/` | GET, POST | the pizza catalog |
| `/api/orders/get/` | GET | orders, rendered with pizza and user names |
| `/api/orders/new/` | POST | create an order; pizzas are posted as hyperlinks |
| `/api/users/` | GET | read-only user list |

Orders are always created for the authenticated caller — a `user` in the
request body is ignored.

The frontend
------------

One copy of the app, in [frontend/](/frontend), served by nginx. It reads its
API base URL from `window.PIZZA_API_URL` in
[static/js/config.js](/frontend/static/js/config.js), which the container
rewrites on start-up from the `API_URL` environment variable:

```
API_URL=https://api.example.com docker compose up frontend
```

The API needs to allow the frontend's origin — `CORS_ALLOWED_ORIGINS` does
that (it defaults to allowing everything).
