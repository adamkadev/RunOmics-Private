# Syncing from an iOS shortcut

A shortcut that dispatches `sync.yml` is the fastest way to pull a run in without
waiting for the nightly schedule. What it cannot do is show you the verdict
straight away: pressing the button starts a chain that takes about five minutes,
and for the first three of those the app on your phone is still the deployment
that existed before you pressed it.

This page explains the wait and gives the shortcut a way to sit through it and
notify you when the card is actually there.

---

## Why the verdict lags the sync

The AI verdict is not written by the sync. `scripts/sync.py` only writes activity
data; the verdict comes from a Gemini call made by `POST /api/internal/ai-insights`,
and that route reads the run off **the deployment's own filesystem**
(`getAllActivities()` → `data/`). It therefore cannot see a new run until Vercel
has rebuilt with the new data.

A real run, dispatched at 23:04 local:

| Time     | Step                                                          |
|----------|---------------------------------------------------------------|
| 23:04:07 | Shortcut fires `workflow_dispatch`                            |
| 23:05:42 | Garmin sync starts (WARP install and connect come first)      |
| 23:06:15 | Sync done, data pushed to the private data repository         |
| 23:06:24 | Vercel deploy hook fired                                      |
| 23:07:58 | New deployment live (90 s build)                              |
| 23:08:03 | `activity-sync-check` reports the new activity                |
| 23:08:59 | `ai-insights` writes the verdict                              |

Roughly **five minutes**, of which the shortcut's own dispatch is the first
second. Until 23:08:59 the activity screen shows the deterministic fallback in
`RunVerdict.tsx` - the tone headline ("Solid Base") and the RPE line - because
`aiVerdict` is still `null`.

The `Trigger post-sync checks` step in `sync.yml` already waits for the
deployment carrying its own `lastSyncedAt` before it calls anything; that wait is
why the checks see the new run at all. The shortcut needs the same discipline for
the same reason.

---

## The endpoint the shortcut polls

`GET /api/internal/latest-verdict?since=<ISO 8601>`

Guarded by `x-internal-secret: $INTERNAL_NOTIFY_SECRET`, like every other
`/api/internal/*` route, and rate limited to 20 requests per minute per IP - a
15-second poll uses four.

`since` is the point the shortcut started waiting. Without it the endpoint would
answer `ready` on the first poll: the pre-redeploy app happily serves the
*previous* run along with the verdict that run already had. With it, `ready`
means "a verdict written after you asked", which is the only useful question.

```json
{
  "ready": true,
  "synced": true,
  "lastSyncedAt": "2026-09-19T21:06:15.650488+00:00",
  "generatedAt": "2026-09-19T21:08:59.412Z",
  "activity": {
    "id": "24424640006",
    "date": "2026-09-19T20:23:41",
    "name": "Easy Run with Strides",
    "type": "Base",
    "distance": "7.70 km",
    "duration": "44:27",
    "pace": "5:46 /km",
    "url": "https://<your-app>/activities/24424640006"
  },
  "verdict": { "headline": "...", "body": "..." }
}
```

While it waits, `ready` is `false`, `verdict` is `null`, and `reason` says which
half of the chain is holding things up:

| `reason`                                       | Meaning                                                       |
|------------------------------------------------|---------------------------------------------------------------|
| `waiting for the deployment carrying this sync` | The app is still serving pre-sync data. Vercel is building.   |
| `no verdict for this run yet`                   | New data is live; `ai-insights` has not written the card yet. |
| `verdict predates this sync`                    | The sync brought no new run, so the newest card is the old one. |

`verdict` is `null` on every one of those, so "the headline has a value" is as
sound a ready test as `ready` itself - useful, because matching a JSON boolean in
Shortcuts is fiddlier than matching text.

`since` may be sent as a local-time stamp with a `+02:00` offset even though an
unencoded `+` reaches the server as a space; the route puts it back.

---

## Building it in Shortcuts

Start from the shortcut you have. It already holds `Github_Name`, `Repo_Name`,
`Github_Token` and `Action_ID` in a Dictionary and posts to
`https://api.github.com/repos/…/actions/workflows/…/dispatches`.

