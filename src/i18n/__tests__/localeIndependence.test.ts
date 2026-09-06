import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { en } from '../en'
import { fr } from '../fr'

const SOURCES = ['en.ts', 'fr.ts'].map((file) => ({
  file,
  source: fs.readFileSync(path.join(process.cwd(), 'src/i18n', file), 'utf-8'),
}))

/**
 * Formatting that resolves its own locale at runtime, rather than being told
 * which one to use.
 *
 * These are the calls that differ between the server and the browser: Node
 * takes its default from the machine's environment, the browser from the
 * user's settings. A number formatted through one of them renders
 * "Projected 1 663 km" in the prerendered HTML and "Projected 1,663 km" once
 * React hydrates, which React reports as a hydration mismatch and recovers
 * from by throwing the whole tree away and re-rendering on the client.
 */
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

  // The instance that actually shipped: /goals prerendered French grouping
  // against an English client. Both locales pin their own separator now.
  it('formats the annual projection identically wherever it renders', () => {
    expect(en.goals.projection.projected(1663)).toBe('Projected 1,663 km')
    // fr-FR groups with a narrow no-break space (U+202F), en-US with a comma -
    // exactly the pair that produced the mismatch.
    expect(fr.goals.projection.projected(1663)).toBe('Projection 1\u202f663 km')
  })
})
