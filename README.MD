Pizza Time!
===========

A small pizza-ordering demo app — a Django REST Framework API and a React
frontend. It runs under Docker Compose locally and deploys to a
[Caramelo](https://github.com/ericovis/caramelo) machine from one
`caramelo.yaml`.

Locally the API and the frontend are separate services, each in its own
container. Deployed, they are one: the API image builds the frontend and
serves it, so the whole app answers on a single hostname.

Build a pizza slice by slice (eight slices, up to eight flavors), add menu
pizzas to a cart, place an order and watch it move through the kitchen.

A bit of history
----------------

I originally wrote this app while working at Cloud Academy, as the workload
for a course I was teaching. Some of its hiccups were built in on purpose:
they were the bugs I would fix live, step by step, during the lessons. That
course is long gone. This fork has been cleaned up and modernized, and is now
just a general-purpose demo app.

Stack: Python 3.12, Django 5.2, Django REST Framework, PostgreSQL, uv;
React 19, Vite, TypeScript.

Running locally
---------------

You need Docker with Compose v2. Nothing else — no Python, no Node on the
host.

```
docker compose up --build
```

That starts three containers: `db` (Postgres), `api` (Django — it runs
`migrate` and then `seed_demo` on boot) and `frontend` (nginx serving the
built Vite bundle). There is no manual seed step: the demo catalog, users and
order history appear on the first boot and are left alone on every boot after
that.

Then open:

- Frontend — http://localhost:8080
- API (browsable) — http://localhost:8000/api/
- Admin — http://localhost:8000/admin/

Logins:

| Who | Credentials | Where |
|---|---|---|
| Demo customer | `pizza` / `pizza` | the frontend (also printed on its sign-in screen) |
| Two more customers | `kimberly` / `pizza`, `carlos` / `pizza` | the frontend; they prove orders stay private |
| Staff | `pizza-admin` / `pizza-admin` | `/admin/` only |

The staff account is refused at `POST /api/auth/` with *"Staff accounts sign
in at /admin/."*, so it cannot sign in on the frontend. That is enforced in
the API (`delivery/auth.py`), not in the UI. All four accounts and the fee
come from environment variables — see `.env.example`.

To start over, including the Postgres volume:

```
docker compose down -v
```

Frontend hot reload
-------------------

The `frontend` image is a production build. For iterating on the UI there is
a `dev` profile that runs the Vite dev server from the bind-mounted source on
the same port:

```
docker compose --profile dev up
```

`frontend` and `frontend-dev` both bind `:8080`, so run one or the other.

Configuration lives in environment variables; copy `.env.example` to `.env`
to override any of them. Compose picks `.env` up automatically.

Deploying with Caramelo
-----------------------

`caramelo.yaml` describes the whole deployment: one Postgres dependency, one
`web` service built from the root `Dockerfile`, the migration and the smoke
test a deploy has to pass, and the hostname production answers on. The image
carries both halves of the app — gunicorn serves `/api/`, `/admin/` and
`/static/`, and WhiteNoise serves the Vite bundle at `/` — so there is one
origin, one certificate and one thing to roll back.

Point `pizza-time.asrv.click` (and any other name in the file) at the machine,
then, from a checkout:

```
caramelo secrets set --app-scope SECRET_KEY='<50+ random characters>'
caramelo secrets set production ADMIN_PASSWORD='<the /admin/ password>'
caramelo secrets set production CORS_ALLOWED_ORIGINS=https://pizza-time.asrv.click

caramelo env create production --production
caramelo deploy production
```

Every secret an environment resolves is handed to its containers as an
environment variable, which is how `settings.py` reads all three without
`caramelo.yaml` naming them. Postgres gets a generated `DB_PASSWORD` at
`env create` — the only moment a database reads one — and `caramelo.yaml`
passes it on as `DATABASE_PASSWORD`.

A deploy builds the image from the commit, runs `migrate` and `seed_demo` as a
one-off before any new container starts, health-checks the new replicas,
smoke-tests them by name (the menu comes back, `index.html` is the built app),
flips all traffic at once and then holds the old replicas for a minute in case
the error rate says to go back.

```
caramelo releases production      # what was deployed, by whom, and how it ended
caramelo rollback production      # the previous release, without a build
caramelo logs production -f       # gunicorn's access log, merged
caramelo test production          # the Django suite, in the same image
```

`DEMO_USERNAME`/`DEMO_PASSWORD` are deliberately left at `pizza`/`pizza`: the
sign-in screen prints them.

Tests
-----

```
docker compose run --rm api uv run manage.py test
docker compose run --rm api uv run manage.py test delivery.tests.test_orders
docker compose run --rm api uv run manage.py test delivery.tests.test_auth.AuthTests.test_staff_cannot_obtain_token
```

The suite lives in `delivery/tests/` and covers auth (including the staff
refusal), the public menu and its staff-only writes, order creation and
pricing, order ownership, and the seed command.

The frontend has Vitest tests for the cart reducer, pricing, date formatting,
the API client's 401-refresh path and each screen:

```
docker compose run --rm frontend-dev sh -c "npm install && npm test"
```

(`npm install` is part of the line because that service normally installs on
start-up, and `run` replaces its command.)

The API
-------

Base URL `http://localhost:8000/api/`. Responses are bare arrays or objects —
there is no pagination anywhere — and every money field is a string.

`POST /api/auth/` with a username and password returns a simplejwt
`access`/`refresh` pair plus the `username`; send the access token as
`Authorization: Bearer <token>` (the older `JWT <token>` prefix is also
accepted). Access tokens last 8 hours, refresh tokens 1 day.

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/auth/` | POST | — | obtain an access/refresh pair; staff are refused |
| `/api/auth/refresh/` | POST | — | exchange a refresh token for a new access token |
| `/api/pizzas/get/` | GET | none | the pizza catalog; **public**, so the menu renders signed out |
| `/api/pizzas/get/` | POST, PUT, DELETE | staff | menu edits (normally done in the admin) |
| `/api/orders/get/` | GET | token | your orders, newest first, in display form |
| `/api/orders/get/<id>/` | GET | token | one order; someone else's is a **404**, never a 403 |
| `/api/orders/new/` | POST | token | create an order; nothing else — no list, no update, no delete |

### Placing an order

The body is only `items`. Each item is a pie: exactly eight pizza **ids** —
not hyperlinks — clockwise from twelve o'clock, plus an optional `quantity`
(1 to 9, default 1). Eight identical ids are a menu pizza; a mix is a custom
pie. At most 20 items per order.

```
POST /api/orders/new/
{"items": [{"slices": [11, 11, 11, 11, 5, 5, 5, 5], "quantity": 2},
           {"slices": [1, 1, 1, 1, 1, 1, 1, 1]}]}
```

The server owns everything else: the order belongs to the authenticated
caller, its status starts at `Ordered`, and the total is computed as the sum
of the items plus the delivery fee. A pie costs its most expensive flavor.
`user`, `status`, `total`, `unit_price` and `name` in the payload are ignored.

The response is `201` with the same shape `/api/orders/get/` returns, so a
client can go straight to its tracking screen:

```json
{
  "id": 7,
  "user": "pizza",
  "status": "Ordered",
  "status_label": "Ordered",
  "created_at": "2026-09-09T17:33:23.030216Z",
  "items": [
    {"name": "Your 2-flavor pizza", "slices": [11, 11, 11, 11, 5, 5, 5, 5],
     "flavors": ["Pepperoni", "Funghi"], "quantity": 2,
     "unit_price": "12.23", "line_total": "24.46", "is_custom": true},
    {"name": "Cheese", "slices": [1, 1, 1, 1, 1, 1, 1, 1],
     "flavors": ["Cheese"], "quantity": 1,
     "unit_price": "11.23", "line_total": "11.23", "is_custom": false}
  ],
  "delivery_fee": "5.00",
  "total": "40.69",
  "url": "http://localhost:8000/api/orders/get/7/"
}
```

### Order status

An order moves through four stages:

```
Ordered → In the oven → Out for delivery → Delivered
```

Nothing advances it automatically. Staff do, in the admin: `/admin/delivery/order/`
has `status` editable straight from the list page, so you can walk an order
forward and save. The frontend's tracking screen (`#/orders/<id>?placed=1`)
polls the order while it is not delivered, so a status change shows up within
a few seconds without a reload — change it in one tab, watch the other.

The frontend
------------

A React 19 + TypeScript single-page app built with Vite, hash-routed, in
[frontend/](/frontend). It is served by nginx from its own container, on its
own origin, and talks to the API over CORS.

```
frontend/
  index.html            loads /config.js and the fonts, then the bundle
  public/config.js      runtime API base (regenerated in the container)
  public/fonts/         self-hosted Unbounded + Rubik (no CDN calls)
  src/
    main.tsx            HashRouter, providers, routes
    api/                client (auth header, one refresh on 401), pizzas, orders, auth
    state/              auth, cart, catalog and toast contexts
    lib/                pizza-art custom element, pricing, geometry, fx, dates, config
    components/         Header, MobileNav, PizzaArt, StatusBadge, Tracker, Toast, RequireAuth
    pages/              Menu, Builder, Cart, SignIn, Orders, Order, About
    styles/             tokens.css (palette, keyframes), neon.css (shared
                        component classes) and pages/<page>.css (page-local rules)
```

Screens: `#/` menu, `#/build` the slice-by-slice builder, `#/cart`,
`#/signin`, `#/orders`, `#/orders/:id` (detail and live tracking), `#/about`.
The two order routes require a token and redirect to sign-in otherwise.

Runtime configuration: Vite bakes `import.meta.env` in at build time, which
would break the "one image, any API URL" rule, so the API base comes from
`window.PIZZA_API_URL` in [public/config.js](/frontend/public/config.js). The
container regenerates that file on start-up from the `API_URL` environment
variable, and nginx serves it `no-store`. When `API_URL` is empty (the
default) the app calls port 8000 on whatever host the page was loaded from,
so opening `http://<your-lan-ip>:8080` from a phone on the same network just
works. Set it when the API lives somewhere else:

```
API_URL=https://api.example.com docker compose up frontend
```

The image is multi-stage: `node:22-alpine` runs `npm ci && npm run build`, and
`nginx:1.27-alpine` serves the resulting `dist/`. Node is only ever needed
inside Docker.

The API needs to allow the frontend's origin — `CORS_ALLOWED_ORIGINS` does
that (it defaults to allowing everything). Credentials are only offered to an
origin on that list: the frontend authenticates with a Bearer token, while the
browsable API and the admin use session cookies that no other origin should be
able to ride.

Design
------

The interface is **Neon Slice**, one of three directions from a Claude Design
project ("Premium pizza customizer interface"). The pizza art is drawn
procedurally in a canvas custom element, keyed by pizza slug, so a pizza added
in the admin still gets a pie — a generic cheese one — instead of a blank.
The implementation plan lives in [docs/neon-slice-plan.md](/docs/neon-slice-plan.md).
