import fs from 'node:fs'
import path from 'node:path'
import { test, type Page } from '@playwright/test'
import {
  DEFAULT_ACCENT_ID,
  ROUTES,
  selectedAccents,
  selectedThemes,
  type Accent,
  type RouteSpec,
  type Theme,
} from './routes'
import { ACCENT_STORAGE_KEY } from '@/lib/accent'

const OUTPUT_DIR = path.join(__dirname, 'output')

// next-themes stores the chosen theme under this localStorage key (its default,
// and providers.tsx doesn't override `storageKey`). Seeding it before the first
// paint - together with the emulated color-scheme - pins light/dark deterministically.
const THEME_STORAGE_KEY = 'theme'

// Kill every transition/animation so the aurora background, tab underline, page
// transitions, etc. hold still - otherwise two runs of the same screen diff.
const FREEZE_MOTION_CSS = `
  *, *::before, *::after {
    transition: none !important;
    animation: none !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
  }
`

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40) || 'tab'
  )
}

/** Scroll to a fraction of the scrollable height and let layout settle. */
async function scrollToFraction(page: Page, fraction: number): Promise<void> {
  await page.evaluate((f) => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo(0, Math.max(0, Math.round(max * f)))
  }, fraction)
  await page.waitForTimeout(250)
}

async function isScrollable(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight > 40
  )
}

/**
 * Shoot begin/middle/end viewport frames (what a phone screen actually shows),
 * plus one stitched full-page frame. Short pages that don't scroll only get a
 * single `full` frame to avoid three identical files.
 */
async function captureScrolls(page: Page, dir: string, prefix: string): Promise<void> {
  fs.mkdirSync(dir, { recursive: true })
  const p = (name: string) => path.join(dir, prefix ? `${prefix}-${name}.png` : `${name}.png`)

  const scrollable = await isScrollable(page)

  await scrollToFraction(page, 0)
  await page.screenshot({ path: p('begin') })

  if (scrollable) {
    await scrollToFraction(page, 0.5)
    await page.screenshot({ path: p('middle') })

    await scrollToFraction(page, 1)
    await page.screenshot({ path: p('end') })

    await scrollToFraction(page, 0)
  }

  await page.screenshot({ path: p('full'), fullPage: true })
}

async function gotoAndSettle(page: Page, route: RouteSpec, theme: Theme, accent: Accent): Promise<void> {
  // Seed the theme + the accent palette before any app script runs, so the very
  // first paint is already in the right mode (no light->dark or nature->x flash).
  // layout.tsx's beforeInteractive script reads the accent key and stamps
  // `data-accent` from it, which is what the palette CSS keys off.
  await page.addInitScript(
    (entries) => {
      try {
        for (const [key, value] of entries) localStorage.setItem(key, value)
      } catch {
        /* private mode etc. - the emulated color-scheme still covers us */
      }
    },
    [
      [THEME_STORAGE_KEY, theme],
      [ACCENT_STORAGE_KEY, accent],
    ] as const
  )

  // Reduce motion for any prefers-reduced-motion CSS (belt-and-braces with the
  // freeze stylesheet added after load).
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await page.goto(route.path, { waitUntil: 'domcontentloaded' })

  // Wait for the app's real content, not just the shell.
  if (route.waitFor) {
    await page.locator(route.waitFor).first().waitFor({ state: 'visible', timeout: 15_000 })
  } else {
    await page
      .locator('h1, [role="heading"], main')
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => {})
  }

  // Confirm next-themes resolved to the class we asked for before shooting.
  await page
    .waitForFunction((t) => document.documentElement.classList.contains(t), theme, {
      timeout: 5_000,
    })
    .catch(() => {})

  // Same for the accent. The default one is the bare stylesheet, so it is the
  // *absence* of the attribute we wait on there.
  await page
    .waitForFunction(
      (a) => {
        const attr = document.documentElement.getAttribute('data-accent')
        return a === DEFAULT_ACCENT_ID ? attr === null || attr === a : attr === a
      },
      accent,
      { timeout: 5_000 }
    )
    .catch(() => {})

  await page.addStyleTag({ content: FREEZE_MOTION_CSS })
  await page.evaluate(() => (document as unknown as { fonts: FontFaceSet }).fonts?.ready)
  await page.waitForTimeout(600)
}

for (const accent of selectedAccents()) {
  for (const theme of selectedThemes()) {
    test.describe(`${accent} / ${theme} mode`, () => {
      // Emulated color-scheme backs up the seeded localStorage value for any
      // prefers-color-scheme CSS and for the pre-hydration paint.
      test.use({ colorScheme: theme })

      for (const route of ROUTES) {
        test(`${route.name}`, async ({ page }) => {
          const dir = path.join(OUTPUT_DIR, accent, theme, route.name)
          await gotoAndSettle(page, route, theme, accent)
          await captureScrolls(page, dir, '')

          if (route.hasTabs) {
            const tabs = page.getByRole('tab')
            const count = await tabs.count()
            for (let i = 0; i < count; i++) {
              const tab = tabs.nth(i)
              const label = slugify((await tab.textContent())?.trim() ?? `tab-${i}`)
              await tab.click()
              await page.waitForTimeout(400)
              await captureScrolls(page, dir, `tab-${i + 1}-${label}`)
            }
          }
        })
      }
    })
  }
}
