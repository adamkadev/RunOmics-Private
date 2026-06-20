# RunOmics

Personal running training dashboard. Reads the owner's own Garmin data (synced to
JSON) and renders stats, charts, maps. Single-user, statically generated Next.js app.

## Auth / session

Server-verified Firebase session (cookie-based, `src/lib/session.ts`, `src/proxy.ts`
running in the Node runtime), `/login` and `/access-denied` pages. Settings forms
(goals/pbs/athlete/upcoming-races) write through `src/app/api/{goals,pbs,athlete,
upcoming-races}/route.ts` (Admin SDK) instead of the Firestore client SDK directly from
the browser. Gated to the single owner email (`isOwnerEmail()` in `src/lib/session.ts`)
- these Firestore collections are global, by design, since there is only one user.

## Stack

- Next.js 16 (App Router) + React 19, TypeScript
- Tailwind CSS v4 (CSS-first config in `src/app/globals.css`)
- Recharts (charts), MapLibre GL + MapTiler (maps)
- next-themes (light/dark), lucide-react (icons)
- Python scripts in `scripts/` sync Garmin activities into `public/data/`

## Commands

- `npm run dev` - dev server
- `npm run build` - production build (SSG)
- `npm run lint` - eslint
- Typecheck: `npx tsc --noEmit`

After meaningful edits, run `npx tsc --noEmit` and `npx eslint <files>` to verify.
**Never run `npm run dev` or `npm run build`** unless explicitly asked.

## Architecture (clean / layered)

```
src/
  domain/activity/types.ts      Activity model, ActivityType, ACTIVITY_TYPE_CONFIG (styling), HrZone
  application/usecases/         Pure data computation, called at build time (SSG). One file per query.
  infrastructure/repositories/  JsonActivityRepository reads public/data/activities.json
  app/                          Routes (server components fetch via usecases, render client components)
  components/<feature>/         UI by feature (dashboard, analytics, activity, goals, records, calendar, map, layout, ui)
  i18n/                         Centralized UI strings (see below)
  lib/                          formatters, math (round), colors, utils (cn), maptiler, version
```

Data flow: `page.tsx` (server) calls a `getXxx()` usecase, passes plain data to a
`*Client.tsx` (client) component for interactivity/charts. Usecases run at build,
so heavy aggregation there is fine.

### Data source

- `public/data/activities.json` - all activities (with `bestEfforts`, downsampled
  `paceSamples`/`hrSamples`/`elevationProfile` capped ~150 pts, `polyline`, etc.)
- `public/pbs.json` - official race PBs; `public/goals.json` - annual goals/targets
- `public/fit/`, `public/events/` - FIT files and race photos

## Conventions (IMPORTANT)

- **i18n**: every user-facing string lives in `src/i18n/en.ts` (typed nested object,
  functions for interpolation/pluralization). Components do `import { t } from '@/i18n'`.
  Active locale resolved in `src/i18n/index.ts` (`export const t = en`). The
  multi-language switch was prototyped then reverted; English-only for now, but keep
  new strings in `en.ts`. Domain enum labels live in `t.activityTypes` / `t.rpeLabels`.
- **No em-dash** (`—`) anywhere in code (strings, comments, JSX). Use a hyphen `-` or rephrase.
- **No proactive git commits.** Wait for an explicit request.
- **End every code-changing reply with a conventional commit message**, in its own
  fenced code block so it can be copied as-is.
- Communicate with the user in **French**.
- File references in chat use markdown links, not backticks.
- Match surrounding code style. Tailwind utility classes, `cn()` for conditional classes.

## Key domain concepts

- **Training load** (`GetTrainingLoad`): TRIMP-based CTL (42d EMA, "Fitness"), ATL (7d
  EMA, "Fatigue"), TSB = CTL - ATL ("Form"). TSB is computed BEFORE the day's load
  (form going INTO the day, not after).
- **Training status** (`GetTrainingStatus`): classifies status (productive / fresh /
  overreaching / recovery / detraining), risk (low / moderate / high), and load trend
  (building / maintaining / tapering / detraining) from CTL delta + TSB + ACWR.
  Three pure helpers: `acwr()`, `loadTrend()`, `classify()`.
- **VDOT / training zones** (`GetTrainingZones`): Jack Daniels. `getVO2max()` from best
  5K/10K/half effort; zones (Easy/Marathon/Threshold/VO2max) as pace ranges.
- **Consistency score** (`GetConsistencyScore`): 12-week window.
  `adherence` = % of weeks with at least 1 activity. `stability` = inverse of
  coefficient of variation of weekly km (high = stable volume). `score = adherence*0.6 + stability*0.4`.
- **Analytics** (`GetAnalyticsData`): trend series built from generic `Bucket[]`,
  works for monthly buckets (a year) AND weekly buckets (rolling N weeks).
  Returns `byYear` + `byPeriod` (8/12/16 wk) with `delta` vs previous equal window.
  Also provides `efficiencyDaily` (90-day rolling aerobic efficiency: 7d window with
  >= 2 activities, 30d window with >= 5 activities).
