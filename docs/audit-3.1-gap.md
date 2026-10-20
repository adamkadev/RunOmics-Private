# RunOmics 3.1 handoff · gap audit

Source: `runomics_3.1_handoff` (README.md → README_3.0.md, "Audit pass 2 · overrides" winning → App Fixes.dc.html).
Code: `RunOmics-Private` @ `1a08065` (v3.1.0), branch `claude/new-session-2hfk2x`. No code changed.

Size key: **S** one file / copy-level · **M** a few components or a view · **L** new data plumbing or many screens.

> **Status.** This branch is wave 4 on top of waves 1 to 3: rep pace (2b),
> the temperature cost's cold end (2b), the plan-based monthly target (3c)
> and route naming (1g), the four items that needed new data. The per-badge
> rows are kept as the record of what the code looked like before, and what
> was decided along the way is at the foot of this file.

---

## Rules (App Fixes, cards 01–04)

| # | Rule | State | Files | Size |
|---|---|---|---|---|
| 01 | Headers: tab root large title · sub-page "‹ Parent" + large title · compact centred when scrolled | **Partial** | `ui/BackButton.tsx` (uses lucide `ArrowLeft`, not a chevron), `profile/AthleteClient.tsx`, `profile/Vo2GradeDetail.tsx`, `consistency/*`, `records/*` | S |
| 02 | Time range compact top-right; section tabs full width under the title | **Done** | `analytics/AnalyticsClient.tsx`, `ui/SegmentedTabs` | – |
| 03 | Whole-card tap → grey chevron; rows that open separately → accent "Label ›" | **Partial** | `profile/ProgressHub.tsx:449` (`All pairs →`), `app/shoes/[gearId]/page.tsx:279` (`→`), `analytics/CoachRead.tsx` + `i18n` (`Why →`, `Open plan →`) | S |
| 04 | Colour meaning: mint good / amber warn / grey neutral, lime retired, arrow follows the number | **Partial** | `lib/deltaTone.ts` + `themeTokens.ts` correct and lime is gone; the arrow bug lives in `analytics/CoachRead.tsx` (see 1b) | S |

---

## 1a–1h · Audit fixes

| Badge | Item | State | Files | Size | Conflicts / notes |
|---|---|---|---|---|---|
| **1a** | Today's status reads the same load number as Analytics | **Partial** | `dashboard/ReadinessCard.tsx`, `domain/training/readiness.ts`, `dashboard/LoadStrip.tsx`, `usecases/GetRecentLoad.ts`, `i18n` `dashboard.readiness` | **M** | `LoadStrip` already draws "Load · 7 days · safe lo–hi" from the same ACWR band, so the number exists. But the eyebrow comes from `verdictTone()` (TSB + risk), **not** from load-vs-band, so "Building · Load in range" can sit over a strip showing load under the band. Mockup also drops the LOAD ×0.90 tile and puts FORM in the tile row (dial stays). Decide: keep the dial *and* a FORM tile, or follow the mockup exactly. |
| **1b** | Analytics "Why" sheet: arrows match each number's direction | **Missing** | `analytics/CoachRead.tsx:18-22`, `analytics/coachReadTabs.ts` | **S** | Real bug: `TREND_ICON` maps *meaning* to the arrow, so "Fatigue 48, down 23" draws an **up** arrow. Fix = arrow from the numeric sign, colour from `deltaTone`. Needs a direction field on `CoachRow` (rows are built from `TREND_OF[deltaTone(...)]`). Also the headline should lead with the load number. |
| **1c** | Laps: one unlabelled lap = "Whole run", never "Interval" | **Missing** | `activity/KmSplits.tsx:294-330`, `activity/IntervalSet.tsx`, `i18n` `activity.splits` | **M** | A single `interval_active` split with ≥2 auto sub-laps makes `hasLaps` true and `LapTable` titles it "Intervals" with a row typed "Interval". Needs: "Whole run" row, the "no laps pressed" note, "See km splits ›" link, and lap types shown only when the watch sent them. |
| **1d** | Filtered totals count only matching runs, "% easy" hidden, filter bar | **Partial** | `activities/ActivityListClient.tsx:59-66, 446-480`, `activities/activityFilter.ts` | **S** | Totals are already derived from the filtered `items`, so the arithmetic is right. Still missing: hide `% easy` while a filter is on, and the "Showing 90 workouts · totals count workouts only / Clear" bar (today it is only the chip row + a removable pill). |
| **1e** | VO₂ "Top 5%" matches the grade table; zone % in the table; "‹" header | **Partial** | `profile/ProfileHrZones.tsx:144-170`, `profile/Vo2GradeCard.tsx`, `usecases/GetVo2Grade.ts`, `ui/BackButton.tsx` | **M** | "Top n% · men 20–29" already exists (`i18n` `topInBand`); needs a check that `topPercent` and the grade table come from one threshold set. Zone % sits **under the bar segments** (3.0 1j) — 1e moves it into the table as a `%` column, and the mockup's table is ZONE · HR · % · TIME, i.e. **drops the pace column**. Confirm you want pace gone. |
| **1f** | Volume stats: unit under the number; separate Below-plan / Unplanned swatches | **Missing** | `analytics/VolumeTab.tsx:13-16, 88-99`, `ui/Stat.tsx` | **S** | `ACCENT_SOFT` is used for *both* below-plan and unplanned, and the legend has one entry for both. Mockup wants dark mint vs grey. Unit-under-number is a `Stat` layout variant. |
| **1g** | Routes named by where they go, renameable | **Missing** | `components/records/RecurringRoutes.tsx:146-205`, `usecases/GetRecurringRoutes.ts` | **L** | Confirmed bug: `useStartPlaces` reverse-geocodes the **start** at street grain, so every route sharing a doorstep shares a name. Needs a "where it goes" rule (farthest point / most distinctive place along the outline) and **a store for user renames — none exists today** (routes are derived, with ids like `route-3`; a rename needs a stable id + Firestore write + rules). Second line already leads with distance ✓. |
| **1h** | Progress home previews its detail pages | **Partial** | `profile/ProgressHub.tsx`, `profile/progressHubView.ts` | **M** | Race card ✓, Records 2×2 ✓. Missing: the cumulative **year chart** still lives on the hub (1h replaces it with a flat "Goals & season ›" summary: `1,568 of 2,000 km · 74 km short at this pace`); Consistency tile still draws the daily `MiniCalendar` instead of the **weekly streak** (`7 week streak · 3+ runs / 0 of 3 this week` — the streak already exists from 3.1.0, so this is a swap, not new data); VO₂ is a separate tile rather than a line inside Records; `All pairs →` should be `›`. |

