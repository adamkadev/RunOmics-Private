import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Aura, auraPalette } from '../Aura'

const route = vi.hoisted(() => ({ pathname: '/' }))
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }))

describe('the aura', () => {
  it("takes each page's palette", () => {
    expect(auraPalette('/')).toEqual(['--accent', '--zone-2', '--zone-3'])
    expect(auraPalette('/plan')).toEqual(['--zone-4', '--zone-2', '--accent'])
    expect(auraPalette('/settings/')).toEqual(['--zone-1', '--accent', '--zone-3'])
  })

  it("takes Records' palette on Shoes and every shoe's page", () => {
    expect(auraPalette('/shoes')).toEqual(auraPalette('/records'))
    expect(auraPalette('/shoes')).toEqual(['--warn', '--accent', '--zone-3'])
    expect(auraPalette('/shoes/demo-shoe-0000000000000001')).toEqual(['--warn', '--accent', '--zone-3'])
    expect(auraPalette('/shoes/abc/')).toEqual(['--warn', '--accent', '--zone-3'])
    route.pathname = '/shoes/abc'
    render(<Aura />)
    expect(screen.getByTestId('aura').style.getPropertyValue('--aura-1')).toBe('var(--warn)')
  })

  it('draws nothing on an activity, under its map hero', () => {
    expect(auraPalette('/activities/123')).toBeNull()
    expect(auraPalette('/activities/123/')).toBeNull()
    route.pathname = '/activities/123'
    render(<Aura />)
    expect(screen.queryByTestId('aura')).toBeNull()
  })

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

  it("glows on All time, and on a page with no palette of its own in Today's", () => {
    expect(auraPalette('/all-time')).toEqual(['--zone-3', '--accent', '--zone-2'])
    expect(auraPalette('/sign-in')).toEqual(auraPalette('/'))
    expect(auraPalette('/no-such-page')).toEqual(auraPalette('/'))
    expect(auraPalette('/shoesx')).toEqual(auraPalette('/'))
  })

  it('is a sibling layer that takes no taps, its colours as custom properties', () => {
    route.pathname = '/analytics'
    render(<Aura />)
    const aura = screen.getByTestId('aura')
    expect(aura.className).toBe('aura')
    expect(aura.style.getPropertyValue('--aura-1')).toBe('var(--zone-2)')
    expect(aura.children).toHaveLength(0)
  })

  it('starts below the safe area, clear under the edge sampler, in over 24 pt', () => {
    const css = readFileSync(path.resolve(__dirname, '../../../app/globals.css'), 'utf8')
    const start = css.indexOf('.aura {')
    const rule = css.slice(start, css.indexOf('}', start))
    expect(rule).toMatch(/\btop: var\(--safe-top\);/)
    expect(rule).toContain('mask-image: linear-gradient(transparent 0, transparent var(--edge-sample-h), rgb(0 0 0 / 0.16) calc(var(--edge-sample-h) + 6px), rgb(0 0 0 / 0.5) calc(var(--edge-sample-h) + 12px), rgb(0 0 0 / 0.84) calc(var(--edge-sample-h) + 18px), #000 calc(var(--edge-sample-h) + 24px)')
  })

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
