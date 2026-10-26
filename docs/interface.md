# Interface

Charts, colour, maps, Explore and the share card, and the browser behaviours the UI works around. Part of the implementation notes: see the [README](../README.md#implementation-notes).

## Charts

**Weeks with no running still get a row.** The weekly series holds only weeks with runs, so
`weekRows` lays out every week of the window and gives a missing one 0 km — for a volume chart a
week at 0 km is a reading, not a missing value, and usually the most informative one on the chart.

Other chart decisions worth keeping:

- The last week of the weekly distance chart is a week still being run, so its short bar is not a
  real drop and is outlined and labelled "this week" rather than left to imply a finished week.
- **Every chart is hand-drawn SVG,** with no chart library: the last one, the similar runs'
  line, dropped about 100 KB from a run's page. An SVG has no semantics of its own, so a screen
  reader announces nothing or reads scattered tick and label nodes piecemeal. So the SVG is hidden
  from assistive tech and the chart reaches it as text: `ChartFigure` (a run's charts, the similar
  runs) makes it one `img`-role element with a summarising sentence, the WCAG text-alternative
  pattern; an Analytics card's own written sentence says what its chart shows.

## Colour system

`lib/palette` is the one place raw hex literals may exist. `lib/themeTokens` holds anything a
stylesheet can reach, so it stays accent- and theme-aware; `lib/colors` holds the semantic sets
CSS cannot reach — inline SVG attributes that need real strings, MapLibre paint properties, and the
share-card canvas.

**What follows the accent picker and what does not.** Form (TSB), weekly volume and the long-run
bar come from `useAccentUiColor()` — they are the "this is your headline number" marks. Everything
in `CHART_COLORS` is categorical or semantic and stays put. Readiness tone, pace-route, heat-route
and temperature ramps are all deliberately accent-independent: how often a stretch was run, or how
hot it was, is a property of the data, not a theme choice, so the map must not repaint when the
accent changes. Brand tints (season headline, race footer) stay emerald so they remain the brand's
voice rather than the athlete's chosen tint.

- `useAccentUiColor()` is for marks that must repaint with accent-coloured chrome around them.
  `useAccentChartColor()` is its multi-series variant: red-adjacent accents that would collide with
  Fitness/Fatigue/HR fall back to brand emerald. The picker's own swatch hue is neither.
- Three HR-zone ramps exist because they answer different questions against different backdrops.
  Z4 orange500 and Z5 red500 collapse into one hue at donut-slice size on the near-black canvas, so
  the dark ramp lifts them apart. The Athlete card's headline zones sit a step more saturated
  because they are small text on a near-opaque tile rather than filled chart marks.
- Training *status* and training *plan phase* have separate ramps on purpose: one is a reading of
  what happened, the other is intent.
- `BOOT_COLORS` serves surfaces that render before, or entirely without, `globals.css` — the PWA
  launch screens and the root error boundary — so they carry their own deep-navy scheme.
- The iOS `theme-color` metas read `STATUS_BAR_COLOR` from `themeTokens`, which is
  `SURFACES.light/dark.background` - the same table `globals.css` was generated from - so the
  status bar can never drift from the canvas (F15). The installed app keeps
  `statusBarStyle: 'default'` in both themes: an opaque bar in exactly that colour, dark text in
  light and white in dark, with the page meeting it in `--background` alone (the edge sampler, the
  aura clear under it). `black-translucent` would let dark run under the notch, but it always
  draws white text, unreadable on the light Aura, and the style can't be split per theme: its meta
  takes no media query and iOS reads it once, at install.
- `statusColors` is for statuses with universal meaning (success, in-progress, pending, warning,
  danger). Accent-coloured elements — nav, CTAs, progress bars — stay in accent.
- Elevation uses `roRust` rather than stone-500, which read as grey in the categorical set.
- **Chart data colours (3.0.1).** A run's chart lines are fixed hues in `RUN_CHART_LINE`, never
  the accent: heart rate `#ff6b6b`, pace cyan `#4cc9f0`, cadence the quality purple, elevation the
  grey fill. An accent-tied pace line repainted with the user's theme and clashed with the route
  and the active tab. The red sits close to the error red, so it is kept to chart lines and their
  scrub dots - never text, never a badge. Overview's pace/heart-rate preview reads the same table
  and carries a "Pace · HR" legend.
- **Plan's day selector (3.0.1).** Two outlines, two meanings: a mint outline is *today*, a grey
  outline is the *selected* day. A day can carry both, and today is selected by default.

## Maps

**The heat layer counts frequency per grid cell but renders the original, unsnapped GPS trace,**
so the line follows the real road instead of zig-zagging between grid nodes, matching the
single-activity map. A route splits into a new feature only where it crosses into a cell with a
different count, so colour and width follow real density instead of alternating between overlapping
"rare" and "frequent" copies of the same street. Counting dedups within a route first, so a slow,
densely-sampled stretch of one run cannot inflate its own count. The grid is shared with route
matching (similar runs) so "same street" means the same thing everywhere — it only bins, and never
moves a coordinate.

Breakpoints are spaced **geometrically** (a log scale). Run frequency is heavily right-skewed — a
handful of home streets are run 100+ times while most stretches are run once or twice — so a linear
scale would pin almost everything at the cool end.

World-view bubbles scale radius with `sqrt(count)`, because humans read bubble charts by **area**: a
zone with 4× the runs should look 4× the weight, not 4× the diameter. A floor keeps single-route
zones tappable, and markers are added smallest-first so busier zones stack on top instead of being
buried under one-off bubbles.

**Loading:** nothing of the map travels with the Activities list. When the map opens it fetches
`/api/map/shell` (the runs and areas) and then each area's tracks from
`/api/map/routes?cluster=N&enc=p5`, each track a Google encoded polyline at 1e-5° (about 1 m), so
the home area travels as about 160 KB gzipped instead of 570 KB; without `enc` it still answers
coordinate arrays. Both URLs carry the data version (`v=`, a hash of the routes): an answer to the
current version is cached `private, immutable` for a year, anything else is revalidated, so the
phone keeps its tracks until the next sync and never shares them with a CDN. Each answer and ETag
are built once per data generation, and the page keeps what it fetched per data version, so
going back from List to Map fetches nothing, and MapLibre's workers stay warm between maps.

**The heat map draws simplified tracks; Districts counts the recorded ones.** With `draw=1` each
track is simplified by Douglas-Peucker to within 3 m of the recording, about a fifth of its
points, finer than a heat stroke shows. Coverage counts 150 m cells along the track, and a
simplified line could cut a corner into the next cell, so Districts and the route generator fetch
the full tracks. The heat redraws only for a new view or new tracks, strokes only the tracks whose
bounds meet the view, frames the area with the server's frame when no filter hides a run, and its
basemap loads no sprite: no heat layer draws an icon.

## Explore

Explore is a layer of the Activities map, not a tab: the layers button above the ⓘ switches Heat
↔ Districts (remembered in `localStorage`), Expand shows every quartier, a tap opens a quartier's
sheet, and "Plan a run" opens the route generator. Plan's session cards ("Find a route") and
Progress's Explored card link into it.

**Boundaries are built offline into the data repo**, never at deploy time (Overpass is slow and
flaky, and a failed fetch must not block a sync deploy): `npm run explore:areas [-- --cluster N]
[--insee <code>] [--data-dir <dir>] [--refresh]` writes `explore/<id>.geojson` and
`explore/index.json` into `RUNOMICS_DATA_DIR`. The city is the most populous commune the home
cluster's frame touches; its quartiers come from OpenStreetMap `admin_level=10`, else the city's
open data (`scripts/explore/cities.ts`, Metz's WFS), else IGN IRIS, else the commune itself; every
other commune the frame touches is one whole unit. Shapes are simplified to 5 m. Nothing real is
committed to this repo, and the median start is computed in memory and never sent anywhere.

**Coverage** runs in a Web Worker (`src/components/explore/explore.worker.ts` over the pure
`src/domain/explore/*`). Each track is projected to metres about the area's public origin,
interpolated so samples are at most 75 m apart (a step over 300 m is a dropout and
is left open), and binned into 150 m cells. A unit's denominator is its *runnable* cells - those
holding an OpenStreetMap footway, path, track or street, precomputed by the build - so rivers, rail
and woods never count as unexplored. `pct = floor(100 · visited / runnable)`: complete at 90 %, fog
under 15 %. Km run are credited to the unit owning each step's midpoint. The area file and each
run's cells are cached in IndexedDB, keyed by area version and a fingerprint of the track.

**Next quartier:** the nearest incomplete unit with at least 5 runnable cells and at most 5 km from
home, so the quartiers around home are finished before the next ring out: an untouched quartier
beats a half-done one farther away. Quartiers go before neighbouring communes; labels within 100 m
count as the same distance, and then the more explored goes first, then the name. With none in
range, the nearest incomplete unit of all.

**Routes:** `POST /api/explore/route` calls OpenRouteService (`foot-walking`) once per seed, five
seeds a batch. The panel's **Start** picks where the loop begins:

- **Map point** (the default) waits for a tap on the map. The worker plans the loop on the device:
  from the tapped point, through two unexplored runnable cells of the quartier (one may lie outside
  it when the quartier is too small for the distance), and back, chosen per seed so the straight
  lines add up to the distance over a 1.3 street detour. Each seed is one directions request
  through those points. When no loop of the distance reaches the quartier, the panel names the
  shortest that does.
- **Quartier** starts at the centre of the quartier's runnable cell nearest its public label point,
  with a `round_trip` of 4 points, re-asked once when it misses the distance by more than 15 %.

The device's position is never read: the loop starts exactly at the tapped point. The vias the
worker picks are never closer than 600 m to home (the median start of the runs, kept on the
device). The key stays on the server; on a private site any signed-in session may call
it, on a public one only the owner, 12 batches a minute per caller. Each request asks ORS for the
`waytype`, `surface` and `steepness` extras. Loops are ranked by
`|d − target|/target + wNew·(1 − new share) + wBusy·busy share + wTrail·trail share + 1·steep share
+ wClimb·min(1, climb per km / 20 m) + 0.2·(m/km over the climb budget)`, with `wNew` 0.6 ("New streets
first") or 0.15, `wBusy` 0.8 ("Avoid busy roads") or 0, where busy share counts state roads fully and
other roads half, and `wClimb` 0.25. Trail share counts steps, soft ground on any way (unpaved, dirt,
ground or mud, sand, grass, ice) and paths or tracks without a paved surface (gravel half); `wTrail` is
1.5, 0 with **Trails OK** (off by default; it does not apply on a quality day or the day before one), and
6 more whenever the run would start before sunrise or end after sunset less 15 min (NOAA's solar
equations at the start, the run timed from now at the easy pace, 6:00/km without one), which Trails OK
never lifts. Steep share counts climbs of 7-10 % half and steeper ones in full, and descents too on a
long run. The climb budget comes from the day's session (see
[Explore loops](coaching-and-metrics.md#explore-loops)). "Flat for the reps", on by default when the
day's session is a quality one, makes `wClimb` 0.5 and adds `0.4·(1 − traffic-free share)`, traffic-free
being paved paths and tracks, footways and cycleways. The toggles but "Avoid busy roads", the session
and the daylight re-rank the loops already fetched, without a new request. The panel names the day's
budget and the loop's m/km against it, the sunset when it applies, and the share on trails and a hint
to walk steep climbs when they are notable. The GPX is GPX 1.1, the loop only, closed on its start,
named `runomics-<quartier>-<km>km.gpx`.

**Spots to avoid:** the owner marks a spot (Route options › Spots to avoid › Mark a spot, then a tap on
the map) where a fallen tree, a flooded path or an unsafe corner should keep loops away. Each is an
80 m circle in Firestore `avoidSpots` (owner-only rules), with an optional reason, listed and removed
in the same place and drawn on the map. A batch sends the nearest 20 a loop could reach to ORS as
`options.avoid_polygons` (octagons around the circles), leaving out any within 50 m of the start or a
via, where it would leave ORS no routable point and fail every loop.

**New ground:** the server replays each area's runs oldest first, from the busiest cluster in it as the map
opens it (`src/domain/explore/gains.ts`,
about 150 ms for 150 runs, cached until the runs or the area change), crediting each cell to the first
run through it. The same pass gives Progress's Explored card its numbers (the area run in last, a row for each other area,
whose link adds `area=` so the map opens on it) (`src/domain/explore/summary.ts`,
with home as the runs' median start, which stays on the server) and the day each quartier passed 90 %,
which its sheet on the map shows. A run's page lists up to three quartiers whose percentage it raised, before → after.
After a sync with new data, `POST /api/internal/explore-check` pushes once per quartier newly past
90 %, in any area; the ids already announced live in Firestore `notifications/lastExploreMilestones`,
one list per area, and the first check of an area only takes note of the quartiers complete so far.

**Credits:** OpenStreetMap (ODbL), the Metz quartiers and IGN ADMIN EXPRESS (Licence Ouverte 2.0),
and openrouteservice (CC BY-SA) are listed in the map's ⓘ while Districts or the generator shows.

## Share card

The canvas cannot read CSS variables, so the card names its own surfaces. It is painted in three
inks: the athlete's accent (passed as an r/g/b triple, since it can be a custom colour the palette
never sees) plus `paper` and `ink` for the white and black washes that build the glass. Alphas stay
inline at the call site — they are composition, not colour.

The dark Stats card carries the app's glow, in the run's own zone colour, from its top corner, with a
fixed faint grain over it: a smooth dark gradient bands into visible steps once Instagram or Strava
recompress the image. The light card stays plain.

- The start dot is always green; the finish dot is the accent, unless the accent sits within a
  distance of 90 in RGB space of the green start, where it flips to red — the start/finish convention
  Strava and Garmin use.
**MapLibre's worker is served from `public/`, not from the bundle.** MapLibre 6 is ESM-only and
no longer inlines its web worker: it spawns `maplibre-gl-worker.mjs` as a module worker, resolving
that name against `import.meta.url`. Bundled into a Turbopack chunk, that resolves to a path under
`/_next/static/` which the bundler never emits, Next answers with its HTML 404 page, and the worker
dies on strict MIME checking - leaving a map container with no canvas and no error anyone would
connect to the map. So `npm run maplibre:worker` copies `maplibre-gl-worker.mjs` and the
`maplibre-gl-shared.mjs` it imports out of `node_modules` into `public/maplibre/<version>/` (a
`prebuild`, `predev` and `e2e:build` step, so they cannot drift from the installed version, and
gitignored because they are build output), and `loadMapLibre()` in `lib/maplibre` points
`setWorkerUrl()` at `workerUrl(version)`. The version in the path is what lets `next.config.ts`
serve them `immutable` for a year: an upgrade is a new URL, never a stale copy. Every map goes through that one loader so the worker URL is set exactly once, before the
first `Map` is constructed.

The cost is a second copy of the shared module - the main thread has its own inside the bundle -
which is what an ESM-only library spawning a module worker requires.

**A map that cannot render is invisible to the test suite.** `.env.e2e` carries no
`NEXT_PUBLIC_MAPTILER_TOKEN`, and both map components return before constructing a `Map` without
one, so nothing in the E2E run ever instantiated MapLibre; the map specs assert the page shell
because the shell is all they could reach. That is how the worker breakage above shipped. The
canvas spec in `map.spec.ts` closes it: given a token it waits for the worker request, the style
request and an attached `canvas.maplibregl-canvas`, and it skips when no token is set, so CI
behaves as before until a token is added as a secret.

- Only the **basemap** is rendered through MapLibre; the trace is painted on afterwards in the
  athlete's accent. That is what makes changing accent free — the cached render does not depend on it.
- Before the basemap arrives, `projectRoute` frames the trace the way MapLibre's `fitBounds` will, so
  the trace barely moves when the map lands; afterwards `map.project()` is used, which is exact by
  construction. The `route` design opens up top and bottom padding so the trace sits between the title
  and the stats panel rather than running full-bleed under both; square thumbnails stay symmetric.
- Route thinning always keeps the last point so the finish marker stays put, and is deterministic so
  every caller thins alike.
- The light-mode accent needs a deeper tone to survive the pale backdrops, but not the same deepening
  `ACCENT_SWATCHES_LIGHT` applies: nature and silver sit one step brighter so the route line does not
  go muddy against the map design.
- Export is a 1080px-wide story frame — the resolution Instagram, Strava and Garmin expect.
- Clipboard copy must construct the `ClipboardItem` synchronously with a pending promise to keep
  Safari's user-gesture check.
- Reverse-geocode results are cached in `sessionStorage` so re-opening a card does not re-hit the
  geocoder. MapTiler sometimes resolves a cluster centre to a small commune or street rather than the
  town, and it expects an ISO 639-1 code where `t.locale` may be a fuller tag.

## Platform and browser workarounds

- **`useScrollLock`.** In a regular browser tab, plain `overflow: hidden` does not stop iOS Safari's
  touch-driven rubber-band scroll of the page underneath, and that residual scroll triggers the
  browser toolbar's show/hide animation — which drags every `position: fixed` element (the bottom tab
  bar) along with it. There, the body is pinned at its current scroll offset. In a standalone PWA there
  is no dynamic toolbar to fight, and pinning actively breaks layout: `top: -scrollY` + `bottom: 0`
  inflates the body taller than the viewport once scrolled, and portalled fixed sheets end up sized
  against that inflated box, leaving a gap under the sheet and shifting the tab bar (both intermittent,
  since they need `scrollY > 0`). A plain `overflow: hidden` lock, paired with the global
  `overscroll-behavior-y: none`, is enough there.
- **`FullscreenChromeContext`.** The global bottom tab bar and a fullscreen map overlay are both
  `position: fixed` siblings at different points in the tree. In practice — confirmed on-device and in
  headless Chromium — the tab bar can still paint and receive taps on top of a higher-z-index fullscreen
  overlay. Rather than fight that stacking behaviour, fullscreen views ask the tab bar to hide itself.
- **`fileExport`.** iOS PWAs in standalone mode have no downloads UI: a blob download either fails
  silently or opens an awkward preview, so the native share sheet is used there instead.
- **`useFocusTrap`** marks everything else on the page `inert` for the dialog's lifetime, cycles Tab
  within it, and restores focus on close. Attach the ref to the dialog panel, not the scrim.
- **`useDragToDismiss`** binds to the drag handle, not the whole sheet, so scrollable content keeps
  native scrolling. Past the threshold the sheet finishes sliding off under a real CSS transition
  before `onDismiss` fires, instead of vanishing when the finger lifts.
- **Service worker** registers in production only — a SW serving cached pages during development would
  mask live code changes. It also owns the update flow: a waiting version offers a banner, posts
  `SKIP_WAITING`, and reloads once the new worker takes control; otherwise users keep the old version
  until they close every tab.
- **An iPhone PWA keeps its JavaScript until it is relaunched**, even across deploys. Back in the
  foreground after a minute away, `UpdateOnResume` asks `GET /api/version` for the build commit and
  reloads when it changed, unless a text field has focus.
- **`color-mix` alpha variants** are used for token tints (Safari 16.2+). Plan cells are
  foreground-tinted rather than a fixed white wash, so they stay visible in light mode instead of going
  white-on-white.
- **`GlassSurface`** should stay under roughly six blurred surfaces per viewport — `backdrop-filter` is
  GPU-costly. `Button`'s secondary variant deliberately omits `backdrop-filter` because those buttons are
  typically nested inside a glass card already.
- **Toast** renders at the top of the screen, below the notch, so it is never hidden behind the bottom
  tab bar.
- **`ActivityHeatmap`** cells are keyed on `themeVersion` so `color-mix` values remount and re-resolve on
  a theme or accent switch.

## Internationalisation

**`t.locale` must be passed explicitly to anything that formats.** `Intl` APIs and
`toLocaleDateString`/`toLocaleString` that resolve their own locale differ between server and browser:
Node takes its default from the machine's environment, the browser from the user's settings. A number
formatted through one renders "Projected 1 663 km" in prerendered HTML and "Projected 1,663 km" after
hydration, which React reports as a hydration mismatch and recovers from by throwing away the whole tree
and re-rendering on the client. `src/i18n/__tests__/localeIndependence.test.ts` guards this.

Locale parity is checked in both directions as `path:type`. The type is part of the key because shapes
must match too: a plain string where the other locale holds an interpolating function renders
"[object Object]" at the callsite. `satisfies Strings` only checks fr against en, so it says nothing
about keys fr carries that en has since dropped.

`formatRange` is used for week headers so the locale picks its own order and elision — fr reads
"6-12 juil." rather than the month-first "juil. 6 - 12" that hand-assembling the parts produced.

## Date handling

Two `YYYY-MM-DD` conventions coexist and must not be confused:

- `isoDate` in `lib/calendarDate` is **local time**, matching the `date` field stored on activities.
  It is the default.
- `utcDate` in `GetTrainingWorkbook` is **UTC**, because the workbook computes its dates from UTC
  timestamps throughout.

"Today" is `appTodayIso()`: the date in `NEXT_PUBLIC_TIME_ZONE` when it is set, the machine's local
date otherwise. Each page computes it on the server and hands it to its client components, which read
it through `useToday(serverToday)`: the server render and the hydration both use the page's date, so
ISR HTML cached from another day still hydrates, and after mount the value is the reader's date and
rolls over at midnight. A use case that decides "today" takes the date as a parameter defaulting to
`appTodayIso()`, never `new Date()`, and a page passes its one date to every such call: the server's
own clock is UTC on Vercel, so it is still yesterday for the first hours after the athlete's midnight.

Coaching presentation does its date maths in UTC on purpose: a macrocycle spans a DST change, and
local-midnight arithmetic drifts a day either side of it. `isoWeekNumber` returns `isoYear * 100 + isoWeek`,
matching the sync pipeline's `week` field.
