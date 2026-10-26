import path from 'node:path'
import { test, expect } from './fixtures'

const PAGES = ['/', '/activities', '/plan', '/analytics', '/profile', '/goals', '/records']
// Plan's day buttons speak the whole date and state ("mardi 27 octobre : Repos") over their "M 27" on purpose.
const ALLOWED = { rule: 'label-content-name-mismatch', within: '[data-testid="day-selector"]' }

for (const url of PAGES) {
  test(`axe finds nothing serious on ${url}`, async ({ page }) => {
    await page.goto(url)
    await page.waitForLoadState('networkidle')
    await page.addScriptTag({ path: path.resolve('node_modules/axe-core/axe.min.js') })
    const violations = await page.evaluate(async (allowed) => {
      const result = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })
      const isAllowed = (rule: string, target: string) =>
        rule === allowed.rule && Boolean(document.querySelector(target)?.closest(allowed.within))
      return result.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target.join(' ')).filter((target) => !isAllowed(v.id, target)) }))
        .filter((v) => v.targets.length > 0)
        .map((v) => `${v.id}: ${v.targets.slice(0, 5).join(', ')}`)
    }, ALLOWED)
    expect(violations).toEqual([])
  })
}

declare global {
  interface Window {
    axe: typeof import('axe-core')
  }
}
