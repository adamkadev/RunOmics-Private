# Design review, Oct 2026: hand-off for implementation

Mockups: `mockups/*.png` (393 × 852 pt, at 2x). The current screens they replace are in `current/*.png` (demo build).
Canvas with the full review: https://claude.ai/artifact/KfKJK9aVHTZwXxcmm9PGXr (private to Adam).

**Scope.** Display only. No backend, sync pipeline or coaching-rule changes. Garmin stays the source of truth.

**Unchanged.** Activity detail, Analytics, the tab set, and every Garmin link that exists today. Plan gets no Garmin link.

**Ground rules.**
- Reuse `src/components/ui` and the theme tokens in `src/app/globals.css`.
- Every string goes through `src/i18n/en.ts` **and** `src/i18n/fr.ts`.
- Light and dark mode both.
- Tap targets ≥ 44 pt.
- Nothing is fixed to 393 pt; the layouts must also hold at 402 pt.
- Before each push: `npm run verify`, then `npm run screenshots` and compare the captures with the mockups.

Work in this order. Each numbered section is one PR.

---

## 1. Bug: Today shows yesterday's Garmin workout after midnight

`getTodayPlannedWorkout()` (`src/application/usecases/GetPlannedWorkouts.ts`) picks the day with `isoDate(new Date())`, which is the server's UTC date. The rest of `src/app/page.tsx` uses `appTodayIso()`.

The effect: between 00:00 and 02:00 Luxembourg time, a coach rest day falls back to the previous day's Garmin workout. It shows labelled with today's date (seen as "TODAY · MON, OCT 19 · Long run 12 km" on a rest day).

Fix: pass the page's single `today` into the lookup. Add a test with `NEXT_PUBLIC_TIME_ZONE=Europe/Luxembourg` and a clock at `2026-10-18T22:53:00Z`.

## 2. Bug: Goals opens on next year

- `getGoalsPageData()` (`src/application/usecases/GetGoalsData.ts`) sorts years newest first, and `GoalsClient` opens on `years[0]`. A 2027 race makes 2027 the default in 2026. Open on the current year from `appTodayIso()` instead, and use `appTodayIso()` for `currentYear` and `today` in that function as well.
- A future year with only a race should show the race, not the PB empty state.
- Fix the copy "No PBs for {year} yet - add them in Settings.": Settings has no PB entry.

## 3. Today

Mockups:
- `today-morning-en-light.png`, `today-morning-en-dark.png`, `today-morning-fr-light.png`, `today-morning-fr-dark.png`
- `today-after-run-en-dark.png`
- `today-stale-en-light.png`

Order on the page, top to bottom:

1. **Header**: keep `DashboardGreeting` as it is. Title, the sync line as the sync button, the avatar initial top right. No date. No pull to refresh.
2. **Stale banner** (new, only when `isSyncLate`, i.e. older than 24 h):
   - A warn-tinted strip under the header: title "Garmin data 31 h old" and the line "Last sync Sat 14:40 · a run may be missing".
   - A 44 pt **Sync** button that calls the same `useSyncNow` as the sync line. Non-owners go to `/settings`.
   - No offline state.
