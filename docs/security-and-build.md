# Security, build and tests

Who may do what, the headers, the build and the test set-up. Part of the implementation notes: see the [README](../README.md#implementation-notes).

## Owner authorization

There is one authorization fact, the Firebase Auth custom claim `owner`, and both sides
read it:

- **Firestore** (`firestore.rules`) allows a write only on
  `request.auth.token.owner == true`.
- **The client** resolves the same claim through `useOwnerAuth` (`src/lib/useOwnerAuth.ts`),
  which `ActivityNotes` and `SettingsClient` both consume. It subscribes with
  `onIdTokenChanged` rather than `onAuthStateChanged`, so a token refresh that changes the
  claim is picked up, and it reads `getIdTokenResult()` without forcing a refresh — the
  callback only fires when there is a genuinely new token, so the cached one is always the
  current one.

`NEXT_PUBLIC_OWNER_EMAIL` is not part of that decision. It is provisioning input for
`npm run set-owner-claim`, which is what actually grants the claim. Comparing the email in
the browser was the previous UI gate and it drifted from the rules: an account whose email
matched but whose token carried no claim was shown the editor and then refused by Firestore
with a 403. An email is also not something the rules can read, and a claim survives an email
change, so the claim is the side that wins.

## Private site

With `RUNOMICS_PRIVATE=1`, `src/proxy.ts` puts every page and API route behind Google
sign-in (`src/lib/siteAccess.ts`). Only `/sign-in`, `/api/session` and `/api/internal/*` stay
open, and each internal route checks its own secret. `/api/session` verifies the Firebase ID
token once and sets a cookie signed with `SESSION_SECRET` (32 characters or more), valid for
30 days. After that, the proxy checks only the signature. The owner and the Google accounts
in `RUNOMICS_VIEWERS` (verified emails only) get in. If the site is private but has no usable
secret, nobody gets in.

`isSitePrivate()` defaults to off, so the demo builds without any setup. To make sure a real
athlete's site is never public by mistake, `npm run validate:data` (run by `prebuild`) fails
any Vercel build (`VERCEL=1`) that has `RUNOMICS_DATA_REPO_URL` set but is missing
`RUNOMICS_PRIVATE=1` or a 32-character `SESSION_SECRET`. On both athlete projects the three
variables are scoped to Production only, so Preview builds use the demo data. If you give
Preview the repository URL, give it the other two as well, or the build will fail.

## Firestore rules

`firestore.rules` gives every collection the phone touches to the owner alone (the server reads
and writes as admin, which the rules do not govern), and checks the shape of every write:

- `activityNotes` and `routeNames`: a note of 500 characters and 10 tags at most; a route name
  of 1 to 80 characters.
- `wellness/{date}`: one document per `YYYY-MM-DD`, with only `sleep`, `soreness`, `stress` and
  `mood` (integers 1-5), `ill` and `travel` (booleans) and a `niggle` (a known site, an optional
  side, pain 0-10, an optional `changesRun`). Read by the owner only: health data never reaches
  another viewer, and pages never server-render it.
- `avoidSpots`: Explore's spots to avoid, with `lon`, `lat`, an integer `radiusM` of 20-250, a
  `createdAt` date and an optional `reason` (`blocked`, `mud` or `unsafe`). Read by the owner only:
  they say where the athlete runs.
- `pushTokens/{token}`: the document's id is its token, with a `userAgent`, an `updatedAt` and
  optional `categories`, a map of `training`, `shoes` and `records` to booleans. Create, update
  and delete only; nothing on a phone reads the list.

**The rules are deployed by hand,** never with the app: after any change, run
`firebase deploy --only firestore:rules --project <id>` once per Firebase project (each
deployment has its own). Until then the old rules refuse the new writes: a check-in, or a phone
saving its push categories. `npm run test:rules` runs `src/infrastructure/__tests__/firestoreRules.test.ts`
against the Firestore emulator (Java 21), and CI runs it on every push and pull request.

## Content Security Policy

`next.config.ts` sets the CSP for every route. Each allowance is deliberate, and the
comment-free header is easy to widen by accident — this is what each one is for:

- **`script-src 'unsafe-inline'`** — Next.js needs it for its bootstrap scripts on SSG
  pages, which have no per-request nonce. `'unsafe-eval'` is added **in development
  only**, for react-refresh.
- **`script-src https://www.gstatic.com`** — `firebase-messaging-sw.js` `importScripts`.
- **`script-src https://apis.google.com`** — the gapi loader (`api.js`) that
  `signInWithPopup` needs for its `postMessage` relay. Without it the popup opens but the
  sign-in promise never resolves. This header is also served on the service-worker route,
  so both origins must be allowed there too.
- **`img-src https://api.maptiler.com`** — map sprites and raster images. `data:`/`blob:`
  are for MapLibre and the share-card canvas.
- **`connect-src`** — `*.googleapis.com` for Firestore/Auth/FCM, `api.maptiler.com` for
  styles, tiles and geocoding, `nominatim.openstreetmap.org` for share-card reverse
  geocoding, and `apis.google.com` for the gapi loader above.
- **`worker-src blob:`** — MapLibre spawns blob workers.
- **`frame-src`** — the Firebase Auth sign-in iframe (`*.firebaseapp.com`), the Google
  account chooser (`accounts.google.com`), and gapi's own relay iframes.

`object-src 'none'`, `base-uri 'self'`, `form-action 'self'` and `frame-ancestors 'none'`
are lockdowns with no exceptions; keep them that way.

A run's place name asks Nominatim about its first point rounded to 0.01° (about a kilometre),
never the point itself. Today's forecast is fetched by the server from Open-Meteo, at the runs'
median start rounded to 0.1°, so it needs no browser allowance, and its URL is never logged.

## Build configuration

The app version comes from `package.json` and is exposed as `NEXT_PUBLIC_APP_VERSION`, so
there is one source of truth for it.

`outputFileTracingIncludes` pulls `./data/**/*` into the server bundle explicitly. The
directory is read from the filesystem at request time (ISR revalidation, the API routes),
but its paths are built at runtime, so nothing links it into the traced module graph and
the deployment would otherwise ship without it.

`npm run analyze` opens a per-bundle treemap — worth checking when MapLibre or the Firebase
SDK creep upward.

**The build prerenders the newest 20 runs** (`generateStaticParams` in
`src/app/activities/[id]/page.tsx`), the ones opened most. Any other run renders on its first
visit and is then cached like them (ISR, an hour), and after a sync the server renders the newest
one itself (see [Reading the data at run time](data-and-sync.md#reading-the-data-at-run-time)).

Node is pinned to 24 in `.nvmrc`, which every workflow reads, and Vercel installs with `npm ci`
(`vercel.json`), from the lock file exactly.

ESLint's config re-declares `eslint-config-next`'s default ignores because overriding them
replaces the list wholesale. Beyond the defaults it skips `scripts/**` (Node utilities, not
part of the linted Next.js app) and `coverage/**`.

The two React hook rules are suppressed **per effect**, with a one-line
`eslint-disable-next-line` carrying its reason, never per file. A file-wide override also
exempts every hook written in that file later, which is exactly the code most worth
linting; the directive expires with the line it is attached to, and ESLint reports it as
an unused directive once the effect no longer needs it.

- **`react-hooks/set-state-in-effect`** — `ActivityListClient`, `AnalyticsClient` and
  `FirstLaunchHint` restore state from `localStorage`/`sessionStorage` once after mount. It
  has to be an effect rather than a state initializer: an initializer would differ from the
  server-rendered markup and trip a hydration mismatch. `ActivityListClient` additionally
  guards with a `hasRestored` ref and merges only into still-default values, so a restore
  can never clobber a user edit.
- **`react-hooks/exhaustive-deps`** — `AnalyticsClient` (one-time mount effect),
  `CelebrationOverlay`, `useMapRoutes` and `useShareCardMap` deliberately narrow their
  dependency arrays. These effects own imperative MapLibre/canvas resources whose teardown
  and rebuild is expensive; re-running them on every referenced value would recreate the map
  or the render on each parent render.

`ThemeToggle`, `AccentPicker` and `ThemeSegmented` needed no suppression at all: their
"have we hydrated yet?" flag is `useMounted` (`src/lib/useMounted.ts`), a
`useSyncExternalStore` whose server snapshot is `false` and whose client snapshot is `true`.
Same two-pass render as the `useEffect(() => setMounted(true))` it replaces — false through
the server render and the hydration render, true immediately after — but React's own idiom
for reading something outside React, so the rule has nothing to object to.

File-scoped overrides remain in `eslint.config.mjs` for two rules that really are about a
whole file:

- **`@typescript-eslint/no-explicit-any`** — `ActivityMap` builds MapLibre `interpolate`
  paint expressions, which are heterogeneous nested arrays that MapLibre's own types do not
  express usefully.
- **`@next/next/no-img-element`** — `ShareCardThumbnails` renders canvas-generated object
  URLs, which `next/image` cannot optimise.

If one of these files stops needing its exemption, drop it from the override list rather
than leaving the rule off for it.

## Test configuration

`vitest.config.ts` aliases `server-only` to an empty module: it throws unless resolved
through a react-server bundle, which is the point in the app and useless in tests — the
modules marked with it are exactly the ones the tests exercise directly. Coverage is scoped
to `lib`, `application`, `domain` and `components`; app-router pages and layouts are
exercised by the build, not by unit tests. `e2e/**` and `screenshots/**` are excluded
because they are Playwright specs with their own runner and their own `test`/`expect`.

`vitest.setup.ts` carries two environment workarounds:

- **`localStorage`** is reassigned from the underlying JSDOM instance. Node has had a
  built-in `localStorage` global since Node 22, and it shadows jsdom's implementation —
  Vitest only overrides globals it does not already find on `global`, so even
  `window.localStorage` resolves back to Node's broken stub.
- **`matchMedia`** is stubbed because jsdom does not implement it, and code reading
  `prefers-color-scheme` (such as `persistAccent`) would throw.

React Testing Library's automatic `afterEach` cleanup cannot register itself while Vitest
globals are disabled, so it is called explicitly — without it, renders leak across tests.

## End-to-end and screenshot runs

Playwright runs against a real production build (`next start`), not `next dev`: ISR/SSG
timing and cache headers differ enough to matter, and this matches what is deployed. The
server needs Firebase Admin credentials for the `runomics-dev` project to prerender
Firestore-backed pages. `PORT` comes from `.env.e2e` (3100) so a personal dev server left
running on 3000 does not collide with the suite's own build; both Playwright configs read
it, and the screenshot run can still be pointed elsewhere with `SCREENSHOT_BASE_URL`.

The suite also has an `iphone` project: `e2e/layout.spec.ts` alone, in WebKit at iPhone 16 Pro
size, walks every page, every tab of a run and every Analytics tab and period (a test per page
and per tab), and fails on a horizontal scroll or on text past its clipping box or the screen.
It runs with reduced motion, waits at most 3 s for the animations it can see to end (WebKit
stalls fades in rows it skips rendering), and blocks the service worker, whose registration
WebKit refuses on `localhost`.

The screenshot audit has its own config so it never runs as part of the e2e suite, or vice
versa. It captures through an iPhone 13 viewport (390×844 @3×) because the app is designed
phone-first, driven by Chromium rather than the preset's default WebKit, and pins
`locale: 'en-US'` so string-based waits behave regardless of the host. Set
`SCREENSHOT_BASE_URL` to shoot an already-running server or a deployed URL and skip the
build. Some managed CI environments pre-provision a Chromium whose build number differs from
the one this Playwright version would download (and downloads are blocked), so a
pre-installed binary at `/opt/pw-browsers/chromium` — or `PLAYWRIGHT_CHROMIUM_PATH` — is
launched directly when present.

Determinism comes from three things together: the theme and accent are seeded into
`localStorage` *before* any app script runs (layout's `beforeInteractive` script reads the
accent key and stamps `data-accent`, which the palette CSS keys off), the colour scheme is
emulated as a backup for `prefers-color-scheme` and the pre-hydration paint, and every
transition and animation is frozen with an injected stylesheet — otherwise the aurora
background, tab underline and page transitions make two runs of the same screen differ. The
default accent is the bare stylesheet, so the wait for it is on the *absence* of the
attribute.

Each screen is shot begin/middle/end (what a phone actually shows) plus one stitched
full-page frame; pages too short to scroll get only the full frame. Screens with an in-page
tab bar are walked tab by tab. Route IDs in `screenshots/routes.ts` are real ones from
committed data so detail pages prerender with content instead of 404ing. Accents come
straight from `@/lib/accent`, so a newly shipped accent is captured without a second list to
keep in sync. Both themes and accents default to the shipped-out-of-the-box look because the
full matrix is six times the work; `SCREENSHOT_THEMES` / `SCREENSHOT_ACCENTS` take `all` or
a comma-separated list.

## Client error reports

A phone's uncaught errors, unhandled rejections and route generator failures are posted to
`POST /api/client-errors` (at most 10 a page, deduplicated, 4 KB a report, 20 a minute per IP).
The page is sent as a path only and every number with three or more decimals is replaced by `#`,
so no coordinate leaves the device. Firestore `clientErrors` keeps the last 50; the owner reads
them under Settings → Diagnostics (`GET`, owner only). Each nightly sync calls
`POST /api/internal/client-error-check`, which pushes one digest of the errors since the last one
announced (Firestore `notifications/lastClientErrors`), never a push per error, since anyone may post one.

## Service worker

`public/sw.js` provides the offline app shell and push notifications.

- Hashed build assets (`/_next/static`) and icons are **cache-first** — they are immutable.
- Pages, RSC payloads and `/data` JSON are **network-first with cache fallback**, so the app
  opens with the last-seen content when offline; a failed navigation falls back to the
  cached shell. A navigation waits 3 s for the network before it opens the cached page, and
  navigation preload starts that request while the worker boots.
- `/api` and cross-origin requests (map tiles, analytics) are **never cached**.

Push events display FCM webpush payloads (`{ notification: { title, body } }`) directly, so
no separate `firebase-messaging-sw.js` is needed. A non-JSON push falls through to the
generic notification.

Bump `VERSION` to invalidate every cache on deploy of a breaking change.

Made with love
