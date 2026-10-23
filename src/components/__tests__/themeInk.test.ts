import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Hex text colours fail WCAG AA on surfaces that follow the system theme: text
 * takes a theme token, and a surface dark in both themes names its fixed ink as
 * a constant beside it.
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
