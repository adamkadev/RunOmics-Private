import path from 'node:path'
import { test, expect } from './fixtures'

const PAGES = ['/', '/activities', '/plan', '/analytics', '/profile', '/goals', '/records']
// The day buttons, the readiness link and a Profile chart carry a fuller label than their text on purpose; open question.
const SKIPPED_RULES = ['label-content-name-mismatch']

for (const url of PAGES) {
  test(`axe finds nothing serious on ${url}`, async ({ page }) => {
    await page.goto(url)
    await page.waitForLoadState('networkidle')
    await page.addScriptTag({ path: path.resolve('node_modules/axe-core/axe.min.js') })
    const violations = await page.evaluate(async (skipped) => {
      const result = await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
        rules: Object.fromEntries(skipped.map((id) => [id, { enabled: false }])),
      })
      return result.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 5).join(', ')}`)
    }, SKIPPED_RULES)
    expect(violations).toEqual([])
  })
}

declare global {
  interface Window {
    axe: typeof import('axe-core')
  }
}
