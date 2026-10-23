# Running more than one deployment

RunOmics is single-tenant by design: a build bakes exactly one athlete's dataset
into `data/`, and every value that identifies that athlete is an environment
variable. A second person therefore doesn't need a second codebase - they need a
second *deployment* of this one.

The repository is never forked for this. A fork would be a second git history to
keep in sync by hand forever, and it would buy nothing: everything that differs
between two athletes already lives outside the repository.

|             | Shared                        | Per athlete                                   |
|-------------|-------------------------------|-----------------------------------------------|
| Code        | this repository, one branch   | -                                             |
| Data        | -                             | a private `runomics-data-*` repository        |
| Hosting     | -                             | a Vercel project with its own domain and env  |
| Firestore   | -                             | a Firebase project                            |
| Automation  | the workflows in `.github/`   | a GitHub Environment holding that athlete's secrets |

Each athlete is a **profile**: a name (`adam`, `lamiaa`) that is simultaneously the
GitHub Environment name and the matrix entry in the scheduled workflows.

---

## Why a separate Firebase project

The Firestore collections are flat, global names - `activityNotes`, `pushTokens`,
`aiInsights`, `aiBudget`, `notifications` - with no athlete in the key, and the
activity page serves any note it is asked for (`/api/activities/[id]/note`). Two
deployments pointed at one Firebase project would therefore share notes, push
tokens and the AI budget document.

A second Firebase project isolates all of it for zero code change, because the
client and admin SDKs are already configured entirely from `NEXT_PUBLIC_FIREBASE_*`
and `FIREBASE_*`. The alternative - threading a collection-name prefix through the
four constants and the rules file - buys one less console to manage and costs a
permanent code path; it isn't worth it.

---

## Adding a profile

Steps 1-3 fill the data repository, steps 4-5 stand the deployment up, step 6
hands it to the automation. Only the last one touches this repository.

### 1. The data repository

Create an empty **private** repository, one per athlete - `runomics-data-lamiaa`
holds hers. Nothing is committed by hand: `scripts/sync.py` fills it on the first
run, and `scripts/prepare-data.mjs` fetches it back at every build.

Mint a fine-grained GitHub PAT scoped to *only* that repository, with
**Contents: Read and write**. Set an expiration and diarise the rotation.

