# RunOmics

A personal running dashboard that pulls your data from Garmin Connect and turns it into a self-hosted analytics app. Built with Next.js 16, TypeScript, and a Python sync pipeline.

## Features

- **Dashboard** - weekly volume, training load (CTL/ATL/TSB), streak, estimated VO₂max
- **Activity detail** - GPS route map with live-sync to HR, pace, and elevation charts
- **Analytics** - monthly trends: cadence, long runs, 80/20 easy–hard split, pace, HR
- **Calendar** - monthly grid view of all activities
- **Goals & PBs** - annual distance goal, race targets, official personal bests
- **All-time records** - best 1K/5K/10K/half/marathon detected from FIT files
- **Race predictor** - Riegel formula projections from your best efforts
- **Dark mode** - system preference + manual toggle

## Architecture

```
Garmin Connect API
       │
  scripts/sync.py          ← Python pipeline (garth + garmin-fit-sdk)
       │
  public/data/activities/  ← static data store committed to repo (one JSON file per year)
       │
  Next.js (SSG)            ← reads JSON at build time, no database
       │
  Vercel                   ← deploy & host
```

All data is stored as one JSON file per year under `public/data/activities/` and read at build time - no database, no API routes. A new Vercel deployment is triggered automatically after each push.

---

## Setup

### Prerequisites

- Node.js ≥ 20
- Python ≥ 3.11
- A [MapTiler](https://www.maptiler.com/) account (free tier works)
- A Garmin Connect account

### 1. Clone and install

```bash
git clone https://github.com/adamkadev/RunOmics
cd RunOmics

# Frontend dependencies
npm install

# Python dependencies
pip install -r scripts/requirements.txt
```

### 2. Generate your Garmin secret

The sync script authenticates with Garmin Connect using [garth](https://github.com/matin/garth), which stores an OAuth token as a base64 string.

```bash
python scripts/get_secret.py
```

This will prompt for your Garmin Connect email and password, then print a `GARMIN_SECRET` string. Copy it - you'll need it as an environment variable.

### 3. Configure environment variables

Create a `.env.local` file at the root:

```env
# Garmin Connect auth token (from get_secret.py)
GARMIN_SECRET=eyJ...

# MapTiler API key (for route maps)
NEXT_PUBLIC_MAPTILER_TOKEN=your_maptiler_key
```

> `.env.local` is gitignored. Never commit your secrets.

### 4. Run the initial sync

```bash
python scripts/sync.py
```

This fetches all your running activities from Garmin Connect, downloads the FIT files, parses them, and writes the per-year files under `public/data/activities/`. On first run this may take several minutes depending on your activity count.

Options:

```bash
python scripts/sync.py --limit 10     # sync only the last 10 new activities
python scripts/sync.py --force        # re-sync all activities
python scripts/sync.py --all-types    # include non-running activities
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Configuration files

These files live in `public/` and are committed to the repo alongside your activity data.

### `public/goals.json` - Annual goals and race targets

```json
[
  {
    "year": 2026,
    "annualDistanceKm": 1500,
    "targets": [
      { "distance": "5K",            "targetSeconds": 1200 },
      { "distance": "10K",           "targetSeconds": 2400 },
      { "distance": "Half-Marathon", "targetSeconds": 6300 },
      { "distance": "Marathon",      "targetSeconds": null }
    ]
  }
]
```

`targetSeconds` is the goal time in seconds (`null` = no target set).

### `public/pbs.json` - Official personal bests

Stores your official race times (chip time). These take priority over the auto-detected best efforts in the Records section.

```json
[
  {
    "year": 2025,
    "entries": [
      { "distance": "5K",            "seconds": 1238, "activityId": "20526043740" },
      { "distance": "Half-Marathon", "seconds": 5859, "activityId": "22904920506" }
    ]
  }
]
```

Valid `distance` values: `"1K"`, `"5K"`, `"10K"`, `"Half-Marathon"`, `"Marathon"`.  
`activityId` links the card to the activity detail page (optional).

### `public/events/` - Race photos

Drop a photo named `{activityId}.jpg` (or `.png`, `.webp`) into `public/events/` and it will appear as the cover image on the PB card for that activity.

---

## Reprocessing

If you update the FIT parser (e.g. after adding new metrics), reprocess all activities from the cached FIT files without re-downloading from Garmin:

```bash
python scripts/reprocess.py
```

---

## Deploying to Vercel

### 1. Push your repo to GitHub

```bash
git add .
git commit -m "initial setup"
git push
```

### 2. Import the project on Vercel

Go to [vercel.com/new](https://vercel.com/new), import your GitHub repo, and keep the default Next.js settings.

### 3. Set environment variables

In your Vercel project → **Settings** → **Environment Variables**, add:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_MAPTILER_TOKEN` | Your MapTiler API key |

> `GARMIN_SECRET` is only used locally by the sync script - it never runs on Vercel.

### 4. Sync and deploy

After each sync, commit the updated data file and push:

```bash
python scripts/sync.py
git add public/data/activities/
git commit -m "sync: $(date +%Y-%m-%d)"
git push
```

Vercel picks up the new commit and redeploys within ~30 seconds.

---

## Tech stack

| Layer | Tech |
|-------|------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router, SSG) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Charts | [Recharts](https://recharts.org/) |
| Maps | [MapLibre GL](https://maplibre.org/) + [MapTiler](https://www.maptiler.com/) |
| Icons | [Lucide](https://lucide.dev/) |
| Dark mode | [next-themes](https://github.com/pacocoursey/next-themes) |
| Garmin auth | [garth](https://github.com/matin/garth) |
| FIT parsing | [garmin-fit-sdk](https://pypi.org/project/garmin-fit-sdk/) |

