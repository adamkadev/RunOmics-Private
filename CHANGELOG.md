# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

- Shoes without garth and Garmin warnings (G3, G6). The owner picks a run's
  shoe on its page and sets a default shoe on Shoes, stored in Firestore
  (`runShoes`, `shoeSettings/default`, owner-only rules) and committed nightly as
  `shoe_choices.json`, which the app applies when it loads the runs: a pick wins
  over Garmin's shoe, and the default fills a run Garmin gave none, from the
  pair's first use. The mileage follows after the next sync; the stored `gearId`
  is never rewritten. Shoes says when the list was last refreshed from Garmin
  once that is more than 14 days ago. The ten Connect requests a step reads
  around now land in `sync_meta.json` (`warnings`, `warningsAt`) and the run's
  summary, with `seriesFreshness`, the newest sample of each Garmin series.
  Health reports `connectWarnings`, `seriesFreshness` and `staleSeries`;
  Settings → Diagnostics lists each series and since when it stopped. The rules
  must be deployed by hand to both Firebase projects.

- PWA states, accessibility and French (F6, F10, F11, manifest). Settings →
  Notifications says "add to the Home Screen" where Safari offers no push and
  "blocked in Settings" once permission is refused, with the switches disabled,
  instead of the retry toast. The update banner shows only for another build's
  worker, sits above the tab bar and can be dismissed. Turning notifications on
  takes the token on the running worker (`serviceWorker.ready`) instead of
  registering `/sw.js` without `?v=`, which replaced the build's worker and its
  caches. Today resumed past midnight offers "Page d'hier, actualiser". The
  celebration dialog is named and closes on Escape. `--axis-text` and the faint
  greys reach 4.5:1 on the card, ground, raised and inset surfaces in both
  themes, now tested for every text token. French numbers keep a no-break space
  inside them ("1 705", "45 %"), dates keep U+0020. The workbook's Guide and
  Context sheets are written in the build's language, column and item keys
  unchanged. `/manifest.json` is now a route that adds `lang` and the localized
  description to `id: "/"` and `scope: "/"`; `generate-brand` writes its base in
  `src/app/manifest.json/manifest.base.json`.

- Heart-rate trust and return-to-running progress (F2, F3). The sync reads the
  FIT's paired sensors into each run's `hrSource` (`external` or `wrist`), and
  `athlete.json` takes an optional `hrReliableFrom`: a run before it, a wrist
  run after it, or one the owner marks "HR unreliable" in its note (a new switch
  in the notes sheet, kept with the note and in the nightly backup) loses its
  heart rate everywhere: load, time in zones, easy and workout heart rate,
  efficiency, drift and the classifier's zone rule. Its load is session RPE ×
  minutes, scaled to TRIMP and labelled "estimated from effort" on the run and
  in the workbook (`load_source`). The sync also stores each run's
  `longestContinuousRunSec`, `longestContinuousRunM` and `runningSec`, from
  cadence (or speed, or the splits) with walking left out. From the end of the
  latest break of four weeks or more, Records gets a Comeback tab (first 10, 20
  and 30 minutes non-stop, first 3 and 5 km without walking, first block
  completed), Plan a card with running minutes per week and the longest
  non-stop run, and each new milestone gets the celebration overlay and a push
  in the records category. **Needs** a reprocess of both profiles to fill the
  new fields, and a deploy of `firestore.rules` for the switch.

- Route guards, AI status, rules drift and CI (R11 part, R12, R13, R16). A test
  walks every API route: each `/api/internal/*` handler must go through
  `handleInternalRoute` or `scheduledRoute`, every other one through the owner
  guard or onto an explicit gate-only list, and every `vercel.json` cron must
  export GET through `scheduledRoute`; client-errors, sync dispatch,
  data-revalidate, job-events, version and location-override get route tests.
  Each AI insight pass keeps its status in Firestore `aiStatus/lastPass`
  (written, missed, models Google closed); health and Settings → Diagnostics
  show it, and the operator gets one push after three nights that wrote
  nothing while work was left. `GEMINI_MODEL` now replaces the main pool only;
  the new `GEMINI_BACKFILL_MODEL` replaces the backfill pool. Health reports
  the live Firestore ruleset's hash and the nightly sync warns when it is not
  the repository's `firestore.rules`. CI builds pull requests against the E2E
  data, the weekly coverage run prepares the data first, and E2E's apt step
  gives up after 3 minutes, retrying twice.
- Privacy and backups (R8, R14, R18). Share cards leave out the first and last
  250 m of the route (line, map bounds and markers) unless "Show full route" is
  on, and an image drawn on a basemap now carries the MapTiler and OpenStreetMap
  credit. Settings fetches height and weight from an owner-only route instead of
  rendering them into the cached page, and signing out of a private site clears
  the HTTP cache. The nightly sync also backs up route names and avoid spots
  (`route_names.json`, `avoid_spots.json`), and `scripts/restore_firestore.mjs`
  (a dry run unless `--apply`) can put notes, check-ins, route names and avoid
  spots back. The security doc gains an owner/viewer table and a "Third
  parties" section.
- Analytics keeps its tab and period in the URL (F5), defaults left out as
  Records does, so Back returns to the tab you left and `/analytics?tab=volume`
  opens Volume. Volume's "Since January" now totals the runs, as Progress does:
  it read 0 km without a goals, PBs or races file, and every 1 January until
  `goals.json` had the new year; the goal and projection still come from Goals.
