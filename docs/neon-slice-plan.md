# Implementation plan: "Neon Slice" redesign

Source design: Claude Design project *Premium pizza customizer interface*, file
`Pizza Time - Neon Slice.dc.html` (plus the shared `pizza-app.js` and
`pizza-art.js`). Written 2026-09-09.

This plan covers three things at once, because they touch the same files:

1. Implementing the Neon Slice design in the frontend.
2. The API changes the design needs (custom pizzas, quantities, timestamps, a
   status pipeline, an eleventh pizza).
3. The security and demo requirements: customers only see their own orders,
   staff cannot use the frontend, a demo customer with a history of past
   orders, credentials shown on the sign-in screen. Plus moving Python
   dependency management to uv.

---

## 0. Decisions to make first (with recommendations)

Each of these changes the shape of the work. Recommended answers are marked;
everything below assumes them unless you say otherwise.

| # | Question | Recommendation |
|---|---|---|
| Q1 | **Keep AngularJS 1.5 or treat this as the framework rewrite?** AngularJS reached end of life on 2021-12-31; the vendored 1.5 build is from 2016 and gets no security fixes. | **Decided: rewrite in React 19 with Vite and TypeScript.** The Claude Design runtime is React underneath, so the artboard maps almost one to one onto components, and `pizza-art.js` works as a custom element in React 19 without a wrapper. Dependencies stay minimal: `react`, `react-dom`, `react-router` in hash mode, plain `fetch`, no state library. Bootstrap, jQuery and the vendored Angular files go away. |
| Q2 | **How do custom pizzas reach the API?** `Order.pizzas` is a plain many-to-many to `Pizza`. It cannot represent a multi-flavor pie, a quantity, or even two of the same pizza (the auto through table is unique on order and pizza). | **Add an `OrderItem` model** with a `slices` JSON list of exactly eight pizza ids, a `quantity`, and a snapshot `unit_price`. A menu pizza is eight identical slices. Price is the most expensive flavor, as the design says. Clients post pizza **ids** in `slices`, not hyperlinks; posting eight URLs per pizza is silly. CLAUDE.md gets updated to say so. |
| Q3 | **Who advances an order through Ordered, In the oven, Out for delivery, Delivered?** The design fakes it with a 3.5 second timer. | **Staff, in the admin.** Make status editable from the order list, and have the tracking screen poll its order every few seconds while it is not delivered. That gives a good live demo: change the status in one tab, watch the other tab react. Optionally add a `advance_orders` management command that moves every open order one stage, for demos where nobody wants to open the admin. Do not auto-advance server-side by default. |
| Q4 | **How does "staff cannot log into the frontend" get enforced?** | **At the token endpoint.** A custom `TokenObtainPairSerializer` refuses `is_staff` users with a clear message ("Staff accounts sign in at /admin/"). The frontend just displays the API's error text. Doing it only in the frontend would be decoration, since the API is the real surface. Session auth for the admin and browsable API is unaffected. |
| Q5 | **Fixture or management command for seed data?** The design's order list shows relative dates ("Today, 6:41 pm", "Yesterday", "Aug 30"). A fixture has fixed timestamps that go stale. | **An idempotent `seed_demo` management command** run automatically after `migrate` on boot. It creates the eleven pizzas, the demo customer, two other customers (to prove isolation), a staff superuser, and the demo customer's past orders with dates relative to now. Delete `initial_data.json` and the manual `loaddata` step. |
| Q6 | **Fonts: Google Fonts CDN or self-hosted?** The design loads Unbounded and Rubik from fonts.googleapis.com. | **Self-host** under `frontend/public/fonts/` (both are OFL-licensed). The project is Docker-only and vendors everything else; a CDN dependency would be the only network call the frontend makes besides the API. Latin subset, woff2 only, three weights of Unbounded and four of Rubik. |
| Q7 | **Pizza art keyed by id or by slug?** `pizza-art.js` keys its topping recipes by pizza id 1 to 11, which breaks the moment someone adds a pizza in the admin. | **Add a `slug` to `Pizza`** and key the recipes by slug, with a generic cheese fallback for unknown slugs. The frontend resolves ids to slugs from the catalog it already loads. |
| Q8 | **Order status filter for staff via the API?** With Q4, staff cannot get a token, so "staff see all orders" only matters through the browsable API with session auth. | Implement it anyway. It is one line in `get_queryset`, it matches the stated rule, and it keeps the browsable API useful for a logged-in admin. |
| Q9 | **Navigation.** The design's header has Menu, Build your own, Orders, About; the mobile bottom nav repeats the same four. | **Decided: drop "Build your own" from the header.** The builder stays reachable from the menu page's hero button and the dashed "Build your own" card, and from the cart's empty state. Assumption: the mobile bottom nav drops it too and becomes Menu, Orders, About, so the two navs stay identical. Say so if you want it kept on mobile. |

