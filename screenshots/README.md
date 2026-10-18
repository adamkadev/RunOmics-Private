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
| `screen-1` … `screen-6`  | One phone screen each, scrolling down the page. Each overlaps the last by 220 pt - more than the fixed header and tab bar cover - so every line is clear of both in one of them. The last one ends at the bottom of the page. |
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
Athlete, Consistency, All-time, Settings (signed out and as the owner) and the
not-found page — defined in [`routes.ts`](./routes.ts).
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

- **Not the real home-screen app.** Headless Chromium cannot run as an iOS
  standalone web app: `display-mode: standalone` does not match, the status
  bar and home indicator are not drawn, and Safari's rendering is not
  WebKit-on-iOS. The capture emulates the safe areas (59/34 pt) so the page
  pads itself as it does on the phone, but what sits under the notch, the
  status-bar colour (`theme-color`) and the splash screen are checked on a
  phone or in the iOS Simulator, not here.
- **Settings** is captured twice: `settings` is the signed-out view, and
  `settings-owner` is signed in as the owner through the **Firebase Auth
  emulator**. The run starts it (`firebase emulators:start --only auth`, port
  9099; needs the Firebase CLI and Java), creates a made-up Google account with
  the `owner` claim, and signs in through Settings' own button and the
  emulator's popup. The screenshot build sets
  `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST` for that; no other build does. No
  real account and no Firestore rule are involved. Skipped when
  `SCREENSHOT_BASE_URL` points at a deployment.
- **The activity map** is shot once its route is drawn: the page marks the
  map `data-route-drawn`, and the run emulates reduced motion, so the route
  draws in one step. The demo athlete's runs are placed in the mid-Pacific
  on purpose, so no made-up runner sits on a real street: the maps show the
  route on an empty basemap, never tiles.
- **Map** is captured with its tiles when `.env.local` has a
  `NEXT_PUBLIC_MAPTILER_TOKEN`: the screenshot build borrows it. Without one it
  shows its shell and legend only.
- Both settings are baked in at build time, so a server already listening on
  the e2e port from an earlier `npm run test:e2e` is reused as is: stop it
  first, or the owner capture and the tiles are missing.
- To add a screen, add an entry to `routes.ts`. Set `hasTabs: true` if it has a
  `role="tab"` bar you want walked.