- Progress without a race (F5) shows the current block in the race card's place
  (the coach's block name as on Plan, week n of N, sessions done of planned); a
  year card without a goal opens All time; a new "Athlete & zones" row opens the
  athlete page; and Goals with nothing configured says how to set a goal in
  `goals.json`.
- TRIMP uses Banister's female weighting, 0.86·e^(1.67·HRR), when `athlete.json`
  has `sex: "female"` (F9). **One-time shift:** for a female athlete every
  session's load rises by about 7–19 % (more at easy effort), so fitness (CTL),
  fatigue (ATL) and the planned-session load estimates step up once on the first
  deploy; form (TSB) and ACWR, being differences and ratios, barely move.
- Cleanup (C2, C3, C5, C8). A run's Overview shows its records once, in Best
  efforts, at the top when the run holds a ranked effort. Dead code goes
  (RaceFooter, ListRow, MetricGrid, ChartCard, activityTypeStyle, the unused
  exports, Today's unused aggregates, the Explore worker's own track download);
  `npm run check:cycles` now fails a page that awaits `loadData()` without
  exporting `revalidate`, and CI's weekly run reports `knip`'s findings. The
  sync stops writing the always-null `polyline`. `.env.example` lists every
  variable, the README and docs drop what no longer exists, and a test fails on
  a backticked identifier or path in them the code no longer has.
- A durable trace of server jobs (R4). Every scheduled run and every internal
  5xx is kept in a capped Firestore collection, `jobEvents` (route, trigger,
  outcome, status and error class only; the last 200). Settings → Diagnostics
  shows each job's last run and outcome beside the phone errors, the nightly
  error digest counts server errors too, and the later morning cron sends the
  daily session when the 08:xx Paris run failed, until 10:00. `firestore.rules`
  lets the owner read the trace and no client write it.
- Push tokens stay fresh (R5). On app start, a device with pushes on re-saves
  its FCM token when it changed or was saved over 30 days ago, keeping its
  switches; Settings says when the device could not be registered. The server
  drops tokens not saved in 270 days.
- Runs deleted, re-typed or renamed in Garmin Connect follow in the app (R17).
  After a complete listing, a stored run missing from it moves to
  `removed_activities.json` (at most 5 a night; a list that looks cut short
  removes nothing and makes the night partial), a run re-typed to walking
  lands in Other training, and stored names follow Connect's. Sync data guards
  (R10): a push validates the data contract first, a run that changes month
  leaves its old month file, one id in two month files stops the sync, best
  efforts cap GPS jumps as duration bests do, and the mapper and reprocess
  share `fit_derived_fields()`. The Forerunner 55 profile stops re-asking
  Garmin for 18 empty training-status windows every night (G9).
- The coach's own words reach the app (F1). Plan's phase card names the
  coach's block ("Reprise en douceur") instead of « Préparation générale » and
  adds the week's focus; a planned session's card carries the coach's note,
  its description and notes; Today's session card gives the description's
  first sentence. The text comes from a new route, `/api/coaching/words`,
  behind the private site's sign-in gate, never in a page's HTML. In the step
  list, a warm-up, cool-down or break at a walking pace, or with no target in
  an easy session, reads "walk" (« marche ») instead of "1:00 rec".
- The sync survives garth's token dying (G1). A 401 on the token exchange is
  `GarminTokenExpired`: the sync writes `connect_status.json`, carries on
  through the Personal API with exit 0, stops marking new runs gear-pending
  and skips the shoe list, and the operator gets one push with the runbook.
  `docs/data-and-sync.md` gains a sunset matrix of every Connect-only feature.
- Garmin readings stop at an age (G2). Training status older than 3 days
  gives way to the local estimate on Today and in the overreaching push,
  threshold pace unchanged for 8 weeks to the VDOT estimate, and race
  predictions older than 14 days are dropped by Records and Goals as the Race
  page already did, through one helper.
- Every push opens its page (R6). A new run, its verdict or a record opens that
  run; shoe wear the shoe; a quartier the map; the morning session and the
  digest the plan; a failed workflow its run on GitHub; token and error alerts
  Settings. Each push carries a tag, so a repeated warning replaces the last
  one on the lock screen instead of stacking. The links are absolute HTTPS
  URLs built from `APP_URL` or Vercel's production domain, as FCM requires.
- The Garmin key is announced before it expires (G7). The nightly sync posts
  the Environment variable `GARMIN_PERSONAL_API_KEY_EXPIRES` (a bare date) as
  `garminKey`, and the operator gets a push from 14 days ahead saying where to
  make a new key. A profile with a key and no date gets a warning in the run.
- A watchdog outside the deployments (R2). A daily GitHub workflow checks each
  profile's health and fails, which emails the repository owner, when the last
  sync is 36 hours old, the data is unloaded, or Firebase Admin or the cron
  secret is missing. Health now judges staleness by the last sync rather than
  the last run, so a training break no longer reads as stale, answers 503 when
  stale, and reports `cron`. A nightly dispatch GitHub refuses sends an operator
  push.
- The coach runs through Claude Code by default (N9). `weekly-review` and
  `evaluate` gain the manual path bootstrap had (`--prompt-out` /
  `--from-answer`), sharing the prompts with the Gemini advisor, and every
  coach command now writes its prompt rather than calling an API; Gemini
  coaching needs an explicit `--advisor gemini`. The app's AI copy stays on
  Gemini. A review is no longer told to keep a four-week horizon: it gets the
  weeks left up to the block's end, so a late-block REPLAN no longer throws,
  and a rejected review or evaluation is sent back with the reason, as a new
  block is. Changes to the live plan are also told the notes, check-in and
  return-to-running rules.
- A change to the live plan is held to "no stop signals" too. A weekly
  review's ADJUST or REPLAN and a run's evaluation are now told the athlete's
  guidance, as a new block is, and one that adds a stop rule or a symptom
  warning under that guidance is refused. Only what the change wrote is
  read: a session it reschedules keeps the words it already had.
- A return block runs to the athlete's own pace, on a simple watch. With no
  heart-rate zone in the guidance, each running interval takes the pace range
  the guidance gives, rather than a wide easy range the planner picks, which
  could sit slower than the athlete runs; the wide range stays for guidance
  without one. The watch carries no step notes and no workout notes, only a
  one-line description, the stop rule, and the validator refuses notes on a
  return block. The talk test, the guidance's own with full sentences by
  default, and any walk-down rule go in the week's focus, shown in the app.
- The guidance can turn the stop rule off. A return block writes its stop
  rule as each session's description by default; when the guidance says "no
  stop signals", the planner writes none, and a draft carrying a stop rule or
  a symptom warning in a name, focus, description or note is sent back.
- The second athlete's deployment has a test of its own (E1). The demo
  generator takes `--profile sparse`: a made-up runner on a Forerunner 55, with
  no Training Effect, training status, races, goals or PBs, a long break and a
  French run/walk return block. A third Playwright project, `sparse-fr`, builds
  it in French and runs the layout, Today, Plan and Analytics specs on the
  iPhone, checks that her fixes hold, and runs an axe pass over seven pages;
  only Plan's day buttons, which speak the whole date, are exempt from its
  label-in-name rule.

- The readiness card on Today and the all-time card on Profile lay their
  link over the card instead of around it, so a screen reader reads the
  card's own words, not only "Open load in Analytics" (F10, in part).

- While building back after a break, Today no longer names a form band:
  the status line reads "Building back - no reading yet" alone, as intended,
  and the Form tile shows a dash instead of the break's deep negative number.

- A week of timed sessions with no distance (a run/walk return) no longer
  reads "7 / 0 km" on Plan and Today; it gives the km run alone.

- A run's verdict names the session it was planned as when RunOmics guessed
  its type, so a run/walk the old sync filed as VO2 max reads as easy there
  too, and its effort is judged against an easy run's.

- An operator channel. A second athlete's deployment registers her devices, so
  until now every operator alert it raised - a failed workflow, a data token
  about to expire, the nightly digest of phone errors - woke her phone and
  never the person who could act on it. Those three, and a new weekly
  coaching-block reminder, now go through `sendOpsPush`: with `OPS_PUSH_URL`
  and `OPS_PUSH_SECRET` set they are forwarded to the operator's own
  deployment at `/api/internal/ops-push`, titled with the sending
  deployment's sync profile and written in English whatever that deployment
  speaks. That route is guarded by `OPS_PUSH_SECRET` alone, so the second
  deployment holds a secret that opens nothing else, and a refusal or a
  timeout throws rather than record an alert nobody read. Unset, the alerts
  go to the local devices as before. A stale sync stays with the athlete: she
  can act on it. The weekly reminder fires when a block ends within seven
  days or no weekly review has run for more than seven.

- After a break of four weeks or more, Today holds its load reading for the
  first four weeks of running back: the status line reads "Building back - no
  reading yet" instead of a form band and a load state, the overreaching push
  never fires from the app's own estimate, and the verdict card is told the
  athlete is building back rather than overreaching. Analytics' local training
  status leaves those weeks blank. The acute/chronic ratio is worked out from
  today, not from the last run, so a week off reads as a week off; and a load
  line the app estimated itself says "Estimated".

- French no longer agrees anything with the athlete: the form bands read
  "En fatigue", "Fraîcheur" and "Grande fraîcheur", and three sentences lose
  "Tu es frais", "bien récupéré" and "le plus rapide". The parity test now
  walks the whole French tree, calling every function with sample arguments.

- Plan says where a block stands. In its last week the phase card adds "Block
  ends Sunday; next block not planned yet"; after the last day a "Block
  finished" card counts the sessions done out of those prescribed, in place of
  a run of rest days; a day before the block starts reads "Nothing planned".
  Paging forward now follows the last planned date from either the coach's
  block or the watch's calendar, so a deployment without a coach plan can page
  ahead at all. `npm run coach -- bootstrap` takes `--days`, `--runs-per-week`
  and `--start` from the current plan when they are not given.

- A sheet dismissed and then unmounted before its close animation ends no
  longer leaves a timer behind that sets state on nothing.

- The morning push reads the coach's plan when Garmin's calendar has nothing
  for today, and says nothing at all when no session is planned within a week
  either way, rather than announcing a rest day every morning after a block
  ends.

- `export:demo --check` passes again, and CI runs it with a new `--strict`
  flag, which also fails on a stale config entry. The daylight test uses a
  made-up point, the GPX file name example a made-up quartier, and twelve
  config entries that matched nothing are gone.

- Today's header no longer writes the sync's words beside its button, where
  they squeezed the title. A small toast at the top says what a tap did,
  including when the next sync can run.

- The coach has rules for a return to running after an injury, illness or
  pregnancy break: sessions by time, walk breaks with no pace, effort and
  the talk test as the guide, progress only on comfortable sessions, no
  quality work, and stop rules that defer to the clinician. The coach
  context marks the return (`returnToRunning`) from a stop of four weeks or
  more until a run since holds 30 minutes without a walk. While it is
  marked, the prompt drops the rebuild toward the best four-week average,
  and the volume floor is off, since walks carry no distance. The
  controlled threshold rules (speed weeks, fitness checks, lighter weeks)
  state their condition, so they reach no other block. `trainingBreaks`
  accepts `pregnancy` as a reason, and `validate:data` warns on a reason
  the coach does not know. A heart-rate zone in the athlete's guidance becomes
  the target of the running steps in a return, never beside a pace, which the
  watch would execute instead; walk breaks carry no target.

- Bootstrap reads `coaching/guidance.md` from the data workspace unless
  `--guidance-file` is given, and the decision records the guidance's hash.

- `coach:sync-garmin` uses the same data workspace as `coach --apply`: with
  the private repository configured and no data directory, it fetches the
  data, and `--apply` pushes the Garmin mapping back. A mapping it cannot
  push is saved under `.coach-previews/`.

- When Firestore cannot answer, the coach reads the run notes from the
  nightly `activity_notes.json`, as it already did for check-ins.

- A push that no device accepted now counts as failed, so the scheduled pushes
  and alerts retry it instead of recording it as sent. Tokens FCM calls invalid
  are deleted along with unregistered ones, and refusal codes are logged.

- A Vercel build of a data repository fails unless the site is private with a
  32-character `SESSION_SECRET`.

- The unused `/firebase-messaging-sw.js` route is gone, and so is
  `https://www.gstatic.com` from the CSP's `script-src`.

- The French check-in's mood words are masculine: "Excellent", "Mauvais".

- One rule now pairs a run with its coach session everywhere: the coach's
  adherence and run evaluation, Plan's done marks, a run's name and share
  card, and the guessed types Analytics reads. It takes the session the coach
  matched, else that day's one session the run is named after, then of its
  intended type, then of its kind. A walk/run block the watch filed as VO2
  max no longer reads 0/5 done, and the coach sees each run's intended type
  beside the watch's.

- A run whose watch sends no Training Effect (the Forerunner 55) is no
  longer filed as VO2 max or threshold for its laps alone. A run that
  follows its coach session's reps takes the session's type. Otherwise
  quality types need reps near threshold pace, or, with an LTHR on file, at
  zone 4 heart rate. Time in zone counts only with an LTHR or a Training
  Effect. Analytics' trends, heat cost and the Shoes pages read a guessed
  type as the coach session's; Garmin's measured types are unchanged.

- `/api/internal/latest-verdict` is gone with the iOS Shortcut that polled
  it; the Sync button in the app asks `/api/sync/status`.

- Analytics' Charge tab draws its Load and Training status cards on a watch
  that sends neither, like the Forerunner 55: from the app's own heart-rate
  load, marked "Estimated". Load focus still needs Garmin's own figures.

- Today's morning check-in folds below This week once answered, and is
  edited there.

- A run's page keeps its previous/next run card right under the last card,
  the tab's empty height below it.

- Monday's digest sends the coach's focus whole, on its own line, instead
  of cutting it at 60 characters.

- Explore's loops keep to runnable ground: mud, dirt, grass, steps and
  forest paths cost more than new streets can earn, steep climbs count on
  every loop, and each session has a climb budget (flat for reps, 12 m/km
  the day before them and on a recovery run, 15 on a long run, 20 on an
  easy one). A loop that would finish after dusk keeps to streets, and
  the panel names the sunset. "Trails OK" opens the trails in daylight.
  The panel shows the budget, each loop's climb against it and its share
  on trails. The owner can mark spots to avoid (a fallen tree, a flooded
  path), which every loop goes around: while a spot is being marked, the
  panel steps down to a one-line bar so the map is free to tap. The GPX
  file name is lowercase.

- A run's verdict reads a hilly run's halves by grade-adjusted pace, and
  takes a problem the note reports (terrain, route, safety, pain) at its
  word instead of turning it into a success.

- The heat map looks as it did before: full tracks at the phone's full
  resolution again, after a speed-up had thinned its glow.

- The "Same route" chart on a run looks as it did before: its pace axis,
  date labels, dots and tooltip are Recharts' again, after a hand-drawn
  copy of it had moved them.

- A 12-week checkpoint: Plan's "General preparation" card opens a page
  that sets this cycle against the 12 weeks before it - km and runs a
  week, controlled threshold time and pace guides, heat-adjusted
  efficiency, easy-run heart rate at a set pace, the 5K check, VO2max,
  threshold pace and heart rate, resting heart rate and fitness - each
  marked better, worse or level. A Progress tile gives the cycle's week
  and the tally. Without a coach plan it compares your last 12 full weeks
  with the 12 before.

- The coach in the app: a controlled-threshold run's page shows each
  rep's heart rate from minute 3 against its target and ceiling, with the
  verdict. Each session on Plan shows its state.

- Controlled-threshold heart rates come from each athlete's LTHR, and the
  planner reads the athlete's own numbers instead of rules written for
  one runner. Without an LTHR, no controlled threshold session is
  written. A run from an earlier block keeps its session name.

- Without a threshold pace from the watch, pace zones (Athlete page and a
  run's pace chart) are estimated by VDOT from your best recent effort,
  and marked as estimated. The Race page does the same when Garmin's
  predictions are missing or two weeks old.

- A morning check-in on Today, for you alone: sleep, soreness, stress and
  mood in one tap each, an optional niggle, and illness or travel. A poor
  morning turns the readiness card amber or to rest and says why. The
  Athlete page shows four weeks of mornings and twelve weeks of niggles,
  and the coach reads them.

- On a warm day, Today's session says what the forecast at your usual
  hour will cost, from your own runs: "29 °C at 19:00 - your runs at this
  heat cost about +14 s/km: run by heart rate".

- Strength, cycling, swimming and other sessions are synced into their
  own store, with a strength session's sets. They show on Plan and
  Consistency and in the coach's context, never in running numbers.

- Analytics: the Load tab ends with your watch's load focus,
  Running form is back (cadence, ground contact, vertical oscillation,
  stride), and Intensity shows easy and workout heart rate by week. The
  Athlete page has a fitness age card with a year of history.

- Analytics › Performance draws your best pace for every duration from
  30 s to 2 h, this window against the one before, with a critical speed
  fitted to your 3-20 min bests and set against your threshold pace. A
  hilly run shows its grade-adjusted pace (Minetti) under its stats and
  as a line in the pace lane. Existing runs get both after a reprocess.

- A run's conditions name the sky, the feels-like temperature when it
  differs and the humidity when the air is muggy.

- The morning session push arrives between 08:00 and 09:00 Paris time,
  summer and winter, instead of around lunchtime, and the nightly sync
  starts on time: Vercel Cron runs them, not GitHub's late schedules.

- A Monday push sums up last week: km and quality sessions against the
  plan, the time of your other training, your resting heart rate and this
  week's focus.

- Settings' Training, Shoes and "Records and explored areas" switches now
  decide which pushes each phone gets.

- Each sync copies your run notes and morning check-ins into the data
  repository and refreshes your shoe list from Garmin.

- Faster on the iPhone: a page shows as it streams instead of after a
  full download; owner-only parts no longer wait on a Google frame; the
  Activities list and Plan send less than half the data; the map loads
  its lines when opened and keeps them until the next sync; scrolling does
  far less work per frame; dates and numbers format about 40 times
  faster.

- After a sync, the server renders Today, Activities, Plan, Analytics,
  Profile and your newest run itself, so the first tap does not wait.

- CI: npm audit fails a change only when it touches the lock file, and
  Dependabot's security updates replace the weekly autofix; caches are
  saved from main only and stay under GitHub's 10 GB; tests use every
  core; ESLint keeps a cache; Node 24 is pinned in `.nvmrc`; the iPhone
  layout check runs with reduced motion, split per tab.

- `npm run export:demo` writes the public demo repository from any commit
  and stops on anything personal.

- Explore counts every area you run in, not only the busiest: a
  Strasbourg run shows the quartiers it pushed forward, a Strasbourg
  quartier passing 90% sends its push, and Progress's Explored card shows
  the area you ran in last, with a row that opens each other area's map.

- Progress's Explored card opens with its numbers, worked out on the
  server, instead of a skeleton while the phone fetched every track.

- A complete quartier's sheet says since when ("Complete since May 12").

- Each nightly sync pushes one digest of the errors your phone reported
  since the last one.

- A race page: Progress's race card opens the next race, with Garmin's
  prediction beside your target and best, how the prediction moved over
  12 weeks, what each week has to give to reach the target, and the clock
  at every 5 km at an even pace for both times.

- On a reps day, the route generator ranks flat, traffic-free loops first
  ("Flat for the reps", a toggle beside the other two).

- A run's page shows the quartiers it pushed forward (Sablon 39% → 41%),
  and a sync sends a push when a quartier passes 90%.

- Back from the background after a deploy, the app reloads itself, so an
  iPhone no longer runs last week's code until it is relaunched.

- Errors on your phone are reported, every coordinate scrubbed, and
  listed under Settings → Diagnostics.

- The nightly sync pushes a warning two weeks before a GitHub data token
  expires.

- The main pages are checked in Safari's engine at the iPhone 16 Pro's
  size for text that runs past an edge, after each merge to main and on
  demand for a branch.

- Activities opens on its first months and renders the rest as you
  scroll; on a bad network a page opens from its cache after 3 s instead
  of waiting; Plan loads 18 KB of runs instead of 58 KB; and each month
  file of the data repository is written at about 40% of its size the
  next time the sync rewrites it (the whole history: 6.9 MB, not 16.9).

- The README keeps setup and an index; the implementation notes moved to
  four documents under `docs/`.

- The training export tells a coach what the numbers cannot: a Context
  sheet (goal, running days, the current block and each week's focus,
  upcoming races, injury history, why training stopped), the coach's
  prescription beside each session (pace guide and heart-rate cap), and
  official race results beside what the watch measured. A warm-up, test
  and cool-down the watch saved apart are one row. The sync now stores each
  run's start time, which that needs; older runs get theirs on the next sync.

- Scrolling Activities no longer stutters. The compact title bar wrote a
  style on the whole page as month headers passed under it, and each write
  restyled every run in the list (60-90 ms on a long archive); it now
  writes only on the soft edge that reads it, and weeks off screen skip
  style and layout altogether.

- Filters, search and sort on Activities answer at once: they run on the
  phone, over the archive the page already holds, instead of asking the
  server each time (a type chip took about 200 ms).

- Scrolling Activities no longer downloads every run's page as its row
  passes by (3 MB for the whole list); a run's page loads when you touch
  its row.

- The map opens lighter: its tracks travel as encoded polylines (the home
  area is about 160 KB instead of 570 KB), are fetched once per visit
  rather than each time the Map tab opens, and the heat redraws once
  instead of four or five times. Its basemap skips an image it never used.

- Home, Records and every run's page no longer load the Firestore SDK just
  to check who is signed in, and a run's page loads the similar runs chart
  only when its card opens.

- A chart's readout on Analytics stays on screen over the last weeks: a
  long one ("Week of Oct 12 · 44.8 / 48 km") ran past the card's edge.

- Picking 1Y on Analytics no longer moves the period control under the
  title: a year's range now reads by its months ("Oct 2025 – Oct 2026"),
  short enough to stay beside it.

- The dark Stats share card has the app's glow, in the run's own colour,
  so it reads as RunOmics rather than a flat black field; a faint grain
  keeps it from banding once a social app recompresses the image.

- On a laptop, Progress's Consistency card is as tall as Explored beside
  it, its week bars grown to fill it, instead of stopping short.

- The next quartier is the nearest one not yet complete, so the quartiers
  around home are finished first and the suggestion moves outward from
  there; it used to favour the least explored, an untouched quartier
  across town before a half-done one next door.

- An easy run with strides reads as one on its Laps view: the run's own
  lap ("Run 8.00 km") instead of an 8 km "warm-up", and the strides listed
  with their count, fastest and average rather than graded like threshold
  reps (a band, a spread and a heart-rate drift mean nothing over 20 s).

- A run's Laps view shows every warm-up lap: a warm-up of 1.7 km easy,
  1 km steady and 1 km a touch quicker showed its first lap only.

- A planned session's warm-up on Plan now counts all its parts: a warm-up
  of 1.7 km easy, 1 km steady and 1 km a touch quicker read as its first
  10 minutes only; it now shows the whole time and each part's pace.

- The server runs in Paris instead of Washington, next to the
  database and the route provider: every request that is not a cached
  page answers about 150 ms sooner (the sync, the map's tracks, new routes,
  a page's first render after a sync).

- The route generator times a loop at your own easy pace, the median of
  your last eight weeks' easy runs, rather than the plan's prescription: a
  threshold day read "At 5:10", the session's reps and warm-up averaged.

- Explore's route generator starts where you choose: tap the map where you
  will set off (the default), or start in the quartier as before. The loop
  starts exactly at the tapped point and goes through unexplored streets of
  the quartier and back, so there is no getting to a start across town
  first; when the quartier is out of reach for the distance, the panel says
  the shortest distance that gets there. The app never reads your location,
  and the points it routes through are never within 600 m of home.

- A run's place name no longer sends its first point to OpenStreetMap's
  geocoder: the lookup gets a point rounded to about a kilometre.

- The maps stay dark on the dark page after you leave the app and come back.
  iOS flips the page to light and back for its app-switcher snapshots; the
  heatmap and the activity map ignored a flip back that came while the light
  style's tiles were still loading, which on the way out of the app is most
  of them, and stayed light. They now act on any theme change once the
  style itself has loaded, tiles or not.

- The background glow is on every page but the maps: All time, the sign-in
  and the not-found page now have it too, and a page with no palette of its
  own takes Today's. An activity and Activities' Map view still have none.

- A deployment can read its data repository at run time
  (`RUNOMICS_DATA_SOURCE=github`), so a sync shows within seconds of the push
  instead of after a Vercel rebuild: the sync pings the app instead of firing
  the deploy hook, and waits seconds for it rather than minutes. Each new
  commit is checked against the data contract before it goes live; a refused
  one leaves the previous data up and fails the sync, naming the error. The
  dashboard and Settings refresh as soon as the run's data is live, before
  its verdict. The map's routes are revalidated on every request rather than
  cached for an hour at the edge, since a sync no longer starts a fresh
  deployment.

- The Sync button starts a quick sync: the new runs come through the
  Personal API key alone, with no WARP install and no garth sign-in, while
  the nightly sync keeps doing everything. A run synced this way has no shoe
  until the next full sync, which now asks Connect for the shoe of every run
  it has not answered yet, however old, rather than only the last ten days'
  (a run read on a night Connect was down gets the same); until then its
  page shows no prompt to add one. A profile without a key syncs in full,
  and a quick sync whose key is refused fails rather than fall back to
  garth. Runs for one profile now wait in turn: a newly queued one no longer
  cancels the one already waiting.

- The sync no longer stops when Cloudflare WARP will not install or
  connect, as long as the profile has a `GARMIN_PERSONAL_API_KEY`: the runs
  come through the Personal API, and only garth (gear, the calendar,
  Connect's metrics) misses the night, which counts as partial. WARP's
  package, which now pulls about 120 MB of desktop libraries, is cached
  between runs and gets 10 minutes and retries instead of 5. Without a key,
  WARP is still required.

- Each sync's summary page on GitHub times it from the tap: when the job
  started, the data was pushed, the deployment carrying it went live and the
  first AI pass wrote the run's verdict (the Sync button's "done"), then
  every step and the Vercel build on their own.

- VO2max keeps moving on a night without Garmin Connect (no `GARMIN_SECRET`,
  or a garth token past saving): each run's FIT file carries Garmin's own
  reading, within 0.1 of Connect's daily value. The runs after Connect's
  last sample carry the VO2max history on, marked as carried, and the
  athlete's VO2max and VMA follow the newest of them in Connect's whole
  points; without such a run, Connect's values stay. When Connect answers
  again, its series replaces every carried sample. With Connect, nothing
  changes: Lamiaa's data comes through the fallback exactly as Connect
  wrote it.

- The sync reads activities through Garmin's Personal API when the profile's
  GitHub Environment has a `GARMIN_PERSONAL_API_KEY`: the activity list, each
  run's detail and original FIT file, its time in HR zones, the daily resting
  HR, and the athlete's zones, LTHR, age, fitness age and weight. The key is
  official and replaceable - create it in Garmin Connect, a year at most -
  where garth's token, the one credential everything hung on, cannot be
  minted again since Garmin's March 2026 login change. `GARMIN_SECRET` stays
  optional for what only Connect's private API serves: each run's shoe, the
  calendar, training status, race predictions, VO2max and threshold history.
  When its sign-in fails the runs still sync, and the night is reported as a
  partial one. Without a key the sync reads everything through garth, as
  before. Checked against both athletes' accounts: Lamiaa's 37 runs, fetched
  again through the key alone, match what the garth sync stored, field for
  field.

- HRV is gone from the app and the sync: neither athlete sleeps with the
  watch on, so Garmin recorded it a handful of nights a year. The coach
  read's recovery row and the Form card read resting HR alone, against the
  same 60-day baseline; a dip is resting HR above it. The unused two-series
  Recovery card is deleted.

- Routes are stored as recorded, start and finish included: privacy zones are
  gone. Both deployments are private, so only a signed-in owner or invited
  viewer ever sees a route, and the zones cost a required secret per athlete,
  two workflow steps and a crop that hid where every run began. The sync no
  longer reads `PRIVACY_ZONES`, `PRIVACY_RADIUS_M` or `PRIVACY_SALT`; delete
  them from the GitHub Environments. *Sync Garmin Activities* with
  `reprocess` rebuilds the routes already stored, in full, from their cached
  FIT files.

- Explore, quartier boundaries (X1): `npm run explore:areas` builds the
  home city's units into the data repo as `explore/<id>.geojson`: the
  city's quartiers (OpenStreetMap admin_level 10, then the city's open
  data, then IGN IRIS, then the commune) and every other commune the home
  area touches, simplified to 5 m, with the 150 m cells that hold a
  runnable way (OpenStreetMap footways, paths, streets) as each unit's
  denominator. Metz comes from the Eurométropole's 14 quartiers. The app
  serves the file at `/api/explore/areas/<id>`, cached by version; nothing
  real is committed to this repo.

- Explore, coverage (X2): a Web Worker turns each run into 150 m cells
  (steps filled in every 75 m, a jump over 300 m left open) and counts, per
  unit, the runnable cells visited, the share (complete at 90 %, fog under
  15 %), the km run there and the last run. All 317 runs take about 30 ms.
  The area file and each run's cells are kept in IndexedDB, so a new
  deployment only works through its new runs. The next quartier to explore
  is the incomplete one with the lowest coverage plus distance from home
  (6 km weighs as much as the whole 0–100 % range), within 5 km, quartiers
  before neighbouring communes. `/api/map/routes` also returns each track's
  activity id. The demo dataset gets a fictional seven-unit area.

- Explore, loop routes (X3): `POST /api/explore/route` asks
  OpenRouteService for round trips on foot from a quartier's public centre
  (home is never sent), five seeds at a time, and re-asks once when a loop
  misses the distance by more than 15 %. The key (`ORS_API_KEY`) stays on
  the server; on a private site any signed-in session may call it, on a
  public one only the owner, 12 batches a minute. Loops are scored on
  distance, the share of new ground and the share on busy roads, and leave
  as GPX 1.1 files that Garmin Connect, Coros and Suunto import.

- Explore, Districts on the map (X4): a round glass layers button above
  the ⓘ switches the Activities map between Heat and Districts and
  remembers the choice; it turns accent while Districts is on and only
  shows where the area has quartiers. Districts draws each unit over the
  heat: accent outline and a light fill when complete, a neutral outline
  when partly run, a veil with a dashed edge under 15 %. Name and share are
  map labels (the base map's own name for a quartier gives way to them),
  the legend reads Fog / Partly / Complete and is solid, not glass, and the
  insight card counts quartiers: "1 of 21 quartiers complete. Bellecroix is
  next, 3.0 km from home." Heat is unchanged; `?layer=districts` opens the
  map on Districts.

- Explore, expand and a quartier's sheet (X5): on Districts, Expand fits
  the map to every quartier, with the legend at the bottom left, layers and
  ⓘ at the right, and a glass card naming the next quartier at the foot.
  Tapping a quartier (after 300 ms, so a double tap still zooms) opens its
  sheet: the share explored on a bar with the 90 % mark, the km run there,
  the last run and the distance from home. The camera keeps the quartier in
  the free part of the map, above the sheet on a phone, beside it where the
  sheet is a centred card, and the controls under a sheet are taken away
  rather than blurred. `?quartier=<id>` opens a quartier's sheet.

- Explore, plan a run (X6): "Plan a run" (insight card, expanded map,
  quartier sheet) opens the route generator on that quartier: the loop in
  accent for new ground and the foreground colour for streets already run,
  a dashed line back home, and a panel with the planned session, a 0.5 km
  distance stepper, Avoid busy roads and New streets first, the distance,
  time at the plan's pace, climb and share of new ground. Regenerate shows
  the next best loop; Download GPX saves (or, in the iPhone app, shares)
  `RunOmics-<Quartier>-<km>km.gpx`, then reads Saved with a Share button.
  Plan's session cards get "Find a route", which opens it with that
  session's whole distance and pace, and Progress gets an Explored card:
  the share explored, quartiers complete, one segment per quartier and the
  next one to run.

- French fits a 393 pt phone, round 3, from a probe of every route for text
  cut, off screen or out of its card:
  - Athlete & zones: the time column holds « 4 h 48 · 32 % », which ran
    past the card at 4.5rem (5.5rem, tighter gaps).
  - Today's Condition and Fatigue tiles: « ↘ 21 en 7 j », where « 21 cette
    semaine » ran out of the tile.
  - Milestones' streak: « En cours · chaque semaine depuis », no longer cut
    beside its date.
  - A run's PR badge on its row reads « RP Distance » for the longest run,
    which left a name like « Race Day » as « Race … »; Records keeps « Plus
    longue sortie ».

- Cards are never blurred (D1): over the light glow each card had its own
  24 px backdrop blur (F5) - every card in a list, on screen or not, 77 on
  Activities. They are now 88 % white with no blur, so the glow still tints
  the first card a little through them; dark is unchanged.

- One rule for a card's caption (L5): at the right of its title only while
  it fits there on one line, otherwise under the title from the left, 13 pt
  muted - never a right-aligned caption wrapped under the title, as
  Temperature cost's was. Its caption reads "Pace at 149 bpm vs your best
  band".

- No empty bands in Analytics' Load and Aerobic efficiency cards (L4): the
  Load sparkline was drawn from zero, so its line and band sat in the top
  half, and the efficiency chart padded a flat 0.05 m a beat either side of
  a range near 0.04, leaving it in the middle third. Both charts are 72 pt
  and fit what they draw (at least 0.04 m a beat for efficiency, so a level
  month is not stretched into noise); gaps in the Load card are 12 pt.

- Goals & season's title on one line (L3): the ‹ 2026 › stepper shared the
  large title's row and broke it onto two, pushing the first card 50 pt
  down. The stepper is in the button row, opposite the back button, in the
  same 44 pt glass, and the title has the full width. The rule for large
  titles: a control may sit beside one only while the title stays on one
  line; if it would wrap, the control moves to the button row. Goals is the
  one page that wrapped.

- An activity's four numbers share one baseline (L2): "Time", with no
  unit, sat about 7 pt higher than Distance, Avg pace and Avg HR. Every
  value now sits in one fixed 44 pt row, every label in the row under it,
  at 15 pt. The value is 28 pt where its column allows and the size that
  fits "1:10:31" on a phone, the same across the row.

- The page ends clear of the tab bar's pill (L1): the bottom padding is the
  bar's float, its 62 pt and 24 pt of air over the home indicator's inset,
  read from the bar's own tokens, on every page, so at scroll end the last
  card - an activity's Previous run - sits whole above the pill.

- A stuck tab strip is glass over the rows (F20): Activity detail's
  Overview / Splits / Charts / Dynamics strip, Analytics' and Records' turn
  to glass as they stick, now fading in over 120 ms, but the soft scroll
  edge grew by the strip's height (F4) and painted the page's ground behind
  the glass, so on Activity detail it read as a flat grey track. The edge
  is now the bar's own under a glass strip, and the rows pass visibly under
  it; dark takes light's edge while one is stuck, solid above the strip.
  Activities' month headings still grow it. In-card switches stay flat.

- Activities' search, chips and filter button are glass in dark too (F19):
  in the header zone, they were flat grey in dark beside the glass List |
  Map. Over the glow they take the regular glass's tint, sheen, rim and
  drop in both themes, the selected chip still solid. The search field and
  the chip row each sit on one shared blur, not one per chip, which also
  takes three blurs off the light list.

- The glow on the Shoes pages (F17): Shoes, a shoe's page and Compare were
  the one Progress family on the flat ground. They take Records' glow, amber
  left and teal right, in both themes; the Background glow switch turns it
  off as everywhere else.

- No ghosts under the light compact bar (F21): on an activity, the chips and
  the hero card's foot showed through the light scroll edge as a smudge.
  In light the edge is now the page's ground, solid from the screen's top -
  status bar and bar one surface - to the bar's foot, then gone over 24 pt,
  with a 6 px blur in that band only. Dark keeps its edge.

- One sheet material (F18): Filter & sort and Share run were opaque panels
  beside the glass of Map Filters, Coach "Why" and Week of…. Every sheet, in
  either detent, is now the same glass: the sheet fill under a 28 % sheen,
  a 28 px blur (saturate 1.8 dark, 2 light), the rim and the sheet's drop.
  The light scrim is a 16 % tint of the page's ink, not a 20 % grey wash.
  Close, Reset and the segmented controls on a sheet take a light
  translucent fill, an unticked type in Filter & sort is a 1.5 pt ring, and
  Share run's card - the image it exports - stays opaque.

- French fits a phone (393 pt), found by scanning every page, tab and
  sheet for cut text: the sort is Récentes · Anciennes · Longues · Rapides
  (four ellipses before), Z1 is « Récup », fitness age reads « 27 (32 ans) »
  and a tile alone on the card's last row takes the row, the Activities
  chips read « Tout » with 12 pt sides so all four sit beside the filter
  button, Settings' row reads « Seuil 172 · max 189 », and the dynamics
  legend « Ta plage habituelle sur 8 semaines ».

- Light-mode glass reads as glass (F16): the bar's buttons, the tab bar,
  the map's controls and the medium sheets were 52-82 % white, a flat
  opaque pill on the near-white page. They are now 22 % (tab bar 36 %,
  sheets 55 %, clear 10 %) with a wider, more saturated blur, so the Aura
  and the cards show through; a darker hairline and drop keep every edge
  visible on the plain page. Activities' search, chips and filter button
  and Analytics' section track take the same glass. A medium sheet blurs
  28 px, so the page's headings and the tab bar's labels no longer read
  through it, and labels on light glass keep 4.5:1: secondary and accent
  text take a darker glass shade (the active tab, a sheet's Reset, its
  section titles), as iOS's vibrant labels do. Dark mode is unchanged.

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