---

## 1. Problems found in the current code

These are worth fixing in the same pass. The first four are real
authorization holes, not just tidiness.

1. **Any customer can read, edit or delete any order.** `NewOrderViewSet` is a
   full `ModelViewSet`, so `/api/orders/new/<id>/` accepts GET, PUT, PATCH
   and DELETE for every order in the table. Restrict it to create only.
2. **Any customer can edit the menu.** `PizzaViewSet` is a `ModelViewSet`.
   Make it read-only for everyone except staff (staff edit pizzas in the
   admin anyway).
3. **Any customer can list every username** via `/api/users/`. Nothing in the
   frontend uses it since `Order.user` is assigned server-side. Remove it.
4. **The client sets the order total and status.** A customer can post
   `total: 0.01` or `status: Delivered`. The server must compute the total
   and force `Ordered` on creation.
5. **Access tokens expire after five minutes** (simplejwt's default) and the
   frontend never refreshes. The interceptor silently drops the token on 401,
   but the navbar still shows the user as signed in. Raise the lifetime for
   the demo and handle expiry visibly (redirect to sign-in with a message).
6. **Seed totals are inconsistent with the frontend's arithmetic.** Order 1 is
   two pizzas at 24.23 with no delivery fee; order 2 is one 11.00 Broccoli at
   22.00; order 3 has no fee either. Server-side totals fix this going
   forward, and the new seed command fixes the history.
7. **`Order.status` is free text.** Convert to `TextChoices` with the four
   stages from the design.
8. **The order route is odd**: `#/orders/:id/:new` uses a path segment as a
   flag. Replace with `#/orders/:id` and a `?placed=1` query parameter for
   the celebration state.
9. **`about.html` is a Wikipedia paste** with dozens of external links. The
   design replaces it with three cards about the project; use the README's
   history note.
10. **Order has no timestamp.** Add `created_at`; the orders list and detail
    both display it.
11. **The frontend framework is end of life.** AngularJS 1.5 with hand-vendored
    Angular, jQuery and Bootstrap. Replaced wholesale by the React rewrite in
    section 3; nothing under `frontend/static/js/` survives except
    `pizza-art.js`, which moves into the new source tree.

---

## 2. Backend

### 2.1 Dependencies: move to uv

- Add `pyproject.toml` with the runtime dependencies currently in
  `requirements.txt` (Django, DRF, simplejwt, cors-headers, psycopg, gunicorn)
  and `requires-python = ">=3.12"`.
- Generate and commit `uv.lock`. Delete `requirements.txt`.
- `Dockerfile`: base on `python:3.12-slim`, copy uv from the official
  `ghcr.io/astral-sh/uv` image, `uv sync --frozen --no-dev` into a project
  venv, run gunicorn from that venv. Keep `PYTHONUNBUFFERED`.
- Compose: the `api` command becomes `uv run manage.py migrate --noinput &&
  uv run manage.py seed_demo && uv run manage.py runserver 0.0.0.0:8000`.
  The bind-mounted `/code` volume stays; put the venv outside it (set
  `UV_PROJECT_ENVIRONMENT=/venv`) so the host checkout does not shadow it.
- README and CLAUDE.md commands change from `python manage.py` to
  `uv run manage.py` inside the container, and mention `uv sync` for anyone
  running outside Docker.

### 2.2 Models (`delivery/models.py`) and one migration

```
Pizza
  name         CharField(30)               unchanged
  slug         SlugField(unique)           new (Q7); recipes and art key on this
  price        DecimalField                unchanged
  toppings     CharField(120)              new; the design's "tops" line, e.g. "jalapeño · corn · beef · red pepper"
  description  CharField(160)              new; the design's one-liner
  is_active    BooleanField(default=True)  new; lets staff retire a pizza without breaking old orders

Order
  user         FK User                     unchanged
  status       CharField(choices=Status)   Ordered / In the oven / Out for delivery / Delivered
  total        DecimalField                unchanged column, now server-computed
  created_at   DateTimeField(auto_now_add) new
  pizzas       M2M Pizza                   REMOVED after data migration into OrderItem

OrderItem
  order        FK Order (related_name="items")
  slices       JSONField                   list of exactly 8 pizza ids
  quantity     PositiveSmallIntegerField(default=1)
  unit_price   DecimalField                snapshot of max(price of slice flavors) at order time
  name         CharField(60)               snapshot: "Broccoli" or "Your 3-flavor pizza"
```

Helpers on the models: `OrderItem.flavors` (distinct pizzas, in slice
order), `OrderItem.is_custom` (more than one distinct flavor),
`Order.recompute_total()` (sum of `unit_price * quantity` plus
`settings.DELIVERY_FEE`).

Migration 0003 does three things in order: add the new columns with
temporary defaults, copy each existing `Order.pizzas` row into an `OrderItem`
with eight identical slices, then drop `Order.pizzas`. Slugs for existing
pizzas are derived from `name`. Because Q5 replaces the fixture, the data
migration only matters for databases that already exist; keep it anyway so
`docker compose up` on an old volume does not fail.

`DELIVERY_FEE = Decimal("5.00")` lives in `settings.py` (env-overridable,
default 5). The frontend keeps its own constant for the cart preview; the
server value is authoritative and comes back in every order response as
`delivery_fee`.

### 2.3 Serializers (`delivery/serializers.py`)

- `PizzaSerializer`: `id, slug, name, price, toppings, description, url`.
- `OrderItemReadSerializer`: `name, slices, flavors (list of names), quantity,
  unit_price, line_total, is_custom`.
- `GetOrderSerializer`: `id, user (username), status, status_label,
  created_at, items, delivery_fee, total, url`. Stays hyperlinked for `url`.
- `OrderItemWriteSerializer`: `slices` (exactly eight ids, every id an active
  pizza) and `quantity` (1 to 9). Computes `unit_price` and `name`.
- `NewOrderSerializer`: accepts only `items` (at least one). `user`,
  `status`, `total`, `created_at` are all read-only. `create()` builds the
  items and calls `recompute_total()` inside a transaction. Response body is
  the read shape, so the frontend can go straight to the tracking screen.
  Keep `url` pointing at `order-detail` as today.
- Drop `UserSerializer`.

### 2.4 Views and permissions (`delivery/views.py`, `delivery/permissions.py`)

- `IsStaffOrReadOnly` permission: safe methods for anyone authenticated,
  writes for `is_staff` only. Applied to `PizzaViewSet`, whose queryset also
  filters `is_active=True` for non-staff.
- `GetOrderViewSet.get_queryset()`: `Order.objects.all()` for staff, else
  `filter(user=request.user)`. Non-owners get a 404 on detail, not a 403, so
  order ids are not enumerable. `select_related("user")` and
  `prefetch_related("items")`.
- `NewOrderViewSet` becomes `mixins.CreateModelMixin + GenericViewSet`. No
  list, retrieve, update or delete. `perform_create` unchanged.
- Remove `UserViewSet` and its router registration. Remove `/api/users/`
  from the README table.
- Keep the two order basenames (`order`, `order-new`) exactly as CLAUDE.md
  explains.

### 2.5 Auth (`delivery/auth.py`, `settings.py`)

- `CustomerTokenObtainPairSerializer.validate()`: after the parent validates
  credentials, raise `AuthenticationFailed("Staff accounts sign in at
  /admin/.")` when `user.is_staff`. Register it through
  `SIMPLE_JWT["TOKEN_OBTAIN_SERIALIZER"]`, so `delivery/urls.py` does not
  change.
- Add `username` and `is_staff` to the token response so the frontend does
  not have to store what the user typed. (`is_staff` will always be false
  for a successful login; it is there for the refresh path and for clarity.)
- `ACCESS_TOKEN_LIFETIME` 8 hours, `REFRESH_TOKEN_LIFETIME` 1 day. A demo
  session should not log itself out mid-sentence. Keep the `/auth/refresh/`
  endpoint; the frontend uses it once on a 401 before giving up.
- Keep both `Bearer` and `JWT` header prefixes.

### 2.6 Seed command (`delivery/management/commands/seed_demo.py`)

Idempotent: keyed on pizza slug and username, safe to run on every boot.
Prints what it created and what it skipped.

- Eleven pizzas with slug, price, toppings and description copied from
  `pizza-app.js` (`Pepperoni` at 12.23 is the new one).
- Users: `jklimber / start123` (the demo customer), `kimberly` and `carlos`
  (customers whose orders must never appear for jklimber), and `admin /
  admin123` as staff superuser. Passwords and usernames come from settings
  with these defaults, so `.env` can change them.
- Orders for jklimber, created only if jklimber has none, with `created_at`
  set relative to now:
  - 9 days ago, Delivered: Capricciosa, Vegetarian.
  - 4 days ago, Delivered: a custom half Pepperoni / half Funghi and one
    Cheese, quantity 2.
  - Yesterday, Delivered: Broccoli.
  - Today, Out for delivery: a four-flavor custom (Pepperoni, Prosciutto,
    Broccoli, Mexican), which is the pie the design's "Build your own"
    card shows.
- One order each for kimberly and carlos, matching the design's seed rows.
- Totals computed by `recompute_total()`, never hand-typed.

Delete `delivery/fixtures/initial_data.json`; `FixtureTests` becomes
`SeedCommandTests` (see section 4).

### 2.7 Admin (`delivery/admin.py`)

- `PizzaAdmin`: list `name, slug, price, is_active`; `prepopulated_fields`
  for slug; `list_editable` on price and `is_active`.
- `OrderAdmin`: list `id, user, status, total, created_at`, with `status`
  in `list_editable` so a demo can advance orders from the list page.
  `OrderItemInline` (read-only fields, no add) so staff can see what was
  ordered. `date_hierarchy = "created_at"`.
- Optional (Q3): `advance_orders` management command that moves every
  non-delivered order one stage forward.

### 2.8 Settings and env

- `DELIVERY_FEE`, `DEMO_USERNAME`, `DEMO_PASSWORD`, `ADMIN_USERNAME`,
  `ADMIN_PASSWORD` in `settings.py` with `.env.example` entries.
- Nothing else in settings needs to change for the design.

---

## 3. Frontend (React 19, Vite, TypeScript)

The frontend is rewritten from scratch under `frontend/`. It stays a
separate container and a separate origin, hash-routed, and still reads its
API base from `window.PIZZA_API_URL` at runtime. AngularJS, jQuery and
Bootstrap are deleted along with the old `static/` tree.

### 3.1 Toolchain and dependencies

- `npm create vite@latest` with the `react-ts` template, then trim it.
- Runtime dependencies: `react`, `react-dom`, `react-router` (using
  `HashRouter`). That is the whole list. Data fetching is plain `fetch` in
  one API module; app state is React context plus `useReducer`; styling is
  plain CSS files. No axios, no TanStack Query, no Tailwind, no state
  library. Add any of them later only if a concrete need shows up.
- Dev dependencies: `vite`, `@vitejs/plugin-react`, `typescript`. Vitest
  and React Testing Library are worth adding for the cart reducer and the
  builder pricing logic; see section 4.
- Commit `package-lock.json`. Node 22 LTS in the Docker build stage.

### 3.2 Runtime configuration

Vite bakes `import.meta.env` values in at build time, which would break the
"one image, any API URL" rule. Keep the current mechanism instead:

- `frontend/public/config.js` sets `window.PIZZA_API_URL` and is loaded by a
  plain `<script src="/config.js">` tag in `index.html`, before the bundle.
- `frontend/docker-entrypoint.sh` regenerates that file from `API_URL` on
  container start, exactly as today, and `nginx.conf` keeps the `no-store`
  header on it (path changes from `/static/js/config.js` to `/config.js`).
- A typed accessor `apiBase()` in `src/api/client.ts` reads it, with a
  `localhost:8000` fallback for `vite dev`.

### 3.3 Docker and Compose

- `frontend/Dockerfile` becomes multi-stage: `node:22-alpine` runs
  `npm ci` and `npm run build`; `nginx:1.27-alpine` copies `dist/`, the
  nginx config and the entrypoint. The final image is the same size and
  shape as today.
- `docker-compose.yml`: the `frontend` service is unchanged for normal use.
  Add a `frontend-dev` service under a `dev` profile that runs
  `npm run dev -- --host --port 8080` from the bind-mounted source, so
  `docker compose --profile dev up` gives hot reload without an image
  rebuild. The two services share the port, so only one runs at a time.
- `frontend/.dockerignore` adds `node_modules` and `dist`.

### 3.4 Source layout

```
frontend/
  index.html                  loads /config.js, fonts CSS, then the bundle
  public/config.js            runtime API base (regenerated in the container)
  public/fonts/               Unbounded 500/700/900, Rubik 400/500/600/700, woff2 (Q6)
  src/
    main.tsx                  HashRouter, providers, routes
    styles/
      tokens.css              palette, fonts, keyframes, reduced-motion guards
      neon.css                component classes ported from the design's inline styles
    api/
      client.ts               apiBase(), request() with auth header, 401 refresh-then-signout
      pizzas.ts               listPizzas()
      orders.ts               listOrders(), getOrder(), createOrder()
      auth.ts                 obtainToken(), refreshToken(), Token types
    state/
      auth.tsx                AuthProvider: token pair + username in sessionStorage, signIn/signOut
      cart.tsx                CartProvider: reducer ported from pizza-app.js, persisted in sessionStorage
      catalog.tsx             CatalogProvider: pizzas loaded once, byId/bySlug/slugsFor
      toast.tsx               ToastProvider + <Toast/>
    lib/
      pizza-art.ts            the custom element, keyed by slug (Q7)
      pricing.ts              DELIVERY_FEE, priceForSlices(), itemName()
      geometry.ts             the eight wedge clip-paths and spin math
      fx.ts                   bump(), fly(), tilt handlers
      dates.ts                relativeDate(): "Today, 6:41 pm", "Yesterday", "Aug 30"
    components/
      Header.tsx              brand, nav (Menu, Orders, About), sign-out, cart button
      MobileNav.tsx           fixed bottom nav (Menu, Orders, About), shown under 760px by CSS
      PizzaArt.tsx            thin typed wrapper around <pizza-art>
      PizzaCard.tsx           menu card
      StatusBadge.tsx
      Tracker.tsx             four-step progress
      RequireAuth.tsx         route guard, redirects to /signin?next=
    pages/
      Menu.tsx  Builder.tsx  Cart.tsx  SignIn.tsx  Orders.tsx  Order.tsx  About.tsx
```

### 3.5 Styling

`tokens.css` holds the palette as custom properties on `:root` (`--bg
#1a0b2e`, `--panel #241040`, `--ink #f6f0ff`, `--lime #c6ff3d`, `--magenta
#f93cf0`, plus the repeated ink alphas), the `@font-face` rules, and the
keyframes `enter`, `float`, `slowspin`, `orbit`, `neonpulse`, `toastin`,
`flicker` copied verbatim, wrapped in a `prefers-reduced-motion` guard for
the continuous ones. `neon.css` turns the design's inline styles into
classes; `style-hover`, `style-active` and `style-focus` become `:hover`,
`:active` and `:focus-visible`. Component classes: `.btn-lime`,
`.btn-magenta`, `.btn-ghost`, `.pill`, `.panel`, `.card`, `.field`,
`.badge-status`, `.toast`, `.mobile-nav`.

### 3.6 Pizza art

`pizza-art.js` is copied from the design into `src/lib/pizza-art.ts` with
one change: `RECIPES` is keyed by slug (`cheese`, `mexican`, `marinara`,
`prosciutto`, `funghi`, `napoletana`, `broccoli`, `portuguesa`,
`capricciosa`, `vegetarian`, `pepperoni`), the `slices` attribute takes a
comma-separated list of slugs, and an unknown slug falls back to the cheese
recipe. React 19 sets attributes on custom elements correctly, so
`<PizzaArt slices={slugs} theme="neon" cuts />` is a five-line wrapper that
joins the array and declares the JSX type.

### 3.7 State

- **Auth** (`state/auth.tsx`): stores `access`, `refresh`, `username` from
  the token response, not the typed username. `signIn` surfaces the API's
  error text so the staff refusal message shows. The API client tries one
  refresh on 401; on failure it clears the session and navigates to
  `/signin?expired=1&next=<current>`.
- **Cart** (`state/cart.tsx`): the reducer from `pizza-app.js`. Items are
  `{key, kind, name, detail, unitPrice, quantity, slices: number[]}`.
  Actions `addMenu`, `addCustom`, `inc`, `dec`, `remove`, `clear`; selectors
  `count`, `subtotal`, `total` (adds the fee when non-empty); `toPayload()`
  yields `{items: [{slices, quantity}]}`. Persisted to `sessionStorage` so
  the sign-in redirect does not lose it.
- **Catalog** (`state/catalog.tsx`): loads `/api/pizzas/get/` once after
  sign-in state is known (the endpoint requires a token; see the note in
  3.9), caches, exposes `byId`, `bySlug`, `slugsFor(ids)`.
- **Builder** state (`slices`, `brush`, `recent`, `rotation`) is local to
  the Builder page and resets on navigation, as in the design.

### 3.8 Routes

| Route | Page | Auth |
|---|---|---|
| `#/` | Menu | no |
| `#/build` | Builder | no |
| `#/cart` | Cart | no |
| `#/signin` | SignIn | no |
| `#/orders` | Orders | yes |
| `#/orders/:id` | Order (detail and tracking) | yes |
| `#/about` | About | no |

`RequireAuth` wraps the two order routes and redirects to
`/signin?next=<route>`. The tracking state is `#/orders/:id?placed=1`: same
page, celebration header and the four-step tracker shown, polling every
five seconds until the status is Delivered. The old `#/new-order` and
`#/orders/:id/:new` paths redirect to `/build` and `/orders/:id`.

### 3.9 Screens

- **Header / MobileNav**: brand with the flicker animation; nav links
  **Menu, Orders, About** (Q9: no "Build your own"); "username · sign out"
  when signed in; the lime "Order" button with the cart badge. Active link
  from `useLocation()`. The bottom nav is shown under 760px by a media
  query, not a resize listener.
- **Menu**: hero with the spinning pizza art and the two calls to action
  ("Build your pizza", "See the menu"); the catalog grid with `P{{id}}`
  labels, art, name, toppings, price and an Add button that dispatches
  `addMenu`, shows a toast and runs the badge bump and fly animation; the
  dashed "Build your own" card last. These two entry points plus the cart's
  empty state are how users reach the builder now. The "11 pizzas · $5
  delivery" line reads its count from the catalog.
- **Builder**: eight wedge buttons using the clip-paths from `geometry.ts`,
  pointer-drag spin with inertia, brush palette with per-flavor counts,
  presets (whole, half and half, quarters, start over), live price as the
  max flavor price, breakdown line, and the Add button disabled with "N
  slices to go" until all eight are filled.
- **Cart**: empty state with "Browse the menu" and "Build your own"; item
  rows with art, name, detail, quantity stepper, line total; summary with
  pizzas, delivery, total; "Place the order". Signed out, it navigates to
  `/signin?next=/cart&place=1` and shows "You'll sign in on the next step."
- **SignIn**: the card from the design; the line `Demo login: jklimber /
  start123` comes from a `DEMO_LOGIN` constant in `lib/pricing.ts` (rename
  to `lib/config.ts`); the error line shows the API's message; the button
  reads "Sign in & place order · $total" when `place=1` and the cart is
  non-empty, otherwise "Sign in". On success with `place=1` it posts the
  order and lands on `/orders/:id?placed=1`; otherwise it follows `next`
  or goes to the menu. `expired=1` shows "Your session expired, sign in
  again."
- **Orders**: rows from `/api/orders/get/` (already filtered server-side),
  stacked art thumbnails, username, "N pizzas · when", total, status badge.
- **Order**: back link, username and date, status pill, item rows, total
  including delivery, and the tracker when `placed=1` or the order is not
  yet delivered. Not-found state for ids that 404.
- **About**: the three cards; API base from `apiBase()`, demo login from
  the constant.

Catalog note: `/api/pizzas/get/` requires a token today, but the design's
menu and builder are public pages. Make `PizzaViewSet` readable without
authentication (`IsAuthenticatedOrReadOnly` combined with the staff-only
write rule from 2.4) so the menu renders before sign-in. Add this to the
tests in section 4.

## 4. Tests (`delivery/tests.py`, split into a `tests/` package)

Run with `docker compose run --rm api uv run manage.py test`.

- `AuthTests`: existing five, plus `test_staff_cannot_obtain_token`
  (401 with the staff message), `test_token_response_includes_username`.
- `PizzaTests`: anonymous and customer GET work; customer POST, PUT,
  DELETE are 403; staff POST works; inactive pizzas hidden from customers.
- `OrderCreateTests`: menu pizza order computes total as price plus fee;
  custom pizza priced at max flavor; quantity multiplies; `total`,
  `status` and `user` in the payload are ignored; fewer or more than eight
  slices is 400; unknown or inactive pizza id is 400; empty items is 400;
  response is the read shape with `items`.
- `OrderOwnershipTests`: customer list contains only own orders; other
  customer's detail is 404; staff list contains all; `/api/orders/new/`
  rejects GET, PUT, PATCH, DELETE with 405.
- `OrderReadTests`: item names, flavor names, `created_at`, `delivery_fee`,
  `status_label` present.
- `SeedCommandTests`: command creates eleven pizzas, demo user can log in,
  demo user has four orders, running it twice creates nothing new, the
  staff user cannot log in through `/api/auth/`.
- `MigrationTests` (optional): apply 0002 on a test database, insert an
  order with two pizzas, migrate forward, assert two `OrderItem` rows.

Frontend: Vitest unit tests for the cart reducer (`state/cart.tsx`),
`pricing.ts` (max-flavor pricing, item naming, fee handling) and
`dates.ts`. Screens are verified by hand with the checklist in section 6.

---

## 5. Documentation

- `README.MD`: uv commands, new endpoint table (no `/api/users/`, new
  order payload shape), seed command replaces `loaddata`, both demo logins
  (customer and admin), the "staff use the admin only" rule, the status
  pipeline and how to advance it.
- `CLAUDE.md`: uv, `OrderItem` and the ids-in-`slices` convention,
  ownership rule in `GetOrderViewSet`, the staff token refusal, seed command
  on boot, the React and Vite frontend (source layout, runtime `config.js`,
  multi-stage image, `dev` profile), pizza-art keyed by slug, fonts
  self-hosted. Remove the "Still legacy" section.
- `.env.example`: `DELIVERY_FEE`, demo and admin credential variables.

---

## 6. Order of work and verification

One feature branch, commits in this order so the suite is green after each
step. The old frontend breaks at step 3 (the order payload changes); that
is acceptable because step 5 replaces it, but do the backend and frontend in
the same PR for that reason.

1. **uv migration** (2.1). Verify: `docker compose up --build` still boots,
   tests pass.
2. **Models, migration, seed command, admin** (2.2, 2.6, 2.7). Verify:
   `migrate` on a fresh volume and on the old fixture-loaded volume both
   succeed; `seed_demo` twice is a no-op the second time; admin shows
   items inline.
3. **Serializers, views, permissions, auth** (2.3 to 2.5), with the tests
   from section 4. Verify: full suite green; `curl` as jklimber sees four
   orders, as kimberly sees one, admin login at `/api/auth/` is refused.
4. **Frontend foundation** (3.1 to 3.8): Vite project, Docker stages,
   runtime config, tokens and component CSS, fonts, pizza-art, API client,
   providers, routes, header and mobile nav. Verify: `npm run build`
   succeeds, app loads with no console errors, art renders for all eleven
   slugs, sign-in and sign-out work, expired token redirects.
5. **Screens** (3.9), in this order: menu, cart, sign-in, orders, order
   detail and tracking, builder, about. The builder is last because it is
   the largest and nothing else depends on it.
6. **Docs** (section 5).

Manual checklist before merging:

- Fresh `docker compose down -v && docker compose up --build` reaches the
  menu at `:8080` with eleven cards and no manual seed step.
- Sign in as `jklimber / start123` from the sign-in screen; the credentials
  are printed on that screen.
- Orders shows exactly four orders with dates relative to today.
- Sign in as `kimberly / start123`; Orders shows one order, and opening
  `#/orders/<one of jklimber's ids>` shows a not-found state.
- Sign in as `admin / admin123` on the frontend; the form shows the staff
  message and nothing is stored. The same credentials work at `/admin/`.
- Build a four-flavor pizza, add it, add a menu pizza with quantity 2,
  place the order while signed out; sign in on the next screen and land on
  the tracker. Change the status in the admin; the tracker updates within
  five seconds without a reload.
- Resize below 760px: bottom nav appears, header nav hides, cards stack.
- `docker compose run --rm api uv run manage.py test` passes.

---

## 7. Deliberately out of scope

- Pagination, search, or a pizza detail page. The catalog is eleven items.
- Customer self-registration and password reset. Accounts are seeded or
  created in the admin.
- Real-time updates via websockets. Polling on one screen is enough for a
  demo.
- The other two design directions in the same project (Night Oven, Milan
  Editorial). The CSS is written so that swapping the palette and fonts is
  contained to `tokens.css` and `neon.css`, but nothing else is shared.
- Server-side rendering, a Node backend, or moving the frontend behind the
  Django origin. The two-container split stays.
