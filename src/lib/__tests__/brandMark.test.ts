import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MARK_PATHS, MARK_SMALL_PATHS } from '@/lib/brandMark'

const ICONS = join(process.cwd(), 'public/icons')

describe('the v5.2 mark', () => {
  it('keeps the README geometry on the 44 grid', () => {
    expect(MARK_PATHS).toEqual([
      'M 11 12 A 14.5 6.5 0 0 1 40 12',
      'M 9 22 A 13 6 0 0 0 35 22',
      'M 9 22 A 13 6 0 0 1 35 22',
      'M 7 32 A 11.5 5.5 0 0 0 30 32',
    ])
    expect(MARK_SMALL_PATHS).toEqual([MARK_PATHS[0], MARK_PATHS[2], MARK_PATHS[3]])
  })

  it('is what every icon file carries, and the old mark and its colours are gone', () => {
    const svgs = readdirSync(ICONS).filter((f) => f.endsWith('.svg'))
    expect(svgs.sort()).toEqual(['app-icon.svg', 'favicon.svg', 'mark-small.svg', 'mark.svg', 'splash-mark.svg'])
    for (const file of svgs) {
      const svg = readFileSync(join(ICONS, file), 'utf8')
      expect(svg, file).not.toContain('A 16 8 0 0 1 38 10')
      expect(svg.toLowerCase(), file).not.toMatch(/#34d399|#050a1a|#06091a/)
      expect(svg, file).toContain(MARK_PATHS[0])
    }
  })
})
