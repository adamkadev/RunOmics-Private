# Profiles

One code repository drives two deployments, one per athlete. Each has its own Vercel project, Firebase project,
data repository and GitHub Environment, and none of them shares data with the other. This page says what
differs between them, where each setting lives, and what to do when a profile is added. It names settings, never
their values: secrets stay in Vercel, the GitHub Environments and the gitignored `.env.*.local` files.

## The two profiles

| | Owner (`adam`) | Second athlete (`lamiaa`) |
|---|---|---|
| Language | English (`NEXT_PUBLIC_LOCALE=en`) | French (`NEXT_PUBLIC_LOCALE=fr`) |
| Time zone | `NEXT_PUBLIC_TIME_ZONE`, the athlete's own, in the Vercel project | The same, in her Vercel project |
| Watch | Rich data: Training Effect, training status, LTHR, running dynamics | Forerunner 55: none of those |
| Races, goals, PBs | Yes | None |
| Training | Structured blocks with controlled threshold work | A run/walk return to running after a long break |
| Coach command | `npm run coach` (`.env.adam.local`) | `npm run coach:lamiaa` (`.env.lamiaa.local`) |
| GitHub Environment | `adam` | `lamiaa` |
| Data repository | `RunOmics-data-adam` | `RunOmics-data-lamiaa` |
| Vercel and Firebase | Their own project each | Their own project each |
| Operator alerts | Received here | Forwarded to the owner's deployment (`OPS_PUSH_URL`) |

Both deployments are private (`RUNOMICS_PRIVATE=1`): every page needs the `owner` claim or an account listed in
`RUNOMICS_VIEWERS`. The Vercel and Firebase project ids are in each Vercel project's settings and in the
Firebase console; the profile name ties them together through `GITHUB_SYNC_PROFILE` and the Environment's
`PROFILE` variable.

**The second athlete's health.** She is returning to running after a long break, on guidance from her
clinician, kept in `coaching/guidance.md` in her data repository. The coach builds her blocks by time, with walk
breaks, effort and the talk test, and no quality work. Her guidance asks for **no stop signals**: no stop rule,
symptom warning or "stop if it hurts" in her plan, its notes, the app's copy or a push. The planner refuses a
draft or a change carrying one; never write one by hand. Nothing about her health beyond what the coach needs
goes into this repository.

## What each place holds

