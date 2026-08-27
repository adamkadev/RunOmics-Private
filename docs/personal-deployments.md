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

Each athlete is a **profile**: a name (`adam`, `wife`) that is simultaneously the
GitHub Environment name and the matrix entry in the scheduled workflows.

---

## Why a separate Firebase project

The Firestore collections are flat, global names - `activityNotes`, `pushTokens`,
`aiInsights`, `aiBudget`, `notifications` - with no athlete in the key, and
`firestore.rules` grants `allow read: if true` on `activityNotes` so notes render
for signed-out visitors. Two deployments pointed at one Firebase project would
therefore share notes, push tokens and the AI budget document.

A second Firebase project isolates all of it for zero code change, because the
client and admin SDKs are already configured entirely from `NEXT_PUBLIC_FIREBASE_*`
and `FIREBASE_*`. The alternative - threading a collection-name prefix through the
four constants and the rules file - buys one less console to manage and costs a
permanent code path; it isn't worth it.

---

## Adding a profile

Four of these five steps happen in a browser. Only step 5 touches the repository.

### 1. The data repository

Create an empty **private** repository, e.g. `runomics-data-wife`. Nothing is
committed by hand: `scripts/sync.py` fills it on the first run, and
`scripts/prepare-data.mjs` fetches it back at every build.

Mint a fine-grained GitHub PAT scoped to *only* that repository, with
**Contents: Read and write**. Set an expiration and diarise the rotation.

Seed the three hand-edited files once the first sync has landed - see the README's
[Configuration](../README.md#goals-pbs-athlete-profile) section for their shape:

- `athlete.json` - `displayName` at minimum; the Garmin-derived fields fill in by themselves
- `goals.json` - annual distance and race targets
- `pbs.json` - official chip times

### 2. The Garmin token

On your machine, signed out of your own Garmin session:

```bash
python scripts/get_secret.py     # prompts for her Garmin Connect login
```

Keep the printed `GARMIN_SECRET`. It never reaches Vercel - only the sync workflow
uses it. The underlying OAuth1 token lasts about a year; see the README's note on
`garth` before it expires.

### 3. The Firebase project

Create a second project in the Firebase console, then:

- **Authentication** → enable the Google provider, and add the Vercel domain from
  step 4 under *Authorized domains*
- **Firestore** → create the database, then deploy this repository's rules to it:
  `firebase deploy --only firestore:rules --project <her-project-id>`
- **Cloud Messaging** → generate a Web Push certificate for the VAPID key
- **Project settings → Service accounts** → generate a private key for the
  `FIREBASE_*` admin variables
- Grant her the owner claim, with her values in `.env.local`:
  `npm run set-owner-claim`

### 4. The Vercel project

Import **this same repository** into a new Vercel project on the same branch -
Vercel supports any number of projects per repository. Give it its own domain.

| Variable | Value for this profile |
|----------|------------------------|
| `NEXT_PUBLIC_LOCALE` | `fr` for a French UI, `en` (or unset) for English |
| `NEXT_PUBLIC_OWNER_EMAIL` | her Google account - gates notes and Settings in the UI |
| `NEXT_PUBLIC_FIREBASE_*` | from her Firebase project (step 3) |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | her service account |
| `RUNOMICS_DATA_REPO_URL`, `RUNOMICS_DATA_REPO_TOKEN` | her data repository and its PAT (step 1) |
| `INTERNAL_NOTIFY_SECRET` | a fresh random string, **not** the one used by another profile |
| `GEMINI_API_KEY` | her own key - the free-tier quota is per key, so a shared one has the two deployments starving each other |
| `NEXT_PUBLIC_MAPTILER_TOKEN` | may be shared, subject to the plan's request quota |

`NEXT_PUBLIC_LOCALE` is read at build time (`src/i18n/index.ts`), so changing it
needs a redeploy. The French translation is complete and kept at parity with
English by `src/i18n/__tests__/parity.test.ts`, and the Gemini prompts follow the
same locale, so the AI verdicts come out in French too.

Finally, create a **Deploy Hook** on the project (Settings → Git) - the sync
workflow calls it once new data has been pushed.

### 5. The GitHub Environment

Under **Settings → Environments**, create an environment named after the profile
(`wife`) and add these secrets to it:

| Secret | From |
|--------|------|
| `GARMIN_SECRET` | step 2 |
| `RUNOMICS_DATA_REPO_URL`, `RUNOMICS_DATA_REPO_TOKEN` | step 1 |
| `APP_URL` | her Vercel domain, no trailing slash |
| `INTERNAL_NOTIFY_SECRET` | must match the Vercel value from step 4 |
| `VERCEL_DEPLOY_HOOK_URL` | step 4 |
| `PRIVACY_ZONES`, `PRIVACY_RADIUS_M` | optional, per athlete |

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
> (`GARMIN_SECRET_WIFE`, ...) selected through `matrix.include`. Uglier names,
> identical behaviour.

---

## How the workflows behave with several profiles

- **Independent.** `fail-fast: false` everywhere: an expired Garmin token or an
  unreachable deployment on one profile leaves the others alone.
- **Guarded.** Every workflow fails before doing anything if the environment
  doesn't declare `PROFILE`, and `sync.yml` additionally requires `GARMIN_SECRET`
  and both `RUNOMICS_DATA_REPO_*` values - checked before Garmin is contacted.
  Without the second check a typo'd secret name would send `sync.py` to
  `public/data` and commit a real dataset into this repository, so the data
  repository is now the only destination the workflow knows.
- **Cached separately.** The FIT cache key is prefixed with the profile;
  a shared key had each profile restoring, then re-uploading, the other's files.
- **Serialised per profile.** `concurrency: sync-<profile>` stops a manual run
  from overlapping the nightly one against the same data repository. Different
  profiles still run in parallel.
- **Targetable.** A manual `sync.yml` dispatch takes a `profile` input, because
  `--force` and `--limit` only ever mean something for one dataset.

---

## Known sharing

`public/events/` (race photos, named `{activityId}.jpg`) lives in this repository,
so every deployment ships every profile's photos. They are keyed by activity ID, so
only the matching activity ever renders one and no photo is reachable from another
athlete's pages by browsing - but the files are served from both domains. Moving
them into each data repository is the clean fix when it starts to matter.