3. **Readiness card**, replacing `BodyCard` and the verdict part of `TodayHero`:
   - **Left:** a 124 pt dial: a 240° arc over Form −40…+25. The tired / neutral / fresh bands reuse `FORM_BAND_THRESHOLDS` and the `--warn`, `--line-2` and `--pos` tokens. A marker sits at today's Form. In the centre, the signed value (38 pt) and the label "FORM · TSB".
   - **Right:** the readiness word from `verdictTone` (`eyebrowByTone`, same colours as today) and one short line ("Load in range", or the caution or hold reason), then a 2 × 2 grid:
     - **CTL** with its 7-day delta
     - **ATL** with its 7-day delta (rising = warn, falling = pos)
     - **ACWR** (`status.acwr`)
     - **GARMIN**: Garmin's training status as a word. It comes from `latestRatedStatus(trainingStatusDays)`, which `page.tsx` already passes as `watchStatus` and `BodyCard` currently ignores.
   - **Below the dial, after a divider:** the **AI verdict** (`aiVerdict.headline`, then `aiVerdict.body`). It is generated each morning and again after a run; keep both lines.
   - **Fallback:** without an AI verdict, show no sentence. Delete the rules-based prose: `dashboard.todayHero.verdict.headline/why/gain/*` and its use in `todayVerdict`.
   - **Tap:** the whole card opens `/analytics`, as `BodyCard` does today.
   - **Removed:** the form scale bar with its Tired / Neutral / Fresh labels, and the "recovering, +3 in 7 days" wording. No HRV or RHR: the watch isn't worn at night.
4. **Before today's run:** the **session card**, then the **last run row**.
   - The session card is a card of its own, out of `TodayHero`:
     - eyebrow "TODAY · LONG RUN" in accent
     - the title
     - a 4-column field row: TIME · DIST · PACE (range) · HR (cap)
     - `SessionStructureBar` with its label line
   - Drop the HR field when the session has no HR target. **No coach note.** **No "Open plan" button**: the whole card links to `/plan`.
   - The last run row is the existing `LastRunRow` style: route thumb, title, "8.0 km · 5:52 /km · 141 bpm · 46:58", and a check.
5. **After today's run:** the **done row** first ("Long run · Done", "11.5 km · 5:47 /km · planned 12 km", check), then the **next session** as the same session card with the eyebrow "NEXT · TUE 20 OCT".
6. **Week card**: keep `WeeklyStreakCard` as it is.
7. **Remove** `RecentActivities` from Today. Keep `CelebrationOverlay` and `Vo2GradeTodayRow` (it only shows when the grade changes).

## 4. Plan (the current page, tightened)

Mockups:
- `plan-week-en-light.png`, `plan-week-en-dark.png`, `plan-week-fr-light.png`, `plan-week-fr-dark.png`
- `plan-month-en-light.png`, `plan-month-fr-dark.png`

Keep: Week | Month, the 7-day `WeekChart`, paging week by week (‹ › and swipe), the selected day's card with its structure bar, the session rows (rest days are already excluded), and `RestDayCard` for a selected rest day. **No Garmin link and no session sheet.**

**Header (`PlanClient`):**
- Move the phase out of its card in `WeekView` and into the subtitle under the H1: "**General preparation** · week 2", or "**Build** · week 9 of 12".
- When a race exists, append " · Half in 42 d".
- Delete the phase card (`phase-line` and `PlanPhaseTrack`) from `WeekView`.

**Week card:**
- `WeekChartLegend` becomes one 11 pt line.
- `WeekStats` becomes one line under a divider: **10.1** / 54 km · **1** of 5 sessions · **100 %**, numbers 17 pt.
- Together that brings today's card onto the first screen.

**Selected-day card:**
- The eyebrow ("TODAY · WED 21 OCT", or the date) moves *inside* the card.
- When the selected day is today, the card gets a **2 pt `--accent` border** (Adam likes this one).
- The title, the detail line ("58 min · 11 km · target 4:32–4:40") and the segmented `SessionStructureBar` (warm-up / 3 × 8′ / rec / cool-down labels) stay as they are today.

**Month (`MonthView`):**
- Move each week's total from the line under the row into an **8th column** at the right: the run km bold over "/ planned" muted.
- One-line legend: Done · Easy · Threshold · ✕ Missed.
- Keep the summary line: "142 km run · 226 planned · 15 sessions".
- Cell recipe:
  - **done:** soft accent fill
  - **planned:** dashed border plus a 12 % tint in the session's zone colour
  - **today:** 2 pt accent ring
  - **rest:** hairline border
  - **other months:** 45 % opacity

## 5. Activities

