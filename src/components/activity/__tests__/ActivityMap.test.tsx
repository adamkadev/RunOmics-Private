import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { t } from '@/i18n'
import ActivityMap from '../ActivityMap'

const maps = vi.hoisted(() => ({ built: [] as { container: HTMLElement; resizes: number; fits: number; styles: unknown[] }[] }))

vi.mock('@/lib/maplibre', () => {
  class FakeMap {
    container: HTMLElement
    resizes = 0
    fits = 0
    styles: unknown[] = []
    constructor(options: { container: HTMLElement }) {
      this.container = options.container
      maps.built.push(this)
    }
    addControl() {}
    on() {}
    once() {}
    remove() {}
    resize() {
      this.resizes += 1
    }
    fitBounds() {
      this.fits += 1
    }
    setStyle(style: unknown) {
      this.styles.push(style)
    }
  }
  class FakeBounds {
    extend() {
      return this
    }
  }
  return {
    loadMapLibre: async () => ({ Map: FakeMap, LngLatBounds: FakeBounds, AttributionControl: class {}, Marker: class {} }),
    styleRunMapLabels: () => {},
    firstSymbolLayerId: () => undefined,
  }
})

const ROUTE: [number, number][] = [
  [6.1, 49.6],
  [6.2, 49.7],
]

/** The map as the hero holds it: the page's own button opens it full screen. */
function Hero() {
  const [fullscreen, setFullscreen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setFullscreen(true)}>{t.activity.map.fullscreen}</button>
      <ActivityMap route={ROUTE} fullscreen={fullscreen} onFullscreenChange={setFullscreen} card={<p>Long run</p>} />
    </>
  )
}

describe('ActivityMap fullscreen', () => {
  beforeEach(() => {
    maps.built.length = 0
    vi.stubEnv('NEXT_PUBLIC_MAPTILER_TOKEN', 'test-token')
  })
  afterEach(() => vi.unstubAllEnvs())

  // Fullscreen portals the map to <body>; a new MapLibre instance there would reload the style, tiles and route animation.
  it('moves the map it has into fullscreen and resizes it, rather than building another', async () => {
    const user = userEvent.setup()
    render(<Hero />)
    await waitFor(() => expect(maps.built).toHaveLength(1))

    await user.click(screen.getByRole('button', { name: t.activity.map.fullscreen }))
    await user.click(screen.getByRole('button', { name: t.activity.map.exitFullscreen }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(maps.built).toHaveLength(1)
    const [map] = maps.built
    expect(map!.resizes).toBeGreaterThanOrEqual(2)
    expect(screen.getByRole('img', { name: t.activity.map.routeMap }).contains(map!.container)).toBe(true)
  })

  // Otherwise a pinch-zoom made in fullscreen stays on the card after exit.
  it('fits the route again on leaving fullscreen', async () => {
    const user = userEvent.setup()
    render(<Hero />)
    await waitFor(() => expect(maps.built).toHaveLength(1))
    // The route's bounds are set once the map is built.
    await new Promise((resolve) => setTimeout(resolve, 0))

    await user.click(screen.getByRole('button', { name: t.activity.map.fullscreen }))
    const [map] = maps.built
    const before = map!.fits
    await user.click(screen.getByRole('button', { name: t.activity.map.exitFullscreen }))

    expect(map!.fits).toBe(before + 1)
  })

  // The hero draws its own back, expand and share.
  it('draws no button of its own in the page but the credits', async () => {
    render(<ActivityMap route={ROUTE} />)

    expect(screen.queryByTestId('map-top-chips')).toBeNull()
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([t.pages.map.credits])
  })

  it('recenters on the route and cycles the basemap in fullscreen, the card at its foot', async () => {
    const user = userEvent.setup()
    render(<Hero />)
    await waitFor(() => expect(maps.built).toHaveLength(1))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.queryByTestId('map-card')).toBeNull()

    await user.click(screen.getByRole('button', { name: t.activity.map.fullscreen }))
    expect(screen.getByTestId('map-card')).toHaveTextContent('Long run')
    const [map] = maps.built
    const fits = map!.fits
    await user.click(screen.getByRole('button', { name: t.activity.map.recenter }))
    expect(map!.fits).toBe(fits + 1)

    // jsdom has no dark theme: the map opens light, and the button goes dark.
    const style = screen.getByRole('button', { name: t.activity.map.style(t.activity.map.styles.light) })
    await user.click(style)
    expect(screen.getByRole('button', { name: t.activity.map.style(t.activity.map.styles.dark) })).toBeInTheDocument()
    expect(map!.styles).toHaveLength(1)

    // Leaving gives the page's map its theme's style back.
    await user.click(screen.getByRole('button', { name: t.activity.map.exitFullscreen }))
    await waitFor(() => expect(map!.styles).toHaveLength(2))
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    render(<Hero />)
    await user.click(screen.getByRole('button', { name: t.activity.map.fullscreen }))
    expect(screen.getByRole('button', { name: t.activity.map.exitFullscreen })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('button', { name: t.activity.map.exitFullscreen })).toBeNull()
  })
})