- **Goals projection** (`GetGoalsData`): rolling 8-week annualized rate computed from
  ALL activities (not year-filtered, to avoid artificially low rates in January).
  Status: `ahead` / `on_track` / `behind` with +/-10% thresholds. No fake probabilities.

## Server / Client boundary (CRITICAL)

Next.js App Router: server components can render client components, but **only
serializable data** can cross the boundary as props.

- **Allowed**: strings, numbers, booleans, plain objects, arrays, null/undefined.
- **Forbidden as props from server to client**: functions, class instances, Map, Set,
  Date objects, React elements created in server scope (except as `children`).
- `Map<K,V>` cannot be a prop. Convert with `Object.fromEntries(map.entries())` in the
  server component before passing.
- Functions are not serializable. Never pass a `formatter` or callback function as a
  prop from a server component to a client component. Compute `decimals` or the result
  server-side and pass the primitive instead.

## Clean code principles applied in this codebase

- **Extract pure helpers**: logic in usecases is broken into small pure functions.
  Example: `GetTrainingStatus` has `acwr()`, `loadTrend()`, `classify()` - each does
  one thing and is easy to test/reason about.
- **No `let` with reassignment blocks**: prefer `const` with ternary or early-return
  helper functions rather than `let x; if (...) x = ...; else x = ...`.
- **No premature abstraction**: three similar lines is better than a forced helper.
  Only abstract when there are 3+ genuine call sites or the logic is non-trivial.
- **No defensive error handling for impossible cases**: usecases return `null` when
  there is no data; callers guard with `if (data)`. No try/catch around pure computation.
- **SOLID** and **Clean Code** when you are developing
- **KISS**: prefer the simplest implementation that works. CSS-only tooltips over JS
  tooltip libraries. `requestAnimationFrame` directly over animation libraries.
- **DRY**: shared formatters in `src/lib/formatters.ts`, shared colors in
  `src/lib/colors.ts`, shared math in `src/lib/math.ts`. Never inline format logic
  that belongs in a formatter.
- **No comments explaining WHAT code does**: only comment the WHY when there is a
  non-obvious constraint or workaround. Well-named identifiers are self-documenting.

## UI patterns

- **CSS-only tooltips**: use `group/tip` Tailwind pattern (see `src/components/ui/Tooltip.tsx`).
  No `useState` needed; works in server components and client components alike.
- **`ChartExplain`** (`src/components/ui/ChartExplain.tsx`): colored one-liner below a
  chart with `positive` / `neutral` / `caution` tone. Use `trendFromSeries()` from
  `src/lib/chartTrend.ts` to compute direction from a value series.
- **`AnimatedValue`** (`src/components/ui/AnimatedValue.tsx`): count-up animation (700ms,
  ease-out-cubic) for numeric stat cards. Client component. Accepts `value: number` and
  `decimals?: number`. Used in dashboard `StatsGrid` and analytics `AnalyticsClient`.
  Do NOT use on activity detail page (keep it scoped to dashboard and analytics).
- **Recharts charts**: always `isAnimationActive={false}`, dots hidden on dense line
  charts, `connectNulls` when data has gaps. Custom `TooltipCard` / `TooltipRow`
  components from `src/components/ui/ChartTooltip.tsx`.
- **Color palette**: `CHART_COLORS` from `src/lib/colors.ts`. Never hardcode hex values
  in chart components; always reference the palette.
- **`YearSelector`** (`src/components/ui/YearSelector.tsx`): reusable dropdown chip for
  year / rolling-period / all-time selection. Props: `years`, `selected` (number | null,
  null = all-time), `onSelect`, optional `allTimeLabel`, `periods` (array of
  `{weeks, label}`), `activePeriod`, `onSelectPeriod`. Used in both Analytics and Goals.
  Always renders as `bg-accent` chip - no `active` prop.

## Features

Dashboard (training status banner + consistency score card + week snapshot),
Activities (filterable list + detail page with maps/HR/pace/elevation/dynamics + shareable
PNG card), Calendar (monthly view), Analytics (Volume / Performance / Physiology / Seasons
tabs; single `YearSelector` dropdown combines year + rolling-period 8/12/16wk + all-time;
Physiology tab includes TrainingZones pace chart),
Goals (annual goal with ON TRACK / AHEAD / BEHIND projection + season races + targets;
`YearSelector` dropdown for year switching),
Records (all-time PRs with form at PB + race predictions), Heatmap (MapLibre route density,
zoom-scaled line widths).


## Mobile / Safari notes

- Mobile nav: top bar (brand centered, theme toggle left, hamburger right) + full-screen
  drawer. `theme-color` + `color-scheme` + html background drive iOS safe-area colors;
  this was finicky (see `ThemeSync.tsx`). The mobile top bar slides away progressively on
  scroll down (`Sidebar.tsx`).
- `PageTransition.tsx` had a `key={pathname}` that caused
  `finishedRoot.parentNode.removeChild` crashes; avoid forcing remounts on navigation.

Avoid fake precision (e.g. "92% goal probability").