| Place | Holds | Read by |
|---|---|---|
| Vercel project (per profile) | The app's variables: Firebase client and Admin, `NEXT_PUBLIC_LOCALE`, `NEXT_PUBLIC_TIME_ZONE`, `RUNOMICS_PRIVATE`, `SESSION_SECRET`, `RUNOMICS_VIEWERS`, `CRON_SECRET`, `INTERNAL_NOTIFY_SECRET`, `GITHUB_SYNC_*`, the data repository's read-only token, `RUNOMICS_DATA_SOURCE`, the Gemini, MapTiler and ORS keys, `OPS_PUSH_URL` / `OPS_PUSH_SECRET` | The deployed app and its crons |
| GitHub Environment (per profile) | `GARMIN_PERSONAL_API_KEY`, optional `GARMIN_SECRET`, `RUNOMICS_DATA_REPO_URL`, a read-write `RUNOMICS_DATA_REPO_TOKEN`, `APP_URL`, `INTERNAL_NOTIFY_SECRET`; variables `PROFILE` (the Environment's own name) and `GARMIN_PERSONAL_API_KEY_EXPIRES` | `sync.yml`, the health watchdog, the capability audit |
| `.env.local` | A local dev server: the same keys as Vercel, usually against the demo data | `npm run dev`, `prepare:data`, `set-owner-claim` |
| `.env.adam.local`, `.env.lamiaa.local` | Everything one athlete's coach reads: the data repository and its token, the production Firebase Admin trio (for notes and check-ins), the time zone, `GARMIN_SECRET` (with `GARMIN_SECRET_WRITEBACK`) or `INTERVALS_API_KEY` for pushing a block to the watch, and `GEMINI_COACH_API_KEY` only for `--advisor gemini` | The coach commands, loaded alone with `dotenv -o` |
| Data repository (per profile) | Everything synced from Garmin (runs, `athlete.json`, the calendar, `sync_meta.json`), the nightly backups of Firestore (notes, check-ins, shoe picks, races and goals), the hand-edited inputs and `coaching/` | The app, the sync and the coach; never a session |
| Firebase project (per profile) | Sign-in, notes, check-ins, skipped days, push tokens, avoid spots, shoe picks, races and goals, the job trace | The app; the coach reads notes and check-ins |

The second athlete's data repository has no `explore/` areas, `goals.json`, `pbs.json` or races. Her
`athlete.json` has no LTHR or threshold pace from Garmin. In either profile, `sex: "female"` in `athlete.json`
switches TRIMP to Banister's female weighting.

`firestore.rules` is deployed by hand, once per Firebase project, after every change to it.

## Owner-only and rich-data-only features

**Owner-only** means behind the `owner` claim on a deployment; a viewer sees the pages but cannot write.

- Notes and tags on a run, the HR-unreliable switch, the morning check-in, a skipped day's reason.
- A run's shoe and the default shoe; Settings → Races & goals; spots to avoid and Explore's route generator.
- The Sync button, Settings → Diagnostics, the push switches.

**Rich data only.** These need what the second athlete's watch or data never sends. Each must degrade quietly:
no 0, no empty card and no English word on her French deployment.

| Feature | Needs | Without it |
|---|---|---|
| Garmin's run types | Training Effect | The type is guessed from the coach session, then from pace or LTHR |
| Training status, load focus | Garmin's figures | The app's own load, marked "Estimated"; load focus is hidden |
| Controlled threshold sessions and their rep check | An LTHR | The planner writes none |
| Time in zones | An LTHR or a Training Effect | Not counted |
| Threshold pace, race predictions | Garmin Connect (`GARMIN_SECRET`) | VDOT estimates from the best recent effort, marked as estimated |
| Races, the race page, race-day form | Races in the editor or from Garmin | Progress shows the current block instead |
| Goals, the year's distance goal and its push | `goals.json` or the editor | Goals says how to set one; All time opens instead |
| Records' PBs | `pbs.json` or best efforts | Records shows best efforts alone, or the Comeback tab during a return |
| Running form | A watch or strap that records dynamics | The card is left out |
| Explore's quartiers | `explore/` areas, built by `npm run explore:areas` | The Districts layer and the Explored card are not shown |
| Shoes from Garmin | `GARMIN_SECRET` | Picks and the default shoe in the app |

The demo generator builds a profile like hers (`npm run demo:generate -- --profile sparse`), and the `sparse-fr`
Playwright project runs it in French on an iPhone. Check every change against both.

## Monthly coach renewal

A block lasts about four weeks. The Friday reminder pushes when one ends within seven days or no weekly review
has run for more than seven. For each athlete (`coach:lamiaa` and `coach:sync-garmin:lamiaa` for the second):

1. Check the last nightly sync is green and recent (Settings → Diagnostics, or the health watchdog).
2. Read the block that ends: Plan's "Block finished" card, the notes, and the check-ins.
3. For the second athlete, check `coaching/guidance.md` is current. A new clinician's note goes in first.
4. `npm run coach -- bootstrap` writes the prompt (days, runs per week and the start come from the current plan
   unless given). It runs without `--replace` from seven days before the block ends; earlier it refuses. Answer
   it in Claude Code under the `coaching-plan` skill, never through an API.
5. `npm run coach -- bootstrap --from-answer <reply>`; a refused draft comes back with the reason and the refused
   answer, so correct it and answer again.
6. Review the preview, then `npm run coach -- --apply .coach-previews/<proposal>.json`.
7. `npm run coach:sync-garmin` previews the watch's calendar; `--apply --expect <fingerprint>` pushes it, through
   intervals.icu when the env file has `INTERVALS_API_KEY`, else through Garmin Connect.
8. On the phone, check Plan's phase card names the new block and the first session is on the watch.

## Adding a profile

1. Create a private data repository for the athlete and two fine-grained tokens scoped to it alone: read-only
   for Vercel, read-write for the sync.
2. Create a Firebase project: Google sign-in, Firestore, web push. Deploy `firestore.rules` to it, and grant its
   Admin service account the Firebase Rules Viewer role.
3. Create a GitHub Environment named after the profile, with the secrets and variables in the table above and
   `PROFILE` set to its name.
4. Add the profile to the matrices in `.github/workflows/sync.yml`, `.github/workflows/health-watchdog.yml` and
   `.github/workflows/capability-audit.yml`, and, for a coach, a `coach:<profile>` script set in `package.json`.
5. Create a Vercel project from this repository with the variables above, its own `CRON_SECRET`,
   `GITHUB_SYNC_PROFILE` set to the profile, and `OPS_PUSH_URL` / `OPS_PUSH_SECRET` pointing at the owner's
   deployment.
6. Grant the `owner` claim (`npm run set-owner-claim`) and list any viewers in `RUNOMICS_VIEWERS`.
7. Run *Sync Garmin Activities* for the profile once, then the capability audit to see what the watch sends.
8. If the profile is named in a new file, add it to the deny list in `scripts/export_public_demo.config.json`.