### 1. Two more dictionary entries

Add to the existing **Dictionary** action, and give each one a **Set variable**
below the four you already have:

| Key               | Value                                                       |
|-------------------|-------------------------------------------------------------|
| `App_URL`         | your deployment's origin, no trailing slash                 |
| `Internal_Secret` | the same value as the `INTERNAL_NOTIFY_SECRET` env var      |

### 2. Stamp the moment you dispatched

Immediately **after** the existing `Get contents of URL` that posts the dispatch:

1. **Date** — leave it on Current Date.
2. **Format Date** → Date Format: **ISO 8601**, Include Time: **on**.
3. **Set variable** `Since` to the Formatted Date.

Take the stamp after the dispatch, not before: anything written earlier than the
workflow you just started is not what you are waiting for.

### 3. The wait

**Wait 90 seconds** — the sync itself cannot finish sooner, so polling before
that just burns the rate limit.

Then **Repeat 30 times**, containing:

1. **Text** → `[App_URL]/api/internal/latest-verdict?since=[Since]`
   (insert the two variables as tokens; type the rest literally)
2. **Get contents of URL**
   - Method: **GET**
   - Headers: `x-internal-secret` → `[Internal_Secret]`
3. **Get Dictionary Value** → **Value** for `verdict` in **Contents of URL** →
   **Set variable** `Verdict`
4. **Get Dictionary Value** → **Value** for `headline` in `Verdict` →
   **Set variable** `Headline`
5. **If** `Headline` **has any value**
   - **Get Dictionary Value** → `body` in `Verdict` → **Set variable** `Body`
   - **Get Dictionary Value** → `activity` in **Contents of URL** → **Set variable** `Run`
   - **Get Dictionary Value** → `url` in `Run` → **Set variable** `Link`
   - **Show Notification** → Title: `Headline`, Body: `Body`
   - **Open URLs** → `Link` *(optional — drops you straight on the activity)*
   - **Stop This Shortcut**
6. **Otherwise**
   - **Wait 15 seconds**
7. **End If** / **End Repeat**

Give each `Get Dictionary Value` its own `Set variable` as above. Shortcuts names
every one of them `Dictionary Value`, so chaining them without variables leaves
you guessing which is which the next time you open the shortcut.

After the repeat block, a final **Show Notification** — "Verdict still not
ready" — covers the case where the run timed out or the sync found nothing new.

30 iterations at 15 s is 7½ minutes of headroom past the initial 90 s, which
comfortably covers the five-minute chain plus a slow Vercel build.

### Why `Stop This Shortcut` rather than a flag

Shortcuts has no `break`. Without the stop action the loop keeps spinning after
it has found the verdict and either notifies repeatedly or needs a `Done` flag
guarding every step. `Stop This Shortcut` is the one action that ends the run
outright, and it is allowed inside an `If`.

### Keeping it in the foreground

A polling shortcut only runs while the shortcut runs. Launch it from the
Shortcuts app, a home-screen icon or the widget and leave the phone awake; if iOS
suspends it, the sync still completes on GitHub's side - only the notification is
lost, and the verdict is on the activity screen when you next open it.

---

## Checking it by hand

```bash
curl -s "$APP_URL/api/internal/latest-verdict" -H "x-internal-secret: $SECRET" | jq
```

With no `since`, whatever is stored counts as current - so this reports the
newest run and its verdict as they stand, which is what you want when debugging
rather than waiting.

To watch a sync land, pass the time you started it:

```bash
curl -s "$APP_URL/api/internal/latest-verdict?since=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  -H "x-internal-secret: $SECRET" | jq '{ready, synced, reason}'
```

---

## If you would rather not poll at all

The app already pushes to every registered device: `activity-sync-check` sends
the "New activity" notification you get after each sync, through
`sendPushToAllDevices`. Sending a second push from the `ai-insights` route the
moment a fresh verdict is written would remove the shortcut's waiting entirely -
press the button, lock the phone, get the verdict when it exists. It is a handful
of lines next to the `freshVerdicts` pass, and it is the better answer if the
foreground wait turns out to annoy you.
