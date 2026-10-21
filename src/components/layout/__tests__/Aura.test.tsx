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

  // An activity, the map and the share card have the map itself.
  it('draws nothing on a page with a map hero', () => {
    expect(auraPalette('/activities/123')).toBeNull()
    expect(auraPalette('/map')).toBeNull()
    route.pathname = '/map'
    render(<Aura />)
    expect(screen.queryByTestId('aura')).toBeNull()
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
  // sampler ends, a hard line under the status bar. It is clear down to the
  // sampler's foot and comes in over the next 84 pt.
  it('is clear down to the foot of the edge sampler', () => {
    const css = readFileSync(path.resolve(__dirname, '../../../app/globals.css'), 'utf8')
    const start = css.indexOf('.aura {')
    const rule = css.slice(start, css.indexOf('}', start))
    expect(rule).toMatch(/\btop: 0;/)
    expect(rule).toContain('mask-image: linear-gradient(transparent 0, transparent calc(var(--safe-top) + var(--edge-sample-h)), #000 calc(var(--safe-top) + 96px)')
  })
})