---

## 2a–2d · Analytics, every tab

| Badge | Item | State | Files | Size | Conflicts / notes |
|---|---|---|---|---|---|
| **2a** | Load: coach card explains "Productive" vs low load | **Missing** | `analytics/coachReadTabs.ts`, `i18n` `analytics.cards.coachRead.load` | **M** | Needs a new headline case joining the watch status to the load band. |
| 2a | Device names → "your watch" | **Missing** | `i18n/en.ts` (30 strings), `i18n/fr.ts` (31) | **M** | See global flag 1 — three of them are genuine Garmin Connect deep links. |
| 2a | Load ratio out of "Injury risk", into the load story | **Missing** | `analytics/LoadTab.tsx:179-283`, `analyticsView.riskRows` | **M** | `loadRatio` is still a `RiskRow`. Mockup puts `0.79 ratio · safe 0.8–1.3` in the Load card beside `456 / safe 462–750`. |
| 2a | Resting-HR dip no longer flagged | **Missing** | `analytics/loadRecoveryView.ts:284-296` (`kind: 'dip'`) | **S** | |
| 2a | Form chart tighter, neutral bars grey | **Partial** | `analytics/LoadTab.tsx:52-123` | **S** | |
| **2b** | Coach headline matches the numbers | **Partial** | `analytics/coachReadTabs.ts`, `analyticsView.paceShift` | **M** | |
| 2b | VO₂: one source, one window everywhere | **Partial** | `analyticsView.ts:266,281` (84 d), `progressHubView.ts:92` (84 d), `GetVo2Grade.ts` (`delta30`) | **S** | The two windows are **intended** — the mockups themselves print "↑1 in 12 wk" on the hub and "+2.4 in 30 days" on Athlete. What to verify is the single *source* series (`GetVO2maxHistory` vs the grade's own samples). |
| 2b | "Workout pace" → "Rep pace", hard reps only | **Missing** | `i18n/en.ts:831-833` + fr, `analyticsView.paceShift` | **M** | Rep-only pace needs the split/lap rep set per workout — `IntervalSet`/`repSet` already identify reps, but Analytics currently averages the whole session. Check the weekly trend points carry enough to recompute. |
| 2b | "Heat cost" → "Temperature cost", call out cold | **Missing** | `analytics/PerformanceTab.tsx:420-490`, `usecases/GetHeatImpact.ts`, `i18n` `heatCost` | **M** | Cold bands need the sub-10 °C side of the same computation; `GetHeatImpact` is built around "above 20 °C". |
| **2c** | Average label follows the range ("12-week avg", "1-year avg") | **Partial** | `analytics/VolumeTab.tsx:38-49` | **S** | `avgWeeks` is computed but the live window is hard-pinned to 12. |
| 2c | Missed weeks get their own legend entry (dashed outline) | **Missing** | `analytics/VolumeTab.tsx` `EmptyWeek` + `Legend` | **S** | |
| 2c | Long-run weeks over the limit amber, limit labelled | **Partial** | `analyticsView.longRunView`, `LONG_RUN_SHARE` | **S** | |
| 2c | "Year to date" → one link row to Goals | **Done** | `analytics/VolumeTab.tsx` `YtdRow` | – | |
| **2d** | Quality sessions: one row of weeks, done / extra / missed | **Partial** | `analyticsView.ts:669-703`, `analytics/IntensityTab.tsx:166-200`, `i18n` `quality` | **M** | Dots already carry `threshold / intervals / missed`. 2d wants type-neutral **done / extra / missed**, headline "2 missed" instead of "avg · plan asks", and "11 done of 10 planned · 1 extra". |
| 2d | Time-in-zones copy says what changed | **Partial** | `analyticsView.ts:643-662` (trough/recovered already computed) | **S** | |
| 2d | "Zone ranges" links to Athlete & zones | **Done** | `analytics/IntensityTab.tsx:229` | – | |

---

## 3b–3d · Remaining screens

| Badge | Item | State | Files | Size | Conflicts / notes |
|---|---|---|---|---|---|
| **3b** | No full-width block for a single-step run; bar only when >1 step | **Missing** | `plan/workoutSteps.ts:53-55`, `plan/PlanDayCard.tsx:54-70` | **S** | Confirmed: `intensityBlocks` returns one full-width work block when `list.length <= 1`. Freed space shows Pace / Heart-rate targets (the effort already carries them, `effortPace`). |
| 3b | Day strip keeps the bars, letter underneath | **Done** | `plan/DaySelector.tsx`, `ui/DayStateStrip.tsx` | – | |
| 3b | "1:00 h", never "1h00" | **Missing** | `lib/formatters.ts:30-46` (`formatDurationWords`, `formatDurationCompact`), 25 call sites | **M** | `formatDurationRounded` already does the right thing; the two "words" formatters produce `1h00`/`0h22` by design ("one dominant number" comment). Changing them touches every list, card and plan — and several snapshot/unit tests. |
| **3c** | One prediction on Goals and Progress | **Done** | `goals/SeasonRaces.tsx:73-81`, `usecases/GetGoalsData.ts:187-214`, `profile/progressHubView.ts:208` | – | Both read `nextRaceSpotlight` from `GetGoalsData`. |
| 3c | Monthly target comes from the plan | **Missing** | `usecases/GetGoalsData.ts:126-168`, `goals/MonthlyVolumeChart.tsx` | **L** | **Direct conflict.** The shipped 3.1 design deliberately uses *a twelfth of the annual goal* so the chart can draw one target line (comment at `GetGoalsData.ts:126`). The mockup wants the **plan's** monthly km (226 km in October). That needs plan km aggregated by month (`plan/weekPlanDays.ts`, `MonthView.tsx` compute it per day) fed into `GetGoalsData`, and it breaks the single target line — months would each have their own. Needs your call. |
| **3d** | Activities list: date first in workout subtitles | **Missing** | `activities/ActivityThumbRow.tsx` | S |
| 3d | Map city picker uses the dark pill | **Missing** | `map/FilterChip.tsx`, `map/chipMenu.tsx` | S |
| 3d | Filter sheet: "Long run" under Easy; "Show all 315 runs" when nothing picked | **Missing** | `activities/ActivityFilterSheet.tsx`, `activities/activityFilter.ts` | S |
| 3d | Dynamics: say which direction is better, mint/amber on "vs your usual" | **Partial** | `activity/RunningDynamics.tsx` | S |
| 3d | Charts: "/km ↑" → "up = faster" | **Missing** | `i18n/en.ts:1436` + `fr.ts:1365`, `activity/chartStackLanes.ts:58` | S |
| 3d | "Luxemburg" → "Luxembourg" | **Partial** | only in `src/application/coaching/__tests__/*`; the live name comes from imported race data | S | Check `RunOmics-data-lamiaa` / the Garmin event name — this may be a data fix, not a code one. |
| 3d | Records best times: ▲/▼ → rotating chevron icon | **Missing** | `records/RecordsLeaderboard.tsx:109` | S |
| 3d | VO₂ grade & Consistency back link "‹ Parent" | **Missing** | `ui/BackButton.tsx` (global) | S |
| 3d | Consistency week sheet: dates on the highlighted row | **Partial** | `consistency/WeekSheet.tsx` | S |
| 3d | One duration format everywhere | **Missing** | same as 3b duration | M |

---

## 4a / 4d · Heatmap

| Badge | Item | State | Files | Size | Conflicts / notes |
|---|---|---|---|---|---|
| **4a** | Light mode: single-hue ramp pale tint → accent → deep accent shade, blurred accent halo (multiply), basemap muted further | **Partial** | `lib/heatRamp.ts`, `components/map/mapUtils.ts:155-176`, `components/map/heatLayer.ts`, `map/buildMapStyle.ts` | **M** | Light mode currently draws **one** pass at `heatRamp(accent).light` with `multiply` — a flat pale tint, no ramp, no halo. `heatRamp` already computes `deep`, so the ramp is half-built. |
| 4a | Dark mode: dim shade up to the full accent, **never white** | **Missing** | `lib/themeTokens.ts:335` (`--heat-end` mixes the accent with `#ffffff` in dark), `mapUtils.HEAT_STYLE.dark` (additive passes) | **S** | Explicit override violation — spec and the 1l note both say cap at full accent. |
| 4a | White accent in light mode → graphite ramp | **Missing** | `lib/heatRamp.ts` | S | `hexToOklch` on a near-neutral gives an unstable hue; needs a special case for `mono`. |
| **4d** | Heatmap in every accent, light and dark | **Partial** | derives from `heatRamp(accent)` | S | Falls out of 4a once the ramp and the mono case land. |
| 4b | kept for reference only | n/a | — | — | Not to be built. |

---

## 5a–5e · Accents

| Badge | Item | State | Files | Size | Conflicts / notes |
|---|---|---|---|---|---|
| **5a r1** | Accent is chrome, never data (types/zones keep fixed colours) | **Done** | `plan/sessionKind.ts` (`kindColor` → `zoneColor`), `lib/colors.ts` `CHART_COLORS`, `lib/__tests__/hueBudget.test.ts` | – | Already enforced by a test. The token comment at `themeTokens.ts:332` ("The athlete's own data is the accent") is about *volume bars*, which the mockups also paint in the accent — not a violation. |
| **5a r2** | "Today" = outline ring + accent date, never an accent-filled bar | **Partial** | `plan/DaySelector.tsx`, `ui/DayStateStrip.tsx`, `plan/MonthView.tsx`, `dashboard/LoadStrip.tsx:21` | **S** | `loadBarColor` paints a runless **today bar** in the accent — the exact shape the rule forbids. Month view fills today's date circle with the accent (that one is a date, allowed). |
| **5a r3** | Good and warning fixed | **Done** | `lib/deltaTone.ts`, `themeTokens.ts` | – | |
| **5a r4** | Clash swaps (purple → cadence grey; white → HR grey, routes "latest" outline) | **Missing**, mostly **moot** | `lib/colors.ts`, `records/RecurringRoutes.tsx` | **S** | The app's chart pace line is **fixed blue**, not the accent, so the purple/cadence swap isn't needed. The white-accent "latest" bar in Recurring routes is a real case. |
| **5b** | Cyan `#5fd4f0` replaces blue | **Missing** | `lib/accentScale.ts:30`, `lib/themeTokens.ts`, `src/app/globals.css` (generated), `lib/__tests__/accentTokens.test.ts.snap` | **M** | See global flag 4. |
| **5c–5e** | Plan week in purple / pink / white | **Partial** | `plan/*` | S | Falls out of r2 + r4. |

---

## Global flags

### 1 · Device brands still visible in the UI
30 strings in `src/i18n/en.ts`, 31 in `src/i18n/fr.ts`. Grouped:

- **Plain source labels** (straight swap to "your watch"): `pages.athlete.fromGarmin` / `syncedAgo` (308-309), `profile` (337), `fetching` (349), analytics captions `Garmin · overnight` (739), `Resting HR · Garmin` (741), `HRV · Garmin` (742), `Garmin · {span}` (768), `model.garmin` (591), `activity.noTraceHint` (1452), `garminOutOfDate` (2199), `garminStep` (2214), stale-sync title/body (503, 1982), `descriptionGarmin` (2070).
- **Glossary / about text** (rewrite to "your watch" / "the watch"): 124, 125, 129, 130, 716, 771, 808, 1111, 1142, 2057 — note 1142 and 2057 also name **Firstbeat**.
- **Genuine Garmin Connect deep links** — *conflict*: the brand is the destination, so it can't just be renamed. `settings.garmin: 'Garmin Connect'` (421), `readOnly` (445), shoe `changeInGarmin` / `addInGarmin` (1385-1386), `shoes.addLabel` / `editLabel` (1624, 1626), driven by `lib/garminConnect.ts` and `activity/runConditions.ts`. Options: drop the links, or keep the brand only inside the link target and say "change it where your watch's data comes from". **Your call.**

Code identifiers and comments (`garminActivityUrl`, `planPhaseSpans(…, garminRanges)`, etc.) are not user-visible and are out of scope.

### 2 · Unicode arrows / emoji used as icons
- `profile/ProgressHub.tsx:449` — `All pairs →`
- `app/shoes/[gearId]/page.tsx:279` — `→`
- `i18n/en.ts:624,626` + `fr.ts:580,581` — `Why →`, `Open plan →`
- `i18n/en.ts:1929` + `fr.ts:1787` — `trailSpan` `{from} → {to}`
- `records/RecordsLeaderboard.tsx:109` — `▾`
- `ui/BackButton.tsx:48` — lucide `ArrowLeft` where rule 01 asks for a chevron
- `i18n/en.ts:110` + `fr.ts:94` — `↑ from {grade}` (`Vo2GradeTodayRow`)
- `i18n/en.ts:179,980,1436` + fr — `faster ↑`, `/km ↑` (3d turns these into words)
- `consistency/WeekSheet.tsx:29`, `plan/PlanDayCard.tsx:156`, `ui/SessionCard.tsx:17` — `✓` as a status mark
- `ui/RangeBar.tsx:69` — `▸` / `◂` overflow marks
- Emoji: `activity/SimilarRuns.tsx:82` — `🥇`; `i18n/en.ts:1862` + `fr.ts:1724` — `🌍`

Already correct: `analytics/CoachRead.tsx` (lucide arrows), `ui/MapAttribution.tsx` (SVG ⓘ).

### 3 · Accent used for data instead of interface
Clean, with two exceptions:
- `dashboard/LoadStrip.tsx:21` — a runless **today** bar is painted in the accent (breaks 5a rule 2: shape, not colour).
- `lib/themeTokens.ts:335` — `--heat-end` mixes the accent **toward white** in dark mode, against the 4a/1l cap.

Workout types and zones take `zoneColor` / `ZONE_HEX`, chart series take fixed `CHART_COLORS`, and `hueBudget.test.ts` already guards the separation. One standing divergence from the 3.0 spec, by design: the **long run shares the easy blue** (`sessionKind.ts:34`) instead of the spec's `#3f7bd6`; its letter tells it apart.

### 4 · Can `useAccentUiColor()` take cyan `#5fd4f0`?
**Yes, structurally** — it reads `curatedAccent(id)[mode].acc`, so one line in `lib/accentScale.ts` changes the colour everywhere. Five things come with it:

1. **Light mode fails.** `#5fd4f0` on white is **1.73:1**, and `accentContrast.test.ts` requires ≥3:1. A light counterpart is needed, e.g. **`#0e7f9b`** (4.64:1 on white; white ink on it 4.64:1). Dark mode is fine: 11.34:1 on `#0b0c0c`, and the dark ink `#07261d` on it is 9.33:1.
2. **Id.** Keeping `periwinkle` as the id avoids a migration; renaming it to `cyan` means adding `periwinkle: 'cyan'` to `LEGACY_ACCENTS` so stored preferences survive.
3. **Regenerate tokens**: `npm run tokens` rewrites the generated block of `src/app/globals.css`, and `lib/__tests__/__snapshots__/accentTokens.test.ts.snap` must be updated.
4. **Hue budget**: cyan sits near the fixed pace blue `#3b82f6` and Z2 `#7ab8ff`; `hueBudget.test.ts` and the perceptual-distance check in `accentContrast.test.ts` need a run.
5. The 3.1 palette is `teal · periwinkle · violet · pink · mono`, whose hexes differ from the handoff's (`#2dd4a7 · #5fd4f0 · #b48cf0 · #f48cc4 · #e9ecea`). Only cyan is called out as a *replacement*; confirm whether the other four should be re-pinned to the handoff values or left as shipped.

---

## Standing divergences worth a decision before any work starts

1. **Token set.** The 3.0 token table (zones `#5b9cf5 / #8f7cf0 / #c77ae6 / #f07aa8`, warn `#f0b73c`) has been superseded in code by the v4.17 system (`ZONE_HEX`, `--zone-*`, per-theme ink ramps, light-mode darkened variants). Recreating the mockups' hexes literally would undo the light-mode contrast work. Recommend: keep the app's tokens, follow the mockups' *layout and copy*.
2. **Monthly target** (3c) — a twelfth of the goal vs the plan's km. Blocks the Goals work.
3. **Zone table columns** (1e) — does pace leave the table?
4. **Garmin Connect links** (global flag 1) — keep the brand on the destination, or drop the links?

---

## Proposed order of work

**Wave 1 — one-file copy and colour fixes (half a day, high value)**
1. 1b arrow direction in `CoachRead` (a visible wrong-direction bug).
2. 5a r2 + `--heat-end`: today bar as a ring, dark heat capped at the accent.
3. 1f legend swatches + unit-under-number.
4. 3b single-step structure bar.
5. Glyph sweep: `BackButton` chevron, `All pairs ›`, `Why ›` / `Open plan ›`, `▾` → chevron, `/km ↑` → "up = faster".
6. 1d: hide "% easy" under a filter.
7. 2a: stop flagging a resting-HR dip.

**Wave 2 — screens (two to three days)**
8. 1a Today ↔ Analytics load agreement.
9. 1h Progress home: Goals summary replaces the year chart, weekly streak replaces the mini calendar, VO₂ into Records.
10. 1d filter bar, 3d filter-sheet and list items.
11. 2a load ratio out of Injury risk, into the load story.
12. 2d quality sessions done / extra / missed.
13. 1e zone % into the table (after you answer the pace-column question).
14. 1c Laps "Whole run".

**Wave 3 — system-wide (one to two days each, each needs a decision first)**
15. 5b cyan accent (+ its light counterpart, tokens, snapshots).
16. 4a light heatmap ramp + halo, mono graphite case → 4d falls out.
17. Duration format `1:00 h` everywhere (25 call sites + tests).
18. Device brands → "your watch" (EN + FR, 61 strings).

**Wave 4 — needs new data (scope separately)**
19. 2b "Rep pace" from hard reps only; "Temperature cost" with the cold side.
20. 3c plan-based monthly target.
21. 1g route naming by destination + user renames (new persisted store).

---

## What shipped, and the calls made along the way

The four questions the audit raised were answered as follows, since the
work was asked for in full rather than item by item.

1. **Tokens.** The app's v4.17 token system stays; the mockups' layout and
   copy were followed, not their hexes. Recreating the 3.0 table literally
   would undo the light-mode contrast work.
2. **Monthly target (3c).** A month the plan covers takes the plan's own km.
   The chart keeps its single dashed rule only while every month asks the
   same; where the plan sets each month's target, every bar carries its own
   tick, and the caption says "target from your plan". A year with no plan
   behind it reads exactly as before.
3. **Zone table (1e).** The table keeps Zone, Pace, HR and Time. The share
   left the bar, where a 1 % zone had no room to print it, and reads small
   after the zone's time - "4h58 · 27%".
4. **Device brands.** Every user-visible string says "your watch", and the
   rows that open the watch's own app all read "Edit in your watch app".
   Such a link is drawn only for an item the watch gave an id to; the brand
   lives in the URL alone.

Two further deviations worth knowing:

- **The Form dial stays on Today**, and so do its three tiles. Mockup 1a
  draws the hero without the dial, but its note asks only for the load
  number to agree with Analytics. The dial carries Form, the tiles carry
  Fitness, Fatigue and the load ratio, and the strip carries the seven-day
  load against its band. It is only Injury risk the ratio left (2a).
- **"Easy" in the filter sheet now excludes long runs**, because the long
  run is a row of its own beside it; the Easy *chip* still covers both, as
  the handoff's grouping has it.

One rule was skipped as moot: **5a rule 4's purple/cadence swap**. The
chart's pace line is a fixed blue, never the accent, so there is no clash to
swap. The white-accent half of the rule - the routes "latest" bar as an
outline - is implemented.

Everything else follows the badges as written. `npm run verify` is green and
`next build` succeeds.
