# Screenshot audit

Automated **light + dark mode** screen captures of every page in RunOmics, in
any of the **accent palettes**, for visual auditing and "does it still render?"
spot checks. The app is phone-first and used from the home screen, so every
shot is the **home-screen web app on an iPhone 15 Pro**: the whole 393×852
screen - no Safari toolbars - at 2x, with the status bar and home indicator's
safe areas (59 and 34 pt) applied, so the page pads itself clear of them as it
does on the phone.

## Run it

```bash
npm run screenshots
```

That builds the app once (`next build`), starts it (`next start`), walks every
route in both themes on the default (nature) accent, and writes PNGs to
`screenshots/output/` (git-ignored).

Already have a server running (or want to point at a deployed URL)? Skip the
build:

```bash
SCREENSHOT_BASE_URL=http://localhost:3000 npm run screenshots
```

Clear old output:

```bash
npm run screenshots:clean
```

## Choosing themes and accents

Two env vars slice the matrix. Each takes `all` or a comma-separated list, and
fails loudly on an unknown value:

| Var                  | Values                                                                 | Default          |
| -------------------- | ---------------------------------------------------------------------- | ---------------- |
| `SCREENSHOT_THEMES`  | `light`, `dark`                                                         | both             |
| `SCREENSHOT_ACCENTS` | `nature`, `teal`, `performance`, `endurance`, `silver`                  | `nature`         |

```bash
# The whole matrix: 5 accents x 2 themes x every route
SCREENSHOT_ACCENTS=all npm run screenshots

# Just what you're working on
SCREENSHOT_ACCENTS=teal,silver SCREENSHOT_THEMES=dark npm run screenshots
```

The accent list is imported from `src/lib/accent.ts`, so a newly shipped palette
is captured without touching this folder.

## What gets captured

For **each accent × each theme × each route**:

| Frame                    | What it is                                                     |
| ------------------------ | -------------------------------------------------------------- |
| `screen-1` … `screen-6`  | One phone screen each, scrolling down the page. Each overlaps the last by 180 pt - more than the fixed header and tab bar cover - so every line is clear of both in one of them. The last one ends at the bottom of the page. |
| `full`                   | Whole page stitched into one tall image                        |

Pages with in-page tabs (**Plan**, **Analytics**, **Records**, an **activity**) additionally
get the same set for each tab other than the one they open on, prefixed
`tab-<n>-<label>-…`.

### Output layout

```
screenshots/output/
└── nature/                      (one folder per captured accent)
    ├── light/
    │   ├── dashboard/           screen-1.png  screen-2.png  full.png
    │   ├── analytics/           screen-1.png … + tab-2-…-screen-1.png, …
    │   ├── plan/                screen-1.png … + tab-2-month-screen-1.png, …
    │   └── … (one folder per route)
    └── dark/
        └── … (mirror of light)
```

## Routes covered

Dashboard, Activities (list + an activity), Plan (week + month), Analytics,
Map, Goals, Records (PRs + Milestones tabs), Shoes (list + a shoe), Profile,
Athlete, Settings and the not-found page — defined in [`routes.ts`](./routes.ts).
The activity and the shoe are the first ones their list links to, so they have
content in whichever dataset is being served.

There is no `/milestones` entry: that screen merged into `/records` behind the
segmented control, and the leftover route is a redirect — capturing it raced the
client navigation and tore the page down mid-shot.

## How themes and accents are pinned

`next-themes` is class-based with `storageKey="theme"`. Before the first paint
the capture seeds `localStorage.theme` **and** emulates the OS `color-scheme`,
so each run is deterministically light or dark with no flash. The accent is
seeded the same way under `runomics-accent`, which `layout.tsx`'s
`beforeInteractive` script reads to stamp `data-accent` on `<html>` — the
attribute the palette CSS keys off — so the first paint is already in-palette.
Animations and transitions are frozen while shooting so repeat runs are
diff-stable.

## Capturing a deployment

The offline build has no map tiles and no AI text, and shows the demo athlete.
To capture the live app - its data, its Gemini copy, its maps - point the run at
it, from a machine whose network reaches it:

```bash
SCREENSHOT_BASE_URL=https://<your-app>.vercel.app SCREENSHOT_ACCENTS=teal npm run screenshots
```

On a laptop, run `npx playwright install chromium` once first. The captures then
hold that athlete's own data: `screenshots/output/` is git-ignored, so keep them
out of anywhere else they should not be.

## For a design review

Hand a reviewer - a person or a tool such as Claude Design - the `screen-*`
frames rather than `full`: a tool that reads screenshots shrinks a tall image
until its text is illegible, and a phone screen is what the app is judged on.
`full` is for seeing a page's whole layout at a glance.

## Notes

- **Settings** renders its signed-out view (no auth in the capture run); that's
  the correct anonymous state to audit.
- **Map** shows its shell/legend but not the tiles — `NEXT_PUBLIC_MAPTILER_TOKEN`
  is intentionally unset for the offline `.env.e2e` build.
- To add a screen, add an entry to `routes.ts`. Set `hasTabs: true` if it has a
  `role="tab"` bar you want walked.
