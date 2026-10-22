# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

- Resting HR is read only where the watch was on for more than a run.
  Garmin's daily resting HR is the lowest 30 minutes of the hours worn, so a
  watch worn only to run reported a warm-up's 50-60 - and 142 on a hard day -
  against a true 45. A day's value now counts on a night worn to sleep (it has
  an HRV reading), on a day without a run, or on a run day with two run-free
  days worn within a week of it: a watch worn all day but not to sleep keeps
  its series, run days included; a watch worn only to run has none, and
  Analytics' Recovery card and the Load "Why" sheet leave resting HR out.
  Athlete & zones keeps the resting HR from the Garmin settings, which the
  load maths use.

- The maps keep the page's theme when you leave the app and come back. iOS
  draws its app-switcher snapshots in both appearances, flipping the page to
  light and back; the flip back came while the map's light style loaded, and
  went unseen. The activity map and the heatmap check the theme again once a
  style has loaded.

- A run shows the type it was set as, by its name, where no coach session is
  matched: `Threshold 2 x 7:00 - …` that Garmin filed as tempo reads
  `● Threshold`, a Garmin Coach `Base` pushed into tempo reads as base - on the
  run's page, its Activities row, the shoe page and Plan, whose day strip and
  card now agree with them. A title that is the type's name alone leaves the
  type to its dot. The run keeps the watch's type for Analytics and filters.

- Sessions read as their set where their type is shown beside them: Activities'
  rows, the activity page's title and Plan's day cards say `3 × 8′ @ 4:25`, the
  type left to the dot or the eyebrow (and read out by VoiceOver on a row). A
  name from before the naming rules said its set twice -
  `Threshold 2 x 7:00 - 2x7'@4:25` - and reads `2 × 7′ @ 4:25`. Words that are
  not the type stay: `6 × 20s strides`. Plan's "Planned" line gives the
  amount, `10 km · 58 min`, and the session only when the run is called
  something else. A row's meta line is the date, time and HR, never cut.
- A run shows its session's type where the watch filed another: a threshold
  session Garmin labelled tempo (heart rate too low) reads `● Threshold`, on the
  activity page and its Activities row, as the share card already had it. The
  run keeps the watch's type, so Analytics and the filters are unchanged.
- Share: a **Rep pace** switch on an interval session's card. Off, the card is
  an easy run's: the route in one colour, no rep pace, the average pace back.
- The fullscreen heatmap's Filters badge is whole: the edge sampler cut its top.
- Share's Stats card: Z1 and Z2 are one row, `Z1–Z2 Easy`, in the bar and the
  legend, so the legend takes two lines and the rep pace no longer cuts Z5.

## [3.2.1] - 2026-10-22

### Liquid Glass v3, fix round 1 (on-device testing)

Fixes from the first round on an iPhone, IDs from the round-2 handoff
(FIXES.md). Surfaces and layout only, no data changes.

- **F1** The glow is clear down to the edge sampler's foot: no hard line under
  the status bar.
- **F2** One **Background glow** switch (Settings › Appearance) for both
  themes, `localStorage['ro-glow']` mirrored as `html[data-glow="off"]`. The
  Aura | Plain setting is gone - its two names disagreed and dark ignored it.
  Switches are iOS's 51 × 31.
- **F3** The share sheet's Route | Stats | Photo in equal segments.
- **F4** A stuck tab strip is covered by the soft scroll edge as the bar is;
  the strip's height is no longer dropped as the bar collapses in.
- **F5** Cards over the glow read white: .86 and saturate 1.6, over a shorter,
  lighter glow (380 pt; 55/48/36 % white).
- **F6** Controls straight on the glow - Activities' search, chips and filter
  button, Analytics' section track - in a frosted white fill (`--fill-on-aura`).
- **F7** The compact title is lead-aligned when it can't be centred on screen.
- **F8** The activity's stats in four equal columns, the time with no "min".
- **F9** Plan's structure bar 44 pt, 10 pt under the detail, 14 over the steps.
- **F10** Activities' week headers wrap their line under the title, never cut.
- **F11** One separator rule for inset groups: 0.5 pt, 16 pt in, 72 under a
  thumb, none above the first or below the last.
- **F12** Settings' Profile footnote in 13 pt muted ink.
- **F13** The share card draws no place name cut at its sides.
- **F14** One today ring everywhere: 2 pt accent, 2 pt off the mark.
- **H1** The fullscreen heatmap's top row is live glass in full ink, over a
  blurred soft edge that sits under it, not over it.
