# Changelog

All notable changes to this project are documented in this file.

## [4.0.0] - 2026-09-25

RunOmics 4.0: the UI/UX redesign from the v4.0 audit, shipped as PRs
01–19 in work order (#134–#151). Every change is display-only: the data is
still read from Garmin, and the activity note is still the only thing you
type. F22 was already fixed before this release (the count-up respects
reduced motion), so there is no PR 02.

### Today

- The hero is a SessionCard: a done / planned / missed chip, the session's
  structure, and a verdict that no longer contradicts the plan. It is drawn
  from tokens (F01, F07).
- One week target, the same on Today, Activities and Plan: km run against the
  planned km, with the plan's own sessions (F02).
- The race countdown leaves the daily hero. It lives on Goals (F12).
- Body card: Form / Fitness / Fatigue with a band and a delta each
  ("+3 vs 7 days ago"), a status strip with a legend in words that links to
  the load chart, and a Latest record row (F05, F06).
- The avatar opens Progress (F23).

### Plan

- Done, planned, missed, rest and today are drawn in shape, not only in
  colour (`.state-*` recipes, `DayStateStrip` with a legend) (F03).
- Run types take their training zone's colour (`RUN_TYPE_ZONE`), the
  workout-structure label passes contrast, and the month grid's today cell
  uses the accent instead of a fixed emerald (F08, F10, F20).
- The summary is in words ("32 km run · 48 km planned"). The easy share is
  given against an 80% guide, and load sits behind an ⓘ (F09).
- The month grid shows only the rows it needs, has week footers and a legend
  in words, and nothing smaller than 11 px (F29).

### Activity

- The page opens on this run: map, verdict with its plan row, RPE and note.
  Similar runs sit lower, as one disclosure ranked by pace in one unit. The
  tab is in the URL (`?tab=`) (F04, F15, F31).
- Charts: one readout for the scrubbed point, summaries worked out from the
  same samples, a dashed average line, and every pace axis reading "faster ↑"
  (F13, F14).
- Splits: a per-km grid with a speed bar, the gap to your average and a
  spread summary, instead of a plain table (F37).
- Dynamics: each change is given against your baseline, in words, and is
  coloured only when it is good or bad (F36).

### Progress

- Progress is a hub: the year's numbers, then one row each for Goals,
  Records, Shoes, Athlete & zones, Consistency and Settings. Athlete folds into
  "Athlete & zones", and Settings becomes a row (F11).
- Analytics: the season headline is on its first tab only, and the tabs are
  Load / Performance / Volume / Intensity (Charge / Performance / Volume /
  Intensité) (F16, F17).
- Records: labelled Best and Predicted columns, the whole row is the target,
  and the prediction is Garmin's on every screen. When the best stands in for
  a prediction it reads "= best" (F32, F33).
- Shoes: the wear bar scales past the limit, ticks it and hatches the
  overrun ("875 km over"). The wear copy holds at its edge cases (F27, F34).
- Athlete & zones: four key tiles with definitions, and one zone table with
  Pace, HR and Time columns under a single Week / 4 weeks toggle (F35).
- Goals: upcoming races first, then done, one row per race.
- Consistency: its own page, one row per month and a cell per day, with Rest,
  Run and Long run named in words (F38).
- Settings is grouped into Appearance, Data and Account.

### Design system

- New `ui/` primitives: `SessionCard`, `DayStateStrip`, `StatReadout`,
  `ListRow`, `GlossaryTerm` / `InfoButton`, `SegmentedTabs size="sm|md"`
  (now used by Activity, Analytics, Records and Athlete) (F25).
- Tokens for session state, readiness tone, form bands, status peaking and
  zone ink. The nav glass tint follows the accent background.
- Type is on the scale everywhere, and nothing readable is below 11 px
  (`text-micro` is retired) (F24).
- Light glass cards keep their edge on the aurora (F26).

### Accessibility

- Every interactive `ui/` control has a 44 pt hit area (`hit-44`) (F18).
- The tab bar clears the home indicator, and its labels and icons are
  legible (F19).
- The save toast's ink passes contrast on the accent (F21).
- Jargon (Form, Fitness, Fatigue, VO₂max, VMA, threshold HR and pace, RPE,
  aerobic / anaerobic effect) is defined behind an ⓘ wherever it appears
  (F28).
- EN and FR are in parity for every new string.

## [3.1.0] - 2026-07-07

Closes the two "out of scope" chantiers of the v4 audit (B2 similar runs, C2
personal segments) and finishes the dashboard engagement pass.

### Added

- **Similar runs** (audit B2): the activity page now detects other outings on
  the same route (grid-cell overlap on the heatmap's ~30m binning, with a
  distance guard so two laps of a loop don't match one) and, from 3 matched
  passes, shows a card with a pace-progression chart, this run's rank, and a
  podium of your times.
- **Personal segments** (audit C2): tapping a trace on the heatmap that you
  have run 3+ times grows the route card into a personal segment - pass count,
  record pace, 90-day trend, and a podium of your own times linking to each
  activity. Same matching engine as similar runs (`lib/routeMatch`).

### Changed

- **TodayHero follows the theme**: the hero (and the celebration overlay and
  greeting avatar) now derive their gradient from a per-accent, light/dark
  `--hero-gradient` token instead of a hard-coded green - so a blue/rose/violet
  accent no longer gets a clashing green hero.
- **Dashboard deduplicated**: the TrainingStatusBanner is gone (its form
  verdict duplicated TodayHero's); fitness, fatigue and load-trend now live as
  three key metrics inside the hero. The race pill left the highlights row
  (the countdown is already in TodayHero and RaceCockpit), which now only
  carries shoe-wear alerts. Weekly digest and consistency card share one row.

### Fixed

- Vitest no longer picks up the Playwright screenshots spec.

## [3.0.0] - 2026-07-07

A deliberate version reset marking the UI/UX audit v4 release - not a downgrade
from 3.5.2, a rebrand of this milestone as "the real v3.0".

### Added

- **TodayHero**: a dashboard "today" card aggregating training status (form),
  today's planned Garmin session, and the race countdown - pure display, no
  training recommendation. Hidden when none of the three are available.
- **Weekly streak & goal ring**: consecutive-active-weeks streak (with a
  longest-streak callout), a weekly distance ring prorated from the annual
  goal, and a 7-day activity dot row, on the Dashboard.
- **Celebration overlay**: a full-screen moment (confetti, haptic, share CTA)
  the first time a recent personal record is seen in a browser, gated by a
  3-day recency window and a localStorage seen-flag.
- **Activity achievements strip**: top-3 qualifying best-efforts surfaced as a
  dedicated strip above the charts on the activity detail page.
- **Heatmap world view**: bubbles now stack busiest-zone-on-top instead of
  random z-order, and large bubbles show their zone name.
- **Pull-to-refresh**: dragging down at the top of any page re-fetches the
  current view's data and updates the sync-freshness badge. This refreshes
  the already-synced data on disk - it does not trigger a live Garmin sync,
  which stays on its own daily schedule (out of scope for this release).
- **Haptics**: short vibration bursts on tab switches, sheet dismiss, pull-to-
  refresh, and the celebration overlay, on supporting devices.
- **First-launch hint**: a dismissible one-time card pointing new visitors at
  the dashboard's form/session/heatmap.
- **Stale-sync push alert**: a new notification if no Garmin sync has landed
  in 72h, on its own daily schedule independent of the sync workflow.
- **Analytics 1-week window**: a Monday-anchored "this week" option alongside
  the existing 8/12/16-week windows, with prev/next navigation through every
  past week and a jump-to-current shortcut.

### Changed

- Deduplicated the Profile "Milestones" preview against "Personal records"
  (records already shown just above) - it now only surfaces distance tiers
  and streaks.
- Widened the map's zone-name chip before it truncates.
- Enlarged share-card design thumbnails (84px -> 104px).
- Directional page transition for the activities list <-> detail navigation.
- Simplified the Dashboard: the greeting now shows the full weekday and date
  (no week number) with an initials avatar, drops the now-redundant sync
  badge (still shown in TodayHero), and no longer shows PR/record pills
  (superseded by the achievements strip and celebration overlay) or the
  distance/time/pace/VO2max stats grid (that granular breakdown now lives in
  Analytics' new 1-week window).

### Fixed

- Removed the global `overscroll-behavior-y: none` that was actively blocking
  pull-to-refresh.

### Out of scope (left in the audit for a future pass)

- "Similar outings" (matched-run comparison) and "personal segments" -
  un-mocked, open-ended, the two biggest remaining chantiers.
- Live, on-demand Garmin resync triggered from the client.

## [3.5.2] - 2026-07-06

### Changed

- **Heatmap now uses a logarithmic intensity scale**: run frequency is heavily
  right-skewed (a few home streets run 100+ times, most stretches run once or
  twice), so the previous linear ramp left almost the whole map stuck on the
  cool "rare" blue. Colour and width breakpoints are now spaced geometrically
  between 1 and the max frequency, spreading the warm colours across the counts
  that actually occur. Grid widened to ~30m so repeated passes merge into one
  high-count segment instead of scattering into parallel low-count threads.
- **Heatmap top controls no longer overlap**: the zone chip and the type/year
  filters are laid out in a single flex row with the zone name truncating,
  instead of two absolutely-positioned groups that collided on long zone names.
  The collapsed zone chip drops the km (kept in the zone list) to stay compact.

## [3.5.1] - 2026-07-06

### Fixed

- **Heatmap black smear on busy stretches**: the transparent tap-to-inspect
  hit layer used `line-opacity: 0.01`; being per-route (not frequency-merged),
  it stacked into an opaque black band over heavily overlapped paths, burying
  the heat colours. Set to fully transparent (`opacity: 0`) - hit-testing via
  `queryRenderedFeatures` is unaffected, and the cool→hot ramp now shows.

## [3.5] - 2026-07-06

### Added

- **Frequency-based running heatmap**: the map now renders true intensity
  instead of flat monochrome lines. Every trace is snapped to a ~20m grid and
  aggregated into unique segments carrying a `count` of how many times that
  stretch was run (`buildHeatGeoJSON`); a cool→hot ramp (blue→violet→pink→red)
  and frequency-scaled line width make favourite streets stand out from one-off
  outings. An on-map **intensity legend** (`HeatLegend`) makes the colour scale
  readable.
- **Tap-to-inspect a run**: a transparent per-route hit layer powers
  tap/click on the heatmap, highlighting the run and opening a
  `RouteInfoCard` (type, date, distance, duration, pace).
- **Activity-type filter** (`TypePicker`): filter the heatmap by run type,
  alongside the existing year filter; both combine. An empty-state chip shows
  when a filter leaves no routes.

### Changed

- The selected-zone chip now shows total distance (`runs · km`) to match the
  zone list rows.

## [3.4] - 2026-07-04

### Added

- **Accessible chart summaries**: new `ChartFigure` component
  (`role="img"` + `aria-label`, chart SVG marked `aria-hidden`) applied to
  all 25 Recharts charts across activity detail, dashboard and analytics.
  Each summary is computed from the data already in the component (value
  range, series min/max, pie/bar breakdown, or the existing `ChartExplain`
  insight text for scatter/regression charts) - no new i18n copy, every
  label reuses strings already translated elsewhere in the same component.
  Screen readers now get one concise sentence per chart instead of either
  silence or a scattering of raw SVG tick-label text nodes.

## [3.3] - 2026-07-04

### Added

- **Python test suite** (`scripts/tests/`, 41 tests + CI job): pins the FIT
  pipeline's pure logic - best-effort/PR detection, pace smoothing, RDP route
  decimation, interval splits, VO2max scaling, local time offsets, corrupt-FIT
  robustness, the Garmin→activity mapper and the transient-retry policy.

- **End-to-end tests (Playwright)**: first e2e batch covering the read-only
  golden paths - dashboard, activities list → detail, calendar, records,
  goals. Runs against a real production build (`next build && next start`)
  and a **dedicated `runomics-dev` Firebase project**, never the real one,
  so Firestore reads/writes during tests can't touch actual data. Activities
  come from the real, committed activity JSON (read-only).
  - `e2e/seed.mjs` + `e2e/fixtures/{goals,pbs,athlete}.json`: idempotent,
    version-controlled fixtures seeded into `runomics-dev` before each run -
    kept fully separate from `scripts/seed_firestore.js` (which targets the
    real project from uncommitted local JSON).
  - `.env.e2e` (committed, non-secret client Firebase config) +
    `.env.e2e.local` (gitignored, Admin credentials) for local runs.
  - `npm run e2e:seed` / `npm run test:e2e`; new
    `.github/workflows/e2e.yml` job, gated on `DEV_FIREBASE_*` repo secrets
    so forks/external PRs skip it instead of failing.
  - README > "End-to-end tests" documents the one-time `runomics-dev`
    project setup (Firestore rules deploy, service account key, GitHub
    secrets).

### Changed

- **garth migration evaluated and declined**: upstream deprecation only
  breaks the one-time login flow (`get_secret.py`); daily syncs merely
  refresh the existing ~1-year OAuth token and keep working. The community
  alternatives are unmaintained cat-and-mouse workarounds. Documented in the
  README, with an actionable failure message added to `get_secret.py`.

### Fixed

- **CSV export in the iOS PWA**: the blob download either failed silently or
  opened an awkward preview (no downloads UI in standalone mode). The export
  now goes through the same native share sheet as the activity share card
  (Save to Files, AirDrop...), with the regular download kept everywhere
  else - logic extracted to a shared `saveFileWithFallback` helper used by
  both, and closing the share sheet no longer falls through to a download.
- Vitest's default test file pattern was also matching Playwright's
  `e2e/*.spec.ts`, which use an incompatible `test`/`expect` - excluded the
  `e2e/` directory from the Vitest config.

## [3.2] - 2026-07-04

Hardening pass driven by the audit in `docs/product-improvement-todolist.md`:
security, reliability, observability, tests and pipeline robustness.

### Added

- **Error boundaries**: `src/app/error.tsx` (all routes, themed retry/back
  fallback) and `global-error.tsx` (root-layout failures, inline-styled).
- **Firestore rules versioned**: `firestore.rules` committed as the source of
  truth (public read, owner-only writes) with deploy instructions.
- **Content-Security-Policy** header covering MapTiler, Firebase/Google APIs,
  Nominatim, MapLibre blob workers and the FCM service worker.
- **Rate limiting + logging on `/api/internal/*`**: shared
  `handleInternalRoute` wrapper - 20 req/min/IP fixed window (applied before
  the secret check), structured `[internal:<route>]` error logs, 500s the
  cron workflows can surface.
- **Health probe**: `GET /api/internal/health` reports last-activity date,
  staleness (> 7 days) and app version for uptime monitoring of the sync.
- **PWA update banner**: a waiting service worker now triggers a "new version
  ready" banner; Refresh activates it (SKIP_WAITING) and reloads. Settings >
  Data gains a "Clear offline cache" action. 192/512 maskable icons added to
  the manifest (rendered from the brand SVG).
- **Component/a11y/security tests** (first RTL layer): `useFocusTrap` cycling
  and inert handling, `ActivityNotes` owner gate, `ErrorFallback` + axe-core
  smoke run, `internalAuth` secret + rate-limit behavior, and a WCAG 3:1
  contrast test locking the whole accent palette on both themes. Coverage
  reporting via `npm run test:coverage` (v8, text+lcov).
- **Bundle analyzer**: `npm run analyze` (@next/bundle-analyzer).
- CI: production-dependency audit step
  (`npm audit --omit=dev --audit-level=high`).

### Changed

- **Sync pipeline resilience**: new `garmin/retry.py` with exponential
  backoff (60s flat on 429; 2s/8s/32s on 5xx and network errors) replacing
  the duplicated single-shot 429 helpers; the whole per-activity body is now
  isolated so one corrupt FIT or API error can no longer abort the run and
  lose the batch. `reprocess.py` gains `--dry-run`.
- **Activity list**: offscreen cards skip layout/paint via
  `content-visibility: auto` (native CSS virtualization, no library).
- README: security model clarified (`NEXT_PUBLIC_OWNER_EMAIL` is a UI gate;
  Firestore rules are the enforcement), new "Tests & quality" section.

### Fixed

- React Testing Library cleanup never ran between tests (vitest globals are
  disabled), leaking renders across test cases.
- `__pycache__` artifacts were not gitignored.

## [3.1] - 2026-07-04

### Added

- **Offline PWA shell**: new `public/sw.js` service worker - hashed build
  assets and icons are cached cache-first, pages/RSC payloads/data JSON
  network-first with cache fallback, so previously seen pages (and the
  dashboard as a fallback for unvisited deep links) open without a network.
  Registered in production only.
- **Modal accessibility**: new `useFocusTrap` hook applied to the calendar
  bottom sheets and the share modal - the rest of the page is `inert` while
  a dialog is open, Tab/Shift+Tab cycle inside it, and focus returns to the
  opener on close. The share modal also gains `role="dialog"`/`aria-modal`.
- **French locale**: full `fr.ts` translation (running vocabulary: allure, FC,
  dénivelé D+, sortie longue, affûtage, RP…), type-checked against the English
  shape via `satisfies Strings`. Activated at build time with
  `NEXT_PUBLIC_LOCALE=fr`; English stays the default. `t.locale` now drives all
  `Intl` date/number formatting, so weekday/month names and thousands
  separators follow the language.

### Changed

- **ShareCardModal decomposed** (~520 → ~260 lines): theme carousel
  (`ShareThemePicker`), accent dots (`ShareAccentPicker`), action row
  (`ShareCardActions`) and setting-row primitives (`ShareCardControls`)
  extracted as components; preferences persistence (`useShareCardPrefs`),
  reverse geocoding (`useShareCardGeocode`) and high-res PNG export
  (`shareCardExport`) extracted to `src/lib`. The modal keeps only state
  wiring, the live preview and layout. The photo-row "Change"/"Browse..."
  labels and the share-sheet title fallback moved into the i18n catalog.

### Fixed

- **Hardcoded `en`/`en-US` locales** in `formatters.ts`, the analytics chart
  axes/tooltips, the dashboard greeting, profile stats and the share card now
  use `t.locale` - dates rendered in English regardless of the active locale.
- **Dashboard highlights**: the "PR · …" record chip and the race "D-n"
  countdown were hardcoded English strings; both now come from the i18n
  catalog (`RP · …` / `J-n` in French).
- **Push notifications**: enabling push registered `/firebase-messaging-sw.js`,
  which does not exist in `public/` - the registration 404'd. FCM now binds to
  the app service worker, which displays push payloads itself.
- `<html lang>` was hardcoded to `en`; it now follows the active locale.

## [3.0] - 2026-07-04

Harmonization + refactor pass across the whole app, plus a first batch of v3
improvements picked by impact/effort.

### Added

- **Calendar**: tapping a day with sessions in the month view now jumps to the
  week view with that day pre-selected (completed activities were previously
  only inspectable from the week view).
- **Accessibility**: proper `tablist`/`tab`/`aria-selected` semantics on the
  Analytics tabs and the Calendar week/month switcher; `role="dialog"` +
  `aria-modal` on both calendar bottom sheets.

### Changed

- **Analytics (perf)**: the four tab panels (Volume / Performance / Physiology /
  Seasons) are now code-split with `next/dynamic` - the page only parses and
  hydrates the visible tab's Recharts components instead of all ~20 charts
  upfront. `AnalyticsClient` shrank accordingly (tab content extracted to
  `VolumeTab`/`PerformanceTab`/`PhysiologyTab`/`SeasonsTab`).
- **Navigation chevrons**: kept alongside swipe everywhere (desktop has no
  swipe, and they are the discoverable/accessible affordance), but the compact
  calendar chevrons now expand their hit area to the 44px HIG minimum via an
  invisible overlay (visual size unchanged). Calendar swipe-forward is now
  clamped at the current week, matching the disabled next-chevron.
- **Swipe navigation** factored into a shared `useSwipeNavigation` hook
  (dashboard week stats + calendar previously had two hand-rolled copies with
  different thresholds).
- **"Jump back to now" buttons** (calendar "Today", dashboard "current week")
  unified into a shared `InlineJumpButton` component.
- **Dashboard loading skeleton** updated to mirror the v2 glass layout
  (greeting, weekly stats card, charts, recent activities) instead of the old
  v1 six-card grid.
- Convention: `useDragToDismiss` moved from `src/hooks/` to `src/lib/` where
  all other hooks live.

### Fixed

- **Activity detail map**: expanding to fullscreen now re-fits the view on the
  route bounds - previously only `resize()` ran, leaving the trace off-screen
  until the user panned.
- **Calendar week view in light mode**: completed-day cells used an invalid
  CSS color (`var(--color-accent, #f1761f)26`), silently dropping the
  background; planned/rest cells used hardcoded white/black rgba values that
  were invisible on a light background. All replaced with theme-aware
  `color-mix` on the accent/foreground tokens.
- **Analytics stats**: the "time" metric's animation guard tested a formatted
  string (always truthy) instead of the duration; elevation unit label was
  inconsistent between year view ("m") and all-time view ("m gain"); the two
  near-identical metric arrays were merged.
- **Dashboard recent activities**: date no longer rendered twice on desktop
  widths; RPE chip now uses the shared i18n formatter.
- **Planned workout sheet**: now slides up on open and plays the same animated
  slide-out as the activity sheet when closed via scrim or Escape.

### Removed

- Dead code: unused `surface="card"` branch in `ActivityRow`, stale sticky
  header measurement (ResizeObserver + state) in the activities list, unused
  imports in `StatsGrid`, leftover `top-2 z-20` classes on non-sticky headers,
  `CalendarNav.tsx` (superseded by `InlineJumpButton`).

### v3 backlog (not implemented, by descending impact/effort ratio)

- **Offline PWA shell**: cache the app shell + latest activities JSON with a
  service worker so the dashboard opens offline. *(Shipped in 3.1.)*
- **Focus trap + `inert` background** for bottom sheets and the share modal
  (keyboard focus can currently escape behind the scrim). *(Shipped in 3.1.)*
- **ShareCardModal decomposition** (~515 lines: template carousel, theme
  toggle, canvas drawing orchestration in one component). *(Shipped in 3.1.)*
- **French locale**: the i18n layer is ready (`Strings` type derived from
  `en.ts`); add `fr.ts` and a language setting. *(Shipped in 3.1 as a
  build-time `NEXT_PUBLIC_LOCALE` switch; a runtime language setting would
  require moving `t` behind a React context.)*
- **Virtualized activity list** if the paginated list grows beyond a few
  hundred rendered rows.

## [2.0] - 2026-06-25

Major version: full liquid glass redesign of the app, plus a new Calendar/Agenda
feature for Garmin planned workouts.

### Added

- **Calendar**: new agenda page with weekly view, swipe left/right navigation,
  Garmin planned-workout sync with step-count estimation and auto-inferred workout
  type from the Garmin workout name, animated planned-workout sheet.
- **Profile**: new screen (hero card, YTD stats, personal records, shoe wear gauge,
  editable HR zones, annual goal card) consolidating data previously spread across
  Settings.
- **Share card**: Strava-style full-map design, day/night map style toggle,
  multi-template 9:16 carousel, drag-to-dismiss gesture on bottom sheets.
- **Settings**: restructured into Apparence / Notifications / Donnees / Deconnexion
  tabs, accent picker redesigned as circular glass selectors.
- **Notifications**: push alert when training risk reaches "overreaching".
- **Activities**: server-side pagination, activity card icon colored by zone type.
- New brand mark (ring signature) in the header and PWA icon kit.

### Changed

- **Liquid glass redesign across the entire app** (multi-wave rollout): aurora
  background, glass design tokens, unified Button/Pill/StatusPill primitives,
  floating glass sidebar and bottom sheets, redesigned mobile top bar and "More" menu.
- `activities.json` split into one file per year for scalability; GPS route
  simplification/decimation tuning for better curve fidelity on synced activities.
- Settings admin forms (Goals/PBs/Athlete/Upcoming races) removed - that data
  management now lives in a separate app.

### Fixed

- Share card and Heatmap route lines invisible/washed out against the light map
  style.
- Numerous mobile/Safari layout issues: safe-area paddings, hydration mismatches
  from localStorage state, fixed-position CTA bugs, drag-to-dismiss pointer capture.

### Removed

- Activity comparison feature (superseded by server-side pagination).

## [1.3] - 2026-06-21

### Added

- **Goals**: independent monthly sub-goals derived from the annual target, and a
  history section comparing past years (achieved vs missed).
- **Analytics**: 90-day rolling trend chart for running dynamics, form (TSB) vs RPE
  correlation chart with temperature coloring.
- **Dashboard**: weekly load vs typical week badge on the snapshot, next race shown
  as an inline status line instead of a widget.
- **Records**: badge highlighting the most recently broken record on the dashboard
  and records page.
- **Activities**: side-by-side comparison of two activities (pace, HR, cadence,
  elevation).
- **Shoes**: per-shoe wear alert threshold with dashboard banner and push
  notification.
- **UI**: compact mobile sizing applied to all stat-card grids.

### Fixed

- Dark-mode focus/check contrast on stat cards.
- Garmin sync reliability on GitHub Actions runners (Cloudflare WARP to bypass IP
  blocking).

## [1.2] - 2026-06-21

### Added

- **Activity detail**: free-form notes and tags (stored in Firestore), native share
  (Web Share API) for activity PNG cards, copy-to-clipboard fix on iOS Safari.
- **Records**: PR-watch alerts for recent efforts close to existing records, shown as
  a single-line message.
- **Dashboard**: focus mode to hide and reorder widgets.
- **Settings**: running-themed accent color picker (drives charts, save button,
  sidebar logo, favicon, map route color), manual VMA field on athlete profile,
  CSV/JSON data export, PWA push notification foundation (FCM registration) with
  triggers for new PRs and weekly goal reminders.
- **Heatmap**: type and year filters, replacing the year-chip picker with a dropdown.
- Unit tests (Vitest + jsdom) for pure `lib` helpers (accent, colors, formatters, math,
  utils, chart trend).

### Changed

- 60s revalidation on activities and dashboard pages.

### Fixed

- Upcoming race date field overflowing on Safari iOS, accent color picker overflow
  on mobile, push notifications toggle row layout, pending tag input lost on save.

## [1.1] - 2026-06-20

First tracked release. RunOmics started as a minimal Next.js dashboard reading Garmin
data from a static JSON file; this entry captures everything notable built since then.

### Added

- **Dashboard**: Training Status banner (status/risk/load trend), Consistency score
  card, daily aerobic efficiency chart, VO2max history, animated count-up stat cards,
  clickable recent activities, full-width activity heatmap with week navigation.
- **Analytics**: Volume / Performance / Physiology / Seasons tabs, year-over-year
  comparison, temperature-vs-pace scatter plot, granularity chart, single `YearSelector`
  dropdown combining year + rolling period (8/12/16wk) + all-time.
- **Goals**: annual goal projection (ahead/on track/behind) from rolling 8-week pace,
  season races editable from Settings and stored in Firestore.
- **Records**: dedicated PR wall (5K to marathon, 1 mile, longest run), world-record
  gap, per-distance progression chart, race predictions, top 10 leaderboard, form-at-PB.
- **Activities**: sortable list (distance/duration/pace/avg HR), PR and shoe-pair
  badges, color-coded RPE badges, interval splits with sub-laps, cadence/temperature
  charts, shareable activity card.
- **Shoes**: per-pair mileage and wear tracking via Garmin `gearId`, dedicated shoe
  detail page with brand logo and activity history.
- **Settings**: Firebase-backed Goals/PBs/Athlete profile/Upcoming races, editable
  in-UI (no more manual JSON edits + git commits), Google sign-in, toast feedback.
- **PWA**: manifest, icons, add-to-home-screen support, app icon as the sidebar brand
  mark.
- **Mobile**: progressive top-bar hide on scroll, mobile-first layouts across Settings
  and Activity detail.
- Unit tests (Vitest) for the core usecases (training load, training status,
  consistency score, training zones, goals, analytics, year comparison) and a CI
  workflow.

### Changed

- Unified design system: semantic color tokens replacing hardcoded colors, shared
  `Card`/`Badge`/`SaveButton`/`Toast` components, consistent colored accents and chart
  styling across the app.

### Removed

- Experimental AI coach and LLM-based insights layer (rule-based training plan,
  provider-agnostic insights), dropped after evaluation in favor of the
  deterministic Training Status / Records / Goals features above.
- Standalone `/coach` and `/profile` pages, merged into Goals, Analytics and Records.

### Fixed

- `getLatestVO2max` returning the earliest reading instead of the latest.
- Map route clustering using a fixed lon/lat grid instead of real distance.
- Several mobile layout, chart axis/clipping, and orphaned-grid-item issues.
- Search engines indexing personal training data (added `noindex`).
