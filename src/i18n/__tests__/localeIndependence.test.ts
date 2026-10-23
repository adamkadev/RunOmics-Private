import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { en } from '../en'
import { fr } from '../fr'

const SOURCES = ['en.ts', 'fr.ts'].map((file) => ({
  file,
  source: fs.readFileSync(path.join(process.cwd(), 'src/i18n', file), 'utf-8'),
}))

const AMBIENT_LOCALE = [
  { name: 'toLocaleString() with no locale', pattern: /\.toLocaleString\(\s*\)/g },
  { name: 'toLocaleDateString() with no locale', pattern: /\.toLocaleDateString\(\s*\)/g },
  { name: 'toLocaleTimeString() with no locale', pattern: /\.toLocaleTimeString\(\s*\)/g },
  { name: 'Intl formatter with no locale', pattern: /new Intl\.\w+\(\s*(?:\)|undefined)/g },
]

describe('locale strings never depend on the ambient locale', () => {
  for (const { file, source } of SOURCES) {
    for (const { name, pattern } of AMBIENT_LOCALE) {
      it(`${file} has no ${name}`, () => {
        const hits = [...source.matchAll(pattern)].map(
          (match) => `${file}:${source.slice(0, match.index).split('\n').length}`
        )
        expect(hits).toEqual([])
      })
    }
  }

  it('leaves every number format to src/lib/formatters', () => {
    for (const { file, source } of SOURCES) {
      const hits = [...source.matchAll(/\.toLocaleString\(/g)].map(
        (match) => `${file}:${source.slice(0, match.index).split('\n').length}`
      )
      expect(hits).toEqual([])
    }
  })

  it('wraps an already-grouped projection without reformatting it', () => {
    expect(en.goals.projection.projected('1,663')).toBe('Projected 1,663 km')
    expect(fr.goals.projection.projected('1\u202f663')).toBe('Projection 1\u202f663 km')
  })
})