- **F7** The compact title is measured without its own padding, so a title
  within 8 pt of fitting no longer flips between centred and lead-aligned on
  every render (React #185 on /activities).
- **F15** The status bar blends into the header. Both theme-color metas are the
  page's `--background`, read from the token table. The glow starts below the
  safe area and comes in over an eased 24 pt after the edge sampler. Activities'
  Map view has no glow, and an open sheet dims the top edge once, not twice.
  The status bar stays opaque (`'default'`) in both themes: its style can't be
  set per theme, and `black-translucent` draws a white clock on light pages.
- The activity's map is back to 3.0's size: 330 pt tall, with the route framed
  as 3.0 did, about 1.7× larger. Its top fades in from the page, with no line
  under the status bar.

## [3.2.0] - 2026-10-21

### Liquid Glass v3: iOS 26 parity for the PWA

A retune of Liquid Glass v2's chrome to the design handoff of 2026-10-21
(G1-G14): surfaces, shapes, type and motion only, no data, route or feature
changes.

- **G1 Glass object.** `.glass-float` becomes `.lg`: a wrapper with sibling
  blur, 3 pt edge-band and tint layers, a two-sided specular rim and an inner
  glow, as `<Glass>` in `ui/GlassSurface`. Every glass control moves to it -
  the tab bar, the compact bar's buttons and mirrored controls, the header
  toggles, Today's capsule, the back circles, the map controls. Reduce
  Transparency, Increase Contrast and `data-glass="solid"` fall back to the
  raised fill and a line; Reduce Motion keeps a 150 ms fade.
- **G2 Glass press.** Glass swells (1.06), brightens and lights its rim
  instead of shrinking. The tab bar's pill turns into a clear lens that
  follows a press-and-drag, with a haptic per tab.
- **G3 Tab bar geometry.** 62 pt, 24 pt from the sides and foot, concentric
  with the 55 pt display corner; it still minimizes to a circle on scroll.
- **G4 Tab legibility.** Unselected tabs in label ink, the selected one in
  the accent on the pill; 10/12 labels.
- **G5 Top soft edge.** No hairline: three blurs that grow stronger toward
  the top and a tint, 30 pt past the bar. A pinned segmented strip turns to
  glass.
- **G6 Type.** SF Pro through the system stack (Geist still loaded), the iOS
  ramp: 34/41 large titles, 28/34 session titles, 17/22 card titles, 13 pt
  sentence-case section labels.
- **G7 Capsule controls.** Segmented tracks, chips, buttons and the search
  field are capsules on the system fill, with no line.
- **G8 Cards.** Borderless 24 pt cards with a hairline shadow; 12 pt inset
  tiles, concentric with them.
- **G9 Lists.** Inset-grouped rows: 64 pt, 44 pt thumbnails, 0.5 pt
  separators inset 72 pt.
- **G10 Sheets.** One `ui/Sheet`: a medium detent floats as glass 8 pt in with
  a 47 pt corner and a 50 pt CTA; a large detent is full width, opaque, its
  top corners 38 pt.
- **G11 Glass over maps.** Clear glass on the activity's hero (now 300 pt);
  regular glass over the heatmap, its controls inside the map card, and a
  glass legend card in fullscreen.
- **G12 Buttons.** A 50 pt prominent primary with a sheen and an accent glow;
  a filled secondary.
- **G13 Grouped actions.** The hero's expand and share in one capsule; the
  fullscreen map's recenter and basemap too.
- **G14 Light Aura.** Light mode gets a blurred per-page colour field behind
  the top of each page and frosted cards over it; Settings › Appearance ›
  Light background switches it to Plain.

The 3.1 handoff's audit pass (App Fixes), worked through badge by badge.

### Wave 4: the items that needed new data

- Rep pace replaces "workout pace": the work intervals alone, not the
  warm-up and recoveries around them (2b).
- "Heat cost" is "Temperature cost", and says what the cold costs too (2b).
- Goals: a month the plan covers takes the plan's own km as its target
  (3c).
- Records: routes are named after where they go - the point farthest from
  the start - and the owner can rename one. The names live in a new
  owner-only `routeNames` collection (1g).

### Today and Analytics agree

- Today's status line and its load strip read the seven-day load against
  the safe range from the pair Analytics plots, and the line turns amber
  when the load is outside it (1a).
- The coach read's arrow follows the number and its colour says whether
  that is good news: "Fatigue 48, down 23" used to point up (1b).
- The load ratio left Injury risk for the Load trend card, beside the
  load it is made of; under 0.8 is detraining, not an injury (2a).
- The read says why the watch still reads "Productive" while the load is
  low - it looks at 28 days (2a).
- A resting HR below its baseline is no longer flagged as a dip (2a).
- Quality sessions are done, extra and missed; a window with weeks missed
  says so instead of reading as on target (2d).
- Weekly distance: the number leads with its unit and name under it,
  "below plan" and "unplanned" have a swatch each, and a missed week has
  its own dashed outline (1f, 2c).

### Progress, Plan and Activities

- The Progress hub previews its pages: Goals & season instead of a second
  distance chart, the weekly streak instead of a daily heatmap, and VO₂
  max as a line of the Records card (1h).
- Athlete & zones: each zone's share reads after its time rather than
  under the bar, where a 1 % zone had no room for it; the VO₂ ranking is
  the grade's own band (1e).
- A planned session of one step drops the structure bar and lists its
  pace and heart-rate targets (3b).
- A run the watch kept as one lap reads "Whole run" and offers the
  kilometres, never "Interval" (1c).
- Activities: a bar names what a filtered list's totals count, the long
  run is a filter of its own, and a workout row leads with its date
  (1d, 3d).

### Everywhere

- Cyan replaces the blue accent, with its own light-mode value (5b).
- The light-mode heatmap draws a blurred halo under a pale-to-deep ramp;
  the dark one stops at the full accent rather than running on to white
  (4a). The white accent takes a graphite ramp.
- Today without a run is an accent outline, never an accent fill, and the
  routes "latest" bar outlines under the white accent (5a).
- Durations are "1:00 h" from an hour and "45 min" under it (3d).
- The watch's brand is out of the interface: every string says "your
  watch", and a way out to its app reads "Edit in your watch app" and is
  drawn only where the watch has a page to open (3.0 override 1).
- Chevrons and SVG icons in place of arrow and triangle glyphs; the pace
  axis says "up = faster" in words (rules 01, 03, 3d).
- Dynamics says which way is better per metric and colours the "vs your
  usual" line by it (3d).

## [3.1.0] - 2026-10-20

3.1.0 — the final Progress mockups: Goals & season, Records, Consistency
and All time.

### Goals & season

- A year stepper (‹ 2026 ›); the distance goal shows km to go, the
  projected total and a verdict: how far short at this pace, and the
  weekly km that closes it.
- Season: "N of M race targets hit", a Jan–Dec track and one row per race
  with its target and result.
- Monthly volume inline: each month against a twelfth of the goal, hit in
  the accent, short in a lighter accent, the current month dashed.

### Records

- One page with three tabs: Best times, Milestones and Routes.
  /milestones now opens /records?tab=milestones.
- Best times: every distance with its date and the effort list (top 20).
- Routes: each route you repeat, with its latest 16 runs as bars.

### Consistency

- 3M · 6M · 1Y range (6M by default, kept in the address).
- Weekly streak: a week counts when it has 3 or more runs. The same streak
  shows on Today, the Progress hub and Consistency. This week's three
  circles fill as you run; planned sessions are counted.
- Runs per week: one dot per run, on-target weeks in the accent, a line at
  3, the current streak underlined. Tap a week for its sheet: runs, km,
  time, a month calendar and a link to that week's activities.
- Your running week: runs by weekday, with your anchor day and rest day.
- The six-month heatmap and the active-days bars are gone.

### All time

- Average km a month in the header, each year's total under its bar, the
  best month named, and the current month's projected total as a dashed
  outline.

### Elsewhere

- Today: between midnight and the nightly sync, yesterday's AI verdict
  shows, marked "Yesterday".
- Time windows are named one way, short and uppercase: 4W · 12W · 1Y in
  Analytics, 1W · 4W for training zones, 3M · 6M · 1Y on Consistency
  (FR 4S · 12S · 1A). Screen readers hear the full words.

## [3.0.3] - 2026-10-19

3.0.3 — a district the run crosses keeps its name.

- Activity map: the route runs under the map's names, as the heatmap's
  tracks do, so every name stays, drawn over the line on its halo; the
  markers stay on top. The guard that dropped a name on the line is gone.
- Share card: the map is captured without its towns and districts, and the
  card draws them after the route, on a halo of its own ground, so the
  districts a run went through are named. None is drawn where the header's
  or the stats' fade would cut it.

## [3.0.2] - 2026-10-19

3.0.2 — the open items from the 3.0 review (canvas 5b–5f), a run's time
to the minute, and one number format.

### Activity

- Splits: one card with Km / Laps (Km for a steady run, Laps for a
  structured one), KM · PACE · speed bar · ELEV · HR, the fastest km in
  the accent, and a footer with the fastest km and the split verdict.
- The tabs always pin under the header; no card shows behind them.
- Dynamics: a range scale per metric, your usual 8 weeks as a pill and
  this run as a tick, "vs your usual", one legend line.
- The stat strip names its time "Time" (« Temps »), not "Moving"; the
  fullscreen map's card writes it as the strip does: to the minute
  from an hour ("1:07 h"), with its seconds under one ("22:14 min").
- The pace/HR preview keeps its lines apart and labels its ends; Best
  efforts' 1 km shows its time once; the chart cursor stays below the
  headers.

### Progress

- Race card: the date on one line, the race name on its own, Target ·
  Predicted · Gap (amber when slower), and the gap per km.
- Distance chart: y-axis ticks and a labelled goal line.

### Plan

- A rest day is one line, with a "Coming up" list of the week's sessions.
- The week row reads km only; Easy and Long share the blue, and the month
  legend reads "Easy / Long".

### Today

- Sync is a ↻ button; the Yesterday row is gone; week rings and load bars
  take Plan's type colours.

### Everywhere

- One number format: "2,000" and "9.5" in English, « 2 000 » and « 9,5 »
  in French, in the charts' axes and tooltips too.
- Share cards write the time as "1:07 h", not "1:06:39"; under an hour,
  "22:14 min".
- Activities list: a structured title keeps the type on its line, the
  structure under it.
- Light theme: accent text reaches 4.5:1 on every light surface.

## [3.0.1] - 2026-10-19

3.0.1 — polish. The review of the 3.0 build (canvas 3b–3f): tighter hierarchy
and one job per colour, with the chart series pinned to their own hues.

### Today

- The structure bar is drawn only for a session built of steps; an easy or a
  long run is one block of one colour, which the line above already says.
- A rest day's circle is a filled disc with a dash, not an empty ring.
- New "Load · last 7 days" strip: each day's TRIMP against the band a day sits
  in while the week holds its load steady (0.8–1.3 × fitness), today in the
  accent, the days lettered M–S.

### Plan

- A type letter under each day's bar (E, T, Tm, L), a dash on a rest day.
- A step's row carries the set's own time ("27′" for 3 × 8′ with 1:30 jog),
  not its title again.
- The intensity profile merges a split warm-up into one block and draws the
  recovery jogs in the cool-down's grey.
- Month tiles: a run is its type at 25% with a 50% border, a session still to
  come stays dashed. Every week row reads done / planned, a week to come "–".
- The month summary drops the phase line the rows already carry.

### Activity

- The headline stats read 20 px, the time rounded to the minute ("1:07 h").
- One verdict label in the accent ("Strong session · Solid base"), then the
  AI sentence - or nothing, where before it repeated the label.
- Effort reads "RPE 7", not "Effort 7 · Hard".
- Overview opens with a pace and heart-rate preview that switches to Charts.
- Chart series take fixed hues (RUN_CHART_LINE): heart rate #ff6b6b, pace cyan
  #4cc9f0, cadence purple - never the accent, which repainted with the theme.
- The distance axis drops a tick within a step of the end, so "10" and
  "11.5 km" no longer run together.

### Share

- The route is the accent, as the app draws it, with a white start marker on
  dark. The logo sits at 80%, and the stat strip has the card's own ground
  under a full-width hairline.

## [3.0.0] - 2026-10-19

3.0 — redesign. The app-wide UX pass from the RunOmics 3.0 handoff: one
score and one verdict per screen, actionable cards, fewer repeated numbers.
The version number restarts at 3.0.0 after 4.17.0; the earlier 3.0.0 entry
below is the July 2026 release.

### Global

- Five tabs, Progress with a trophy. Dark theme on the handoff's tokens.
- One km format per locale (the map card read "1.306 km" beside "2,684 km").
- Richer basemap: parks, water, a faint hillshade, quieter street names.
- One accent route on a halo, no place name under it, credits behind an ⓘ.

### Screens

- Today: Form dial with the AI verdict, Fitness / Fatigue / Load tiles; the
  next workout opens Plan on its day; compact last run; week circles.
- Plan: a day selector with the selected workout's steps and intensity
  profile, planned vs done on past days; a month grid bordered by phase with
  a summary card.
- Activities: four group chips and a filter & sort sheet; week cards of runs.
- Activity: map hero, one stat strip, verdict with chips, sticky tabs;
  charts with a scrub row and shared cursor; splits with elevation; a
  fullscreen map with recenter and a style toggle.
- Share: a verdict-led Stats card; the Route card fitted between header and
  stats.
- Progress: race card with the gap to target, year chart, records grid;
  Consistency with runs per week and a 6-month heatmap; All time in km per
  month.
- Athlete & zones and Settings: compact VO₂ row, grouped HR anchors, zones
  on four weeks; grouped settings, Sync as a link, cache size.

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
