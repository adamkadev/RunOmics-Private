# Screenshot audit

Automated **light + dark mode** screen captures of every page in RunOmics, in
any of the **accent palettes**, for visual auditing and "does it still render?"
spot checks. The app is phone-first, so shots are taken through an **iPhone 13**
viewport (390×844 @3x).

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
| `SCREENSHOT_ACCENTS` | `nature`, `performance`, `impact`, `motivation`, `endurance`, `silver`  | `nature`         |

```bash
# The whole matrix: 6 accents x 2 themes x every route
SCREENSHOT_ACCENTS=all npm run screenshots

# Just what you're working on
SCREENSHOT_ACCENTS=impact,silver SCREENSHOT_THEMES=dark npm run screenshots
```

The accent list is imported from `src/lib/accent.ts`, so a newly shipped palette
is captured without touching this folder.

## What gets captured

For **each accent × each theme × each route**:

| Frame     | What it is                                                        |
| --------- | ---------------------------------------------------------------- |
| `begin`   | Top of the page (viewport frame)                                 |
| `middle`  | Scrolled to 50% (only if the page scrolls)                       |
| `end`     | Bottom of the page (only if the page scrolls)                    |
| `full`    | Whole page stitched into one tall image                          |

Pages with in-page tabs (**Analytics**, **Calendar**) additionally get the same
begin/middle/end/full set per tab, prefixed `tab-<n>-<label>-…`.

### Output layout

```
screenshots/output/
└── nature/                      (one folder per captured accent)
    ├── light/
    │   ├── dashboard/           begin.png  middle.png  end.png  full.png
    │   ├── analytics/           begin.png … + tab-1-volume-begin.png, tab-2-performance-…
    │   ├── calendar/            begin.png … + tab-1-week-…, tab-2-month-…
    │   └── … (one folder per route)
    └── dark/
        └── … (mirror of light)
```

## Routes covered

Dashboard, Activities (list + a sample detail), Calendar, Analytics, Map,
Goals, Milestones, Records, Shoes (list + a sample detail), Profile, Settings —
defined in [`routes.ts`](./routes.ts). Detail pages use real IDs from committed
data so they render with content instead of 404s.

## How themes and accents are pinned

`next-themes` is class-based with `storageKey="theme"`. Before the first paint
the capture seeds `localStorage.theme` **and** emulates the OS `color-scheme`,
so each run is deterministically light or dark with no flash. The accent is
seeded the same way under `runomics-accent`, which `layout.tsx`'s
`beforeInteractive` script reads to stamp `data-accent` on `<html>` — the
attribute the palette CSS keys off — so the first paint is already in-palette.
Animations and transitions are frozen while shooting so repeat runs are
diff-stable.

## Notes

- **Settings** renders its signed-out view (no auth in the capture run); that's
  the correct anonymous state to audit.
- **Map** shows its shell/legend but not the tiles — `NEXT_PUBLIC_MAPTILER_TOKEN`
  is intentionally unset for the offline `.env.e2e` build.
- To add a screen, add an entry to `routes.ts`. Set `hasTabs: true` if it has a
  `role="tab"` bar you want walked.
