import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Hard-coded text colours were dark-theme values sitting on surfaces that
 * follow the system theme: #c3ccd6 reads at 1.5:1 on the light background and
 * #9cc4ff at 1.6:1, against WCAG AA's 4.5:1. Text takes a theme token, or one
 * Tailwind step per theme, instead. A surface that is dark in both themes (the
 * map chrome, the dashboard hero) names its fixed ink as a constant beside it,
 * so the choice is visible where the surface is.
 */
const COMPONENTS = path.join(process.cwd(), 'src/components')

const HEX_INK = [
  { name: "a hex literal as a style's text color", pattern: /\bcolor:[^,}\n]*['"`]#[0-9a-fA-F]{3,8}['"`]/g },
  { name: 'an arbitrary-hex text class', pattern: /\btext-\[#[0-9a-fA-F]{3,8}\]/g },
]

function componentSources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : componentSources(full)
    return entry.name.endsWith('.tsx') ? [full] : []
  })
}

describe('text colours follow the theme', () => {
  const sources = componentSources(COMPONENTS).map((file) => ({ file, source: fs.readFileSync(file, 'utf-8') }))

  it('scans the component tree', () => {
    expect(sources.length).toBeGreaterThan(100)
  })

  for (const { name, pattern } of HEX_INK) {
    it(`no component sets ${name}`, () => {
      const hits = sources.flatMap(({ file, source }) =>
        [...source.matchAll(pattern)].map(
          (match) => `${path.relative(process.cwd(), file)}:${source.slice(0, match.index).split('\n').length}`
        )
      )
      expect(hits).toEqual([])
    })
  }
})
