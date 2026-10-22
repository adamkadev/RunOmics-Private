import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Aura, auraPalette } from '../Aura'

const route = vi.hoisted(() => ({ pathname: '/' }))
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }))

// Liquid Glass v3 (G14, README §6.11): each page's three colours.
describe('the aura', () => {
  it("takes each page's palette", () => {
    expect(auraPalette('/')).toEqual(['--accent', '--zone-2', '--zone-3'])
    expect(auraPalette('/plan')).toEqual(['--zone-4', '--zone-2', '--accent'])
    expect(auraPalette('/settings/')).toEqual(['--zone-1', '--accent', '--zone-3'])
  })

  // F17: Shoes, a shoe's page and Compare (a section of Shoes) were the one
  // Progress family on the flat ground: Records' amber left, teal right.
  it("takes Records' palette on Shoes and every shoe's page", () => {
    expect(auraPalette('/shoes')).toEqual(auraPalette('/records'))
    expect(auraPalette('/shoes')).toEqual(['--warn', '--accent', '--zone-3'])
    expect(auraPalette('/shoes/demo-shoe-0000000000000001')).toEqual(['--warn', '--accent', '--zone-3'])
    expect(auraPalette('/shoes/abc/')).toEqual(['--warn', '--accent', '--zone-3'])
    expect(auraPalette('/shoesx')).toBeNull()
    route.pathname = '/shoes/abc'
    render(<Aura />)
    expect(screen.getByTestId('aura').style.getPropertyValue('--aura-1')).toBe('var(--warn)')
  })

  // An activity, the map and the share card have the map itself.
  it('draws nothing on a page with a map hero', () => {
    expect(auraPalette('/activities/123')).toBeNull()
    expect(auraPalette('/map')).toBeNull()
    route.pathname = '/map'
    render(<Aura />)
    expect(screen.queryByTestId('aura')).toBeNull()
  })

  // F15: /map opens Activities' Map view, a map page with no glow; the list
  // and Plan's own ?view= keep theirs.
  it("draws nothing on Activities' Map view", () => {
    expect(auraPalette('/activities', 'map')).toBeNull()
    expect(auraPalette('/activities', null)).toEqual(['--accent', '--zone-2', '--zone-1'])
    expect(auraPalette('/plan', 'map')).toEqual(['--zone-4', '--zone-2', '--accent'])
    route.pathname = '/activities'
    window.history.replaceState(null, '', '/activities?view=map')
    render(<Aura />)
    expect(screen.queryByTestId('aura')).toBeNull()
    window.history.replaceState(null, '', '/')
  })

  it('is a sibling layer that takes no taps, its colours as custom properties', () => {
    route.pathname = '/analytics'
    render(<Aura />)
    const aura = screen.getByTestId('aura')
    expect(aura.className).toBe('aura')
    expect(aura.style.getPropertyValue('--aura-1')).toBe('var(--zone-2)')
    expect(aura.children).toHaveLength(0)
  })

  // F1 (round 2): the glow started at full colour where the 12 pt edge
  // sampler ends, a hard line under the status bar. F15: it starts below the
  // safe area, is clear under the sampler, and comes in over the next 24 pt.
  it('starts below the safe area, clear under the edge sampler, in over 24 pt', () => {
    const css = readFileSync(path.resolve(__dirname, '../../../app/globals.css'), 'utf8')
    const start = css.indexOf('.aura {')
    const rule = css.slice(start, css.indexOf('}', start))
    expect(rule).toMatch(/\btop: var\(--safe-top\);/)
    expect(rule).toContain('mask-image: linear-gradient(transparent 0, transparent var(--edge-sample-h), rgb(0 0 0 / 0.16) calc(var(--edge-sample-h) + 6px), rgb(0 0 0 / 0.5) calc(var(--edge-sample-h) + 12px), rgb(0 0 0 / 0.84) calc(var(--edge-sample-h) + 18px), #000 calc(var(--edge-sample-h) + 24px)')
  })

  // D1: cards are the content layer, never blurred. Over the light glow they
  // are 88 % white with no backdrop-filter of their own (F5 gave each one a
  // 24 px blur), so the glow still tints the first card a little.
  it('lays 88 % white cards over the light glow, with no blur', () => {
    const css = readFileSync(path.resolve(__dirname, '../../../app/globals.css'), 'utf8')
    const selector = 'html:not(.dark):not([data-glow="off"]) :is(.content-card, .glass-card, .glass-hero, .glass-row) {'
    const start = css.indexOf(selector)
    expect(start).toBeGreaterThan(-1)
    const rule = css.slice(start, css.indexOf('}', start))
    expect(rule).toContain('--card: rgb(255 255 255 / 0.88);')
    expect(rule).not.toContain('backdrop-filter')
    expect(css).not.toMatch(/:is\(\.content-card[^{]*\{[^}]*backdrop-filter:\s*blur/)
  })
})