Mockups: `activities-en-light.png`, `activities-fr-dark.png`.

**Header:**
- Replace the "Map view" button with a full-width **List | Map** `SegmentedTabs` under the H1. Map renders `GlobalMapWrapper` in place. `/map` stays as a deep link that opens Activities on Map.
- The sort control becomes a 44 pt icon button. The menu is unchanged.
- The subtitle stays: "316 runs · 2,694 km since May 2025".

**Current week:**
- A header line, "This week · Oct 19–25", with "10.1 km · 1 run" on the right.
- Its runs as rows below. **Drop `WeekTargetBar`** and the planned target: Today and Plan already show the week against plan.

**Run rows (`ActivityThumbRow`):** the meta line becomes date · moving time · avg HR ("Tue 20 · 57:23 · 139 bpm"). The type stays as the dot.

**Months:** unchanged. Keep the sticky month header with km and runs, and one collapsed row per week (range, type dots, "45 km · 5 runs · 88% easy", chevron).

## 6. Progress

Mockup: `progress-en-light.png`.

- Move the **Next race** tile to the top (`order-0`) and give it the 2 pt accent border.
- Its content:
  - eyebrow "NEXT RACE"
  - the days to go at 34 pt, with "days · Half · Sun 22 Mar ’27"
  - three values: PREDICTED (Garmin) · TARGET · TO FIND (the gap, warn when slower than target)
  - the existing `RangeBar`
  - a footer with the plan's phase ("Plan: general preparation · week 2") and "Garmin prediction"
- The rest of the hub is unchanged.
- The header subtitle already names the race ("Season 2026 · Half in 155 days").

## 7. Shoes

Mockups: `shoes-list-en-dark.png`, `shoe-detail-en-dark.png`.

**List (`ShoesGrid`, `WearBar`):**
- Show the "▏800 km · retire from workouts" key once, on the right of the "IN ROTATION · 2" label, instead of under every bar.
- A pair whose verdict is "replace soon" gets a small warn pill under its "284 km left".
- Everything else is as today, including "Used in 3 of your last 6 tempo/threshold runs."

**Pair (`src/app/shoes/[gearId]/page.tsx`):**
- **Fix the back link.** Opened from `/shoes`, it reads "‹ Shoes" and returns there. Today it always reads "Progress" with fallback `/profile`.
- The projection becomes one line: "1,000 km ≈ Jan ’27 · 11 wk at 25 km/wk". Shorten `shoes.projectedRunOut` in EN and FR.
- Runs / Avg distance / Avg pace / Avg HR move into **one 4-column row** inside the km card, replacing the 2 × 2 grid of large numbers.
- The verdict card (REPLACE SOON, headline, body) stays whole.
- "What you run in it": keep the bar and the legend, and drop the closing sentence ("58% of its distance was…").
- "Edit shoe" and "Add" keep their Garmin links.

## 8. Copy cuts (low priority)

- Delete the unused strings: `dashboard.trainingLoad.footnote`, `plan.weekSummary.aboutLoad`, `plan.weekSummary.loadDefinition`, `records.subtitle`, `recurring.subtitle`, `goals.upcoming`, `sync.title`, `takesAbout`.
- Delete `vo2Grade.coachNext`.
- Remove the ⓘ glossaries on Athlete's key numbers. That also fixes a clipping bug: the definition renders inside a `truncate` div.
- Records: drop "TOP TIMES" (it repeats the H1 and the tab).
- Settings: drop the row subtitles, and make "From Garmin Connect - change them there." a link.

## Not to do

- No HRV, RHR or sleep anywhere: the watch isn't worn at night.
- No changes to Analytics, the activity detail, or the tab set.
- No offline UI and no pull to refresh.
- No session sheet and no Garmin link on Plan.
- The canvas also shows the tabs reordered (Today · Plan · Activities · Analytics · Progress). That is **optional**: ask Adam before changing the order.
