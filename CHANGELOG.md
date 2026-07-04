# Changelog

All notable changes to this project are documented in this file.

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
