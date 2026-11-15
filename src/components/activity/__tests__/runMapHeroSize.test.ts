import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { MAP_PADDING } from '@/lib/routeFrame'

const hero = readFileSync(path.resolve(__dirname, '../RunMapHero.tsx'), 'utf8')

describe('the run map hero', () => {
  it('is 220 pt tall with the route on its middle, its foot at most 8 pt into the 64 pt bottom fade', () => {
    expect(hero).toContain('className="relative -mx-4 h-[220px] overflow-hidden')
    expect(hero).toContain('bottom-0 z-10 h-16 bg-gradient-to-t from-background')
    expect(MAP_PADDING.hero).toEqual({ top: 56, right: 24, bottom: 56, left: 24 })
    expect(MAP_PADDING.hero.top).toBe(MAP_PADDING.hero.bottom)
    expect(MAP_PADDING.hero.bottom).toBeGreaterThanOrEqual(64 - 8)
  })

  // So no line shows under the status bar.
  it('fades in from the solid page ground at its top, under the edge sampler', () => {
    expect(hero).toContain("'linear-gradient(var(--background), color-mix(in srgb, var(--background) 84%, transparent) 25%")
    expect(hero).toContain('data-testid="hero-top-fade" className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24"')
    expect(hero).not.toContain('from-background/35')
  })
})
