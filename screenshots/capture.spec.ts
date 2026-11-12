import fs from 'node:fs'
import path from 'node:path'
import { test, type Page } from '@playwright/test'
import {
  ROUTES,
  selectedAccents,
  selectedThemes,
  type Accent,
  type RouteSpec,
  type Theme,
} from './routes'
import { ACCENT_STORAGE_KEY, BASE_ACCENT } from '@/lib/accent'
import { signInAsOwner } from '../e2e/owner'

const OUTPUT_DIR = path.join(__dirname, 'output')

const THEME_STORAGE_KEY = 'theme'

// An iPhone 15 Pro's insets: env(safe-area-inset-*) is 0 in headless Chromium unless it is told otherwise.
const SAFE_AREA = { top: 59, bottom: 34, left: 0, right: 0 }

// More than the fixed header and tab bar cover, so every line of the page is clear of both in one screen.
const SCREEN_OVERLAP = 220
const MAX_SCREENS = 6

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

async function scrollTo(page: Page, y: number): Promise<void> {
  await page.evaluate((top) => window.scrollTo(0, top), y)
  await page.waitForTimeout(250)
}

async function captureScreens(page: Page, dir: string, shot: string, theme: Theme): Promise<void> {
  fs.mkdirSync(dir, { recursive: true })
  // One flat folder, named page then theme, so a file says what it is wherever it is copied and light sits beside dark.
  const p = (frame: string) => path.join(dir, `${shot}-${theme}-${frame}.png`)

  const { scrollable, viewport } = await page.evaluate(() => ({
    scrollable: document.documentElement.scrollHeight - window.innerHeight,
    viewport: window.innerHeight,
  }))
  const step = viewport - SCREEN_OVERLAP
  const screens = Math.min(MAX_SCREENS, 1 + Math.ceil(Math.max(0, scrollable - 40) / step))

  for (let i = 0; i < screens; i++) {
    await scrollTo(page, Math.min(i * step, scrollable))
    await page.screenshot({ path: p(`screen-${i + 1}`) })
  }

  await scrollTo(page, 0)
  await page.screenshot({ path: p('full'), fullPage: true })
}

async function preparePage(page: Page, theme: Theme, accent: Accent): Promise<void> {
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

  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: SAFE_AREA })
}

async function resolvePath(page: Page, route: RouteSpec): Promise<string> {
  if (!route.firstLinkTo) return route.path

  await page.goto(route.path, { waitUntil: 'domcontentloaded' })
  const href = await page.locator(`main a[href^="${route.firstLinkTo}"]`).first().getAttribute('href')
  if (!href) throw new Error(`${route.path} has no link to ${route.firstLinkTo}...`)
  return href
}

async function gotoAndSettle(page: Page, url: string, route: RouteSpec, theme: Theme, accent: Accent): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' })

  if (route.waitFor) {
    await page.locator(route.waitFor).first().waitFor({ state: 'visible', timeout: 15_000 })
  } else {
    await page
      .locator('h1, [role="heading"], main')
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => {})
  }

  if (route.settledWhen) {
    await page.locator(route.settledWhen).first().waitFor({ state: 'attached', timeout: 10_000 }).catch(() => {})
  }

  await page
    .waitForFunction((t) => document.documentElement.classList.contains(t), theme, {
      timeout: 5_000,
    })
    .catch(() => {})

  await page
    .waitForFunction(
      ({ a, base }) => {
        const attr = document.documentElement.getAttribute('data-accent')
        return a === base ? attr === null || attr === a : attr === a
      },
      { a: accent, base: BASE_ACCENT },
      { timeout: 5_000 }
    )
    .catch(() => {})

  await page.addStyleTag({ content: FREEZE_MOTION_CSS })
  await page.evaluate(() => (document as unknown as { fonts: FontFaceSet }).fonts?.ready)
  await page.waitForTimeout(600)
}

// The card is a canvas with no drawn mark: long enough for the map snapshot and Geist to land.
const SHARE_CARD_SETTLE_MS = 2_500

async function captureShareCards(page: Page, dir: string, shot: string, theme: Theme): Promise<void> {
  await scrollTo(page, 0)
  await page.locator('button[data-bar-action="share"]').first().click()
  await page.getByTestId('share-preview').waitFor({ state: 'visible', timeout: 15_000 })

  const designs = page.getByTestId('share-designs').getByRole('radio')
  for (let i = 0; i < (await designs.count()); i++) {
    const design = designs.nth(i)
    const label = slugify((await design.textContent())?.trim() ?? `design-${i}`)
    // An empty frame until a photo is picked, which a headless run cannot do.
    if (label === 'photo') continue
    await design.click()
    await page.waitForTimeout(SHARE_CARD_SETTLE_MS)
    await page.screenshot({ path: path.join(dir, `${shot}-share-${label}-${theme}-screen-1.png`) })
    await page.getByTestId('share-preview').screenshot({ path: path.join(dir, `${shot}-share-${label}-${theme}-card.png`) })
  }
}

for (const accent of selectedAccents()) {
  for (const theme of selectedThemes()) {
    test.describe(`${accent} / ${theme} mode`, () => {
      test.use({ colorScheme: theme })

      for (const route of ROUTES) {
        test(`${route.name}`, async ({ page }) => {
          const dir = path.join(OUTPUT_DIR, accent)
          await preparePage(page, theme, accent)
          if (route.asOwner) {
            test.skip(!!process.env.SCREENSHOT_BASE_URL, 'the owner capture needs the local Auth emulator')
            await signInAsOwner(page)
          }
          await gotoAndSettle(page, await resolvePath(page, route), route, theme, accent)
          await captureScreens(page, dir, route.name, theme)

          if (route.hasTabs) {
            const tabs = page.getByRole('tab')
            const count = await tabs.count()
            // The tab open on arrival is the page already captured above.
            const open = await tabs.evaluateAll((els) => els.findIndex((el) => el.getAttribute('aria-selected') === 'true'))
            for (let i = 0; i < count; i++) {
              if (i === open) continue
              const tab = tabs.nth(i)
              const label = slugify((await tab.textContent())?.trim() ?? `tab-${i}`)
              await tab.click()
              await page.waitForTimeout(400)
              await captureScreens(page, dir, `${route.name}-${label}`, theme)
            }
          }

          if (route.hasShareCard) await captureShareCards(page, dir, route.name, theme)
        })
      }
    })
  }
}
