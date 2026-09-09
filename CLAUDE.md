# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A demo pizza-ordering app — a Django REST Framework API plus a React 19 single-page frontend. It is a Docker-only project: Docker Compose is the sole supported way to run it, and there are no cloud deployment assets.

The stack is **Python 3.12, Django 5.2 LTS, DRF, PostgreSQL, uv** on the API side and **React 19 + Vite + TypeScript** on the frontend. Do not reintroduce Python 2 idioms, and do not reintroduce AngularJS: the old vendored frontend is gone.

The UI implements the "Neon Slice" design; `docs/neon-slice-plan.md` is the specification the current code was built from and explains most of the decisions below.

## Development commands

Everything runs through Docker Compose (v2 syntax, `docker compose`). **Node and Python are not expected on the host** — npm only exists inside a container.

```bash
docker compose up --build              # db + api + frontend; api runs migrate then seed_demo on boot
docker compose down -v                 # reset, including the Postgres volume
docker compose --profile dev up        # Vite dev server with hot reload instead of the nginx image
```

Ports: frontend `:8080`, API `:8000` (browsable at `/api/`, admin at `/admin/`). `frontend` and `frontend-dev` share `:8080`, so only one runs at a time.

There is no `loaddata` step and no fixture: `seed_demo` (idempotent, keyed on pizza slug and username) runs after `migrate` in the api service's command chain. If it ever raises, the api never starts.

```bash
docker compose run --rm api uv run manage.py test
docker compose run --rm api uv run manage.py test delivery.tests.test_orders.OrderCreateTests
docker compose run --rm api uv run manage.py makemigrations
docker compose run --rm api uv run manage.py shell
```

Python dependencies are managed by uv: `pyproject.toml` + `uv.lock`, no `requirements.txt`. The venv lives at `/venv` (`UV_PROJECT_ENVIRONMENT`) because `/code` is bind-mounted and would shadow it. After changing `Dockerfile`, `pyproject.toml` or `uv.lock`, run `docker compose build api`. `uv` on the host is only for regenerating the lock file.

Frontend npm commands go through a container, e.g.

```bash
docker run --rm -v "$PWD/frontend:/app" -w /app node:22-alpine sh -c "npm ci && npm run build"
docker compose run --rm frontend-dev sh -c "npm install && npm test"
```

Config comes from environment variables (`.env.example` documents them all; Compose reads `.env` automatically). `settings.py` has development-friendly fallbacks for everything, so a missing variable degrades silently rather than erroring — check the env first when behavior looks wrong.

Tests: `delivery/tests/` (a package: `test_auth`, `test_pizzas`, `test_orders`, `test_seed`) is the regression net — run it after any change to models, serializers, permissions or settings. Vitest covers the cart reducer, `lib/pricing.ts` and `lib/dates.ts`. There is no linter or CI.

## Architecture

### The two-service split is the point

The API and the frontend are deliberately separate origins: the `api` and `frontend` containers. Consequences that keep mattering:

- **CORS is always live.** `CORS_ALLOW_ALL_ORIGINS` is on unless `CORS_ALLOWED_ORIGINS` is set. Don't "simplify" by making the frontend same-origin.
- **The frontend gets its API base at runtime**, from `window.PIZZA_API_URL` in `frontend/public/config.js`, loaded by a plain `<script>` in `index.html` before the bundle. `frontend/docker-entrypoint.sh` regenerates that file on container start from `API_URL` (nginx images run everything in `/docker-entrypoint.d/`), and nginx serves it `no-store`. Never use `import.meta.env` for the API URL — Vite would bake it into the bundle and break "one image, any API URL". Read it through `apiBase()` in `src/lib/config.ts`.
- Django serves no app templates. `STATIC_ROOT`/`collectstatic` exist only for the admin and the DRF browsable API.

### Data model