Seed the three hand-edited files once the first sync has landed - see the README's
[Configuration](../README.md#goals-pbs-athlete-profile) section for their shape:

- `athlete.json` - `displayName` at minimum; the Garmin-derived fields fill in by themselves
- `goals.json` - annual distance and race targets
- `pbs.json` - official chip times

An empty repository is not enough. `fetch_private_data.mjs` clones it and fails
if there is no top-level `data/`, and `push_private_data.mjs` pushes from that
same clone, which has no branch to push to until the repository has one commit.
Give it one:

```bash
git clone https://github.com/<you>/runomics-data-<profile>.git seed && cd seed
mkdir -p data && touch data/.gitkeep
git add -A && git commit -m "chore: initial data directory" && git push
```

### 2. The Garmin key

The athlete creates a Personal API key on
[Garmin Connect's Personal API page](https://connect.garmin.com/app/settings/personalApiToken),
signed in to their own account, with the longest lifetime offered, and passes
it to you once (Garmin shows it only at creation). That is
`GARMIN_PERSONAL_API_KEY`: it reads the runs, resting HR and the athlete's
zones, it never reaches Vercel, and a new one replaces it when it expires.
Nobody's password leaves their hands.

`GARMIN_SECRET`, garth's token, is optional on top of it: gear, the Garmin
calendar, training status and race predictions come only from Connect's
private API, and VO2max from it at its most precise (without it, the sync carries
VO2max on from the runs' FIT readings). `python scripts/get_secret.py` mints it from the
athlete's login - when it works: Garmin's March 2026 login change broke it, so a
new athlete may have to go without. See the README's note on `garth`.

### 3. The first sync

The nightly workflow syncs *changes*; the first run for a new athlete pulls their
whole Garmin history and is worth doing by hand, in a scratch clone so your own
`data/` and `.env.local` stay untouched:

```bash
git clone https://github.com/<you>/RunOmics-Private.git /tmp/first-sync
cd /tmp/first-sync && npm ci && pip install -r scripts/requirements.txt

export GARMIN_PERSONAL_API_KEY="<from step 2>"
export GARMIN_SECRET="<from step 2, if you have one>"
export RUNOMICS_DATA_DIR="$PWD/data"          # server-only scratch workspace
export RUNOMICS_DATA_REPO_URL="https://github.com/<you>/runomics-data-<profile>.git"
export RUNOMICS_DATA_REPO_TOKEN="<from step 1>"

node scripts/fetch_private_data.mjs data     # records the commit it hydrated from
python scripts/sync.py                       # several minutes, writes data/
node scripts/push_private_data.mjs data
```

The fetch is not optional even on a repository that holds nothing yet: pushing
replaces `data/` wholesale, so it is only allowed against the exact commit the
workspace was fetched from. See [Concurrent writes](#concurrent-writes-to-a-data-repository).

This has to precede the Vercel project's first build: `prepare-data.mjs` fetches
the data repository at build time and fails loudly rather than falling back to
demo data. Every later sync is the nightly workflow's job.

### 4. The Firebase project

Create a second project in the Firebase console, then:

- **Authentication** → enable the Google provider, and add the Vercel domain from
  step 5 under *Authorized domains* once it exists
- **Firestore** → create the database, then deploy this repository's rules to it:
  `firebase deploy --only firestore:rules --project <her-project-id>`
- **Cloud Messaging** → generate a Web Push certificate for the VAPID key
- **Project settings → Service accounts** → generate a private key for the
  `FIREBASE_*` admin variables
- Grant the owner claim **after** step 5, once she has signed in to the deployed
  app at least once: the script looks her up by email, so the Firebase Auth user
  has to exist. Put her values in their own env file rather than overwriting
  yours, then
  `npx dotenv -e .env.lamiaa -- node scripts/set_owner_claim.mjs`.
  She signs out and back in afterwards to pick up a token carrying the claim

### 5. The Vercel project

Import **this same repository** into a new Vercel project on the same branch -
Vercel supports any number of projects per repository. Give it its own domain.

| Variable | Value for this profile |
|----------|------------------------|
| `NEXT_PUBLIC_LOCALE` | `fr` for a French UI, `en` (or unset) for English |
| `NEXT_PUBLIC_OWNER_EMAIL` | her Google account - the account `set-owner-claim` grants the `owner` claim to, not itself an authorization check |
| `NEXT_PUBLIC_FIREBASE_*` | from her Firebase project (step 4) |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | her service account |
| `RUNOMICS_DATA_REPO_URL`, `RUNOMICS_DATA_REPO_TOKEN` | her data repository and its PAT (step 1) |
| `INTERNAL_NOTIFY_SECRET` | a fresh random string, **not** the one used by another profile |
| `GEMINI_API_KEY` | her own key for the general AI surfaces - the free-tier quota is per key, so a shared one has the two deployments starving each other |
| `GITHUB_SYNC_TOKEN`, `GITHUB_SYNC_REPO` | the Sync button's PAT (Actions: Read and write on this repository) and this repository - may be shared |
| `GITHUB_SYNC_PROFILE` | her profile name, `lamiaa`: her Sync button then syncs her data only, and its limits (one run at a time, 10 min apart, 12 a day) count her runs only. Unset, a tap syncs both athletes |
| `NEXT_PUBLIC_MAPTILER_TOKEN` | may be shared, subject to the plan's request quota |
| `RUNOMICS_PRIVATE` | `1` - **required for a real athlete's data**: routes are stored as recorded, start and finish included, and without it every route is public. Only the demo dataset may go without. See [A private deployment](#a-private-deployment) |
| `SESSION_SECRET` | with `RUNOMICS_PRIVATE`: a fresh random string of 32+ characters (`openssl rand -base64 32`), **not** another profile's |
| `RUNOMICS_VIEWERS` | optional, with `RUNOMICS_PRIVATE`: Google accounts that may view without being the owner, comma-separated - yours, on her deployment |

`GEMINI_COACH_API_KEY` is deliberately absent: the adaptive coach is a local CLI
(`npm run coach`) for now, so no deployment and no workflow reads it. It lives in
her local `.env.local` only, and moves here if a server-side coaching route ever
ships.

`NEXT_PUBLIC_LOCALE` is read at build time (`src/i18n/index.ts`), so changing it
needs a redeploy. The French translation is complete and kept at parity with
English by `src/i18n/__tests__/parity.test.ts`, and the Gemini prompts follow the
same locale, so the AI verdicts come out in French too. So do the push
notifications (`t.notifications`). The coach CLI reads the locale from its own
environment, not from Vercel: put `NEXT_PUBLIC_LOCALE=fr` in her local
`.env.local` too, or `npm run coach` writes her plan - titles on the watch
included - in English.

Finally, create a **Deploy Hook** on the project (Settings → Git) - the sync
workflow calls it once new data has been pushed.

### 6. The GitHub Environment

Under **Settings → Environments**, create an environment named after the profile
(`lamiaa`) and add these secrets to it:

| Secret | From |
|--------|------|
| `GARMIN_PERSONAL_API_KEY` | step 2 |
| `GARMIN_SECRET` | step 2, optional |
| `RUNOMICS_DATA_REPO_URL`, `RUNOMICS_DATA_REPO_TOKEN` | step 1 |
| `APP_URL` | her Vercel domain, no trailing slash |
| `INTERNAL_NOTIFY_SECRET` | must match the Vercel value from step 5 |
| `VERCEL_DEPLOY_HOOK_URL` | step 5 |

Add one environment **variable** as well - `PROFILE`, set to the environment's own
name. Naming an environment does not hide the repository-level secrets: an
environment that doesn't exist yet, or that exists but was never populated, quietly
falls back to whatever is set repository-wide, which would sync one athlete's
Garmin account into another's data repository. Every workflow checks
`vars.PROFILE` against its matrix entry first and fails loudly if they disagree,
and no inherited value can satisfy that for more than one profile.

Environment secrets shadow repository secrets of the same name, which is what lets
every `secrets.*` reference in the workflows stay unchanged. Do the same for your
own profile: move the existing repository secrets into an `adam` environment, or
copy them there and delete the repository-level copies once a run has gone green.

Then add the profile to the matrices in `.github/workflows/`:

- `sync.yml` - the list in the `profiles` job, and the `profile` dispatch input's `options`
- `weekly-reminder.yml`, `daily-session-reminder.yml`, `stale-sync-check.yml` - `matrix.profile`

> **If your plan doesn't offer environment secrets on private repositories**, keep
> the same matrix and swap the lookup for suffixed repository secrets
> (`GARMIN_SECRET_LAMIAA`, ...) selected through `matrix.include`. Uglier names,
> identical behaviour.

---

## How the workflows behave with several profiles

- **Independent.** `fail-fast: false` everywhere: an expired Garmin token or an
  unreachable deployment on one profile leaves the others alone.
- **Guarded.** Every workflow fails before doing anything if the environment
  doesn't declare `PROFILE`, and `sync.yml` additionally requires a Garmin
  credential (`GARMIN_PERSONAL_API_KEY`, or `GARMIN_SECRET` alone, with a
  warning) and both `RUNOMICS_DATA_REPO_*` values - checked before Garmin is
  contacted.
  Without the second check a typo'd secret name would start from an incomplete
  default workspace. The workflow now hydrates the complete private dataset into
  server-only `data/`, syncs it in place, and pushes that same complete workspace.
- **Cached separately.** The FIT cache key is prefixed with the profile;
  a shared key had each profile restoring, then re-uploading, the other's files.
- **Serialised per profile.** `concurrency: sync-<profile>` stops a manual run
  from overlapping the nightly one against the same data repository. Different
  profiles still run in parallel.
- **Targetable.** A manual `sync.yml` dispatch takes a `profile` input, because
  `--force` and `--limit` only ever mean something for one dataset.
- **Reprocessable.** `reprocess` rebuilds that profile's stored runs from the
  cached FIT files with the current parser (`scripts/reprocess.py`), asking
  Garmin for nothing - for runs stored before a parser fix, such as the best
  efforts that moved to the moving clock in v5.5. It also restores the full
  route of a run stored while privacy zones still cropped it.

---

## Concurrent writes to a data repository

`concurrency: sync-<profile>` serialises the *workflows*, but nothing stops a
human - or `npm run coach -- --apply` - from committing to a data repository
while a sync is running. That matters because pushing is a wholesale
replacement: `push_private_data.mjs` deletes the clone's `data/` and copies the
workspace over it. A sync takes minutes between its fetch and its push, so
without a guard anything committed in that window is deleted rather than merged.

The guard is optimistic concurrency:

- `fetch_private_data.mjs` records the exact commit it hydrated the workspace
  from, in `.<workspace>.base-revision.json` **beside** the workspace. It is
  never written inside `data/`, which is copied verbatim into the data
  repository and must hold athlete data only.
- `push_private_data.mjs` clones, compares the remote head with that recorded
  commit and, if they differ, refuses before touching anything:

  ```
  Private data changed since this workspace was fetched.
  Expected base: <sha>
  Current remote: <sha>
  Refusing to overwrite newer data. Re-fetch and retry.
  ```

There is deliberately no automatic merge - the two sides are arbitrary JSON
state, and guessing at a resolution is how data goes missing quietly. Re-run the
operation from fresh data instead; a nightly sync that refuses simply syncs the
same activities again on the next run.

A workspace with no recorded base is refused too, since it is unknown what it
was built from. Hydrate it with `fetch_private_data.mjs`, or set
`RUNOMICS_DATA_BASE_REVISION` to the commit it was built from if you know it.

---

## A private deployment

`RUNOMICS_PRIVATE=1` closes the whole site to anyone who is not signed in: every
page redirects to `/sign-in`, every API answers 401, before any page - cached or
not - is served (`src/proxy.ts`). The owner gets in by the `owner` claim, and
each address in `RUNOMICS_VIEWERS` by its verified Google sign-in, so the two
athletes can each open the other's deployment. Unset, nothing changes.

`/sign-in` trades the Firebase ID token for a session cookie, verified once and
then signed with `SESSION_SECRET`; the proxy checks only the signature. The
cookie lasts 30 days, after which `/sign-in` checks the Google account again -
without a tap while the browser still holds the account. Changing
`SESSION_SECRET` signs everyone out.

Turning it on, in order: set the three variables on the Vercel project,
redeploy, then open the site and sign in. An account without the claim is told
it is not invited: grant the claim (step 4) and sign in again. Sign-out in
Settings ends the session and clears the pages the device cached.

What it does not cover:

- **What the data says.** The gate decides who opens the site, not what
  the data holds: routes are stored as recorded, start and finish included,
  so a shared card or screenshot, the data repository and anyone invited see
  them whole. (Privacy zones used to crop them; *Sync Garmin Activities*
  with `reprocess` rebuilds every run with a cached FIT file in full.)
- **The workflow's routes** (`/api/internal/*`) keep their own shared secret
  and stay reachable, as the sync needs them.
- **Notes come through the app.** The activity page reads a note from
  `/api/activities/[id]/note`, behind the gate, and `firestore.rules` lets only
  the owner read `activityNotes` directly. Deploy the rules to each Firebase
  project after the app (`firebase deploy --only firestore:rules --project
  <id>`): until then a note can still be read straight from Firestore by id.

---

## Known sharing

`public/events/` (race photos, named `{activityId}.jpg`) lives in this repository,
so every deployment ships every profile's photos. They are keyed by activity ID, so
only the matching activity ever renders one and no photo is reachable from another
athlete's pages by browsing - but the files are served from both domains. Moving
them into each data repository is the clean fix when it starts to matter.
