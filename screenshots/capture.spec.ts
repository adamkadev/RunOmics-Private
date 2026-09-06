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

const THEME_STORAGE_KEY = 'theme'

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
  await page.addInitScript(
    (entries) => {
      try {
        for (const [key, value] of entries) localStorage.setItem(key, value)
      } catch {}
    },
    [
      [THEME_STORAGE_KEY, theme],
      [ACCENT_STORAGE_KEY, accent],
    ] as const
  )

  await page.emulateMedia({ reducedMotion: 'reduce' })

  await page.goto(route.path, { waitUntil: 'domcontentloaded' })

  if (route.waitFor) {
    await page.locator(route.waitFor).first().waitFor({ state: 'visible', timeout: 15_000 })
  } else {
    await page
      .locator('h1, [role="heading"], main')
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => {})
  }

  await page
    .waitForFunction((t) => document.documentElement.classList.contains(t), theme, {
      timeout: 5_000,
    })
    .catch(() => {})

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