`Pizza` carries `slug` (the stable key the frontend's art recipes use — do not change it once orders reference it), `price`, `toppings`, `description`, `is_active`. Retiring a pizza sets `is_active=False`; it disappears from the menu but old orders still resolve.

`Order.pizzas` (an M2M) **no longer exists**. An order has `items` — `OrderItem` rows with:

- `slices`: a JSON list of exactly **eight pizza ids**, clockwise from twelve o'clock. Eight identical ids are a menu pizza; a mix is a custom pie.
- `quantity` (1–9), plus `unit_price` and `name` snapshots taken at order time so menu edits don't rewrite history.

Pricing rules live in `delivery/pricing.py` (`unit_price` = the priciest flavor, `item_name` = the flavor's name or "Your N-flavor pizza") because both the serializer and `seed_demo` need the same answers. `Order.recompute_total()` sums the lines and adds `settings.DELIVERY_FEE` (env-overridable, default 5.00) when the order is non-empty; the fee is not snapshotted per order, it is reported live as `delivery_fee`.

`Order.status` is a `TextChoices` pipeline: Ordered → In the oven → Out for delivery → Delivered. Nothing advances it server-side; staff do it in the admin, where `status` is in `list_editable`, and the tracking screen polls. The stored value equals its label on purpose, so `status` and `status_label` currently carry the same text — drive logic off `status`, display `status_label`.

Migration `0003` adds `OrderItem`, copies each old `Order.pizzas` row into an item with eight identical slices, then drops the M2M. Keep it working: an existing `pgdata` volume may still hold fixture-era rows.

### API routing — read and write are separate endpoints

`delivery/urls.py` registers the same `Order` model twice with **explicit, different basenames** (`order` and `order-new`). This is load-bearing: modern DRF raises `ImproperlyConfigured` on duplicate derived basenames.

| Route | ViewSet | Notes |
|---|---|---|
| `/api/pizzas/get/` | `PizzaViewSet` | **public read** (the menu and builder render signed out); writes are staff-only via `IsStaffOrReadOnly`; non-staff see only `is_active` rows |
| `/api/orders/get/` | `GetOrderViewSet` (read-only) | `GetOrderSerializer`; queryset is filtered to `request.user` (staff see all) |
| `/api/orders/new/` | `NewOrderViewSet` | create only — `CreateModelMixin + GenericViewSet`, no list/retrieve/update/delete |

There is no `/api/users/` any more, and no `UserSerializer`. Nothing needs it: `Order.user` is read-only and assigned in `perform_create` from `request.user`.

**Ownership is enforced by filtering the queryset, not by an object permission**, so someone else's order is a **404, never a 403** — order ids stay unenumerable. Tests assert this; don't "fix" it into a 403.

Clients POST pizza **ids inside `slices`**, not hyperlinks. The write shape is only `items`:

```json
{"items": [{"slices": [11, 11, 11, 11, 5, 5, 5, 5], "quantity": 2}]}
```

At most 20 items (`MAX_ITEMS`), and `NewOrderSerializer.validate` refuses a subtotal that would overflow the `Order.total` column, so an absurd staff-set price answers 400 rather than a 500 `DataError`. `user`, `status`, `total`, `unit_price` and `name` in the payload are read-only and silently ignored. `NewOrderViewSet.create` answers **in the read shape** (with `url` pointing at `order-detail`) so the frontend goes straight to the tracker with no second fetch.

Serializers keep `url` hyperlinked; everything else is plain. `OrderItemReadSerializer.get_flavors` caches the whole `id → name` catalog on `self.context` — `OrderReadTests.test_list_costs_the_same_number_of_queries_whatever_it_holds` asserts exactly 3 queries for a list, so never read a related row per item (the `OrderItem.flavors` model property does exactly that: fine in `seed_demo` and tests, not in a serializer).

### Auth

`djangorestframework-simplejwt`. `POST /api/auth/` returns `{"access", "refresh", "username", "is_staff"}`; `SIMPLE_JWT["AUTH_HEADER_TYPES"]` accepts both `Bearer` and the legacy `JWT`. Access lifetime 8 hours, refresh 1 day — a demo should not log itself out mid-sentence.

**Staff are refused a token.** `delivery/auth.py`'s `CustomerTokenObtainPairSerializer` (wired through `SIMPLE_JWT["TOKEN_OBTAIN_SERIALIZER"]`, so `urls.py` is untouched) raises `AuthenticationFailed("Staff accounts sign in at /admin/.")` for `is_staff` users. The frontend just displays the API's `detail`. Session auth for the admin and the browsable API is unaffected — that is how staff still see every order.

DRF defaults to `IsAuthenticated` globally, so every `/api/` endpoint except the pizza catalog needs a token.

### Frontend

React 19 + Vite + TypeScript under `frontend/`, hash-routed with `react-router` 7 (the package is `react-router`, not `react-router-dom`). Runtime dependencies are exactly `react`, `react-dom`, `react-router`: plain `fetch`, React context + `useReducer` for state, plain CSS. No axios, no query library, no CSS framework.

```
frontend/src/
  main.tsx      HashRouter, providers, routes, the layout (Header/Toast/MobileNav)
  api/          client.ts (auth header, one refresh on a 401 then #/signin?expired=1), pizzas, orders, auth
  state/        auth, cart, catalog, toast contexts (session + cart in sessionStorage)
  lib/          pizza-art.ts, pricing, geometry, fx, dates, config
  components/   Header, MobileNav, PizzaArt, StatusBadge, Tracker, Toast, RequireAuth
  pages/        Menu, Builder, Cart, SignIn, Orders, Order, About
  styles/       tokens.css (palette, keyframes, reduced-motion), neon.css (shared component
                classes), pages/<page>.css (imported by that page only)
```

Things that are decisions, not accidents:

- **Pizza art is keyed by slug.** `src/lib/pizza-art.ts` registers a `<pizza-art>` canvas custom element whose recipes are keyed by slug, with a cheese fallback for anything unknown, so a pizza added in the admin renders something. The API deliberately sends ids in `slices`; resolve them with `useCatalog().slugsFor(ids)` before handing them to `<PizzaArt>`. The same module owns `SWATCHES` / `swatchFor(slug)`, the per-pizza colour the fly animations use — the API sends no colour, so do not re-inline that map in a page.
- **Fonts are self-hosted** under `public/fonts/` (Unbounded + Rubik, variable woff2, latin) with `@font-face` in `public/fonts/fonts.css` linked from `index.html`. No CDN: the API is the only network call the app makes.
- **The header nav is Menu / Orders / About — no "Build your own" link.** The builder is reached from the menu hero, the dashed menu card and the cart's empty state; the mobile bottom nav mirrors the header exactly.
- Route `#/orders/:id?placed=1` is the celebration/tracking state (the old `#/orders/:id/:new` path segment redirects to it), and `#/new-order` redirects to `#/build`.
- The image is multi-stage: `node:22-alpine` builds, `nginx:1.27-alpine` serves `dist/`. `frontend/dist/` is gitignored.

### Seed data

`delivery/management/commands/seed_demo.py` creates the eleven pizzas (ids 1–11 in menu order on a fresh database), the demo customer `jklimber`, two other customers (`kimberly`, `carlos`, there to prove order isolation), an `admin` staff superuser, and jklimber's four past orders with `created_at` relative to now, so the "Today / Yesterday / Aug 30" dates never go stale. Usernames, passwords and the delivery fee come from settings, so `.env` can change them. Totals are always computed by `recompute_total()`, never hand-typed. Adding a demo order means adding it here, not a fixture.
