import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { MAP_PADDING } from '@/lib/routeFrame'

const hero = readFileSync(path.resolve(__dirname, '../RunMapHero.tsx'), 'utf8')

describe('the run map hero', () => {
  it("is 3.0's 330 pt tall, the route's foot clear of the 64 pt bottom fade and the start dot's 9.5 pt", () => {
    expect(hero).toContain('className="relative -mx-4 h-[330px] overflow-hidden')
    expect(hero).toContain('bottom-0 z-10 h-16 bg-gradient-to-t from-background')
    expect(MAP_PADDING.hero).toEqual({ top: 32, right: 24, bottom: 74, left: 24 })
    expect(MAP_PADDING.hero.bottom).toBeGreaterThanOrEqual(64 + 9.5)
  })

  // So no line shows under the status bar.
  it('fades in from the solid page ground at its top, under the edge sampler', () => {
    expect(hero).toContain("'linear-gradient(var(--background), color-mix(in srgb, var(--background) 84%, transparent) 25%")
    expect(hero).toContain('data-testid="hero-top-fade" className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24"')
    expect(hero).not.toContain('from-background/35')
  })
})
