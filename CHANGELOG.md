# Changelog

All notable changes to this project are documented in this file.

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
