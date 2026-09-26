import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { t } from '@/i18n'
import ActivityMap from '../ActivityMap'

const maps = vi.hoisted(() => ({ built: [] as { container: HTMLElement; resizes: number; fits: number }[] }))

vi.mock('@/lib/maplibre', () => {
  class FakeMap {
    container: HTMLElement
    resizes = 0
    fits = 0
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
  }
  class FakeBounds {
    extend() {
      return this
    }
  }
  return {
    loadMapLibre: async () => ({ Map: FakeMap, LngLatBounds: FakeBounds, AttributionControl: class {}, Marker: class {} }),
    hideSymbolLabels: () => {},
  }
})

const ROUTE: [number, number][] = [
  [6.1, 49.6],
  [6.2, 49.7],
]

describe('ActivityMap fullscreen', () => {
  beforeEach(() => {
    maps.built.length = 0
    vi.stubEnv('NEXT_PUBLIC_MAPTILER_TOKEN', 'test-token')
  })
  afterEach(() => vi.unstubAllEnvs())

  // Fullscreen portals the map to <body>, and the new host node used to cost
  // a whole new MapLibre instance: style, tiles and the route animation again.
  it('moves the map it has into fullscreen and resizes it, rather than building another', async () => {
    const user = userEvent.setup()
    render(<ActivityMap route={ROUTE} />)
    await waitFor(() => expect(maps.built).toHaveLength(1))

    await user.click(screen.getByRole('button', { name: t.activity.map.fullscreen }))
    await user.click(screen.getByRole('button', { name: t.activity.map.exitFullscreen }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(maps.built).toHaveLength(1)
    const [map] = maps.built
    expect(map!.resizes).toBeGreaterThanOrEqual(2)
    expect(screen.getByRole('img', { name: t.activity.map.routeMap }).contains(map!.container)).toBe(true)
  })

  // Owner report: a pinch-zoom in fullscreen stayed on the card after exit.
  it('fits the route again on leaving fullscreen', async () => {
    const user = userEvent.setup()
    render(<ActivityMap route={ROUTE} />)
    await waitFor(() => expect(maps.built).toHaveLength(1))
    // The route's bounds are set once the map is built.
    await new Promise((resolve) => setTimeout(resolve, 0))

    await user.click(screen.getByRole('button', { name: t.activity.map.fullscreen }))
    const [map] = maps.built
    const before = map!.fits
    await user.click(screen.getByRole('button', { name: t.activity.map.exitFullscreen }))

    expect(map!.fits).toBe(before + 1)
  })

  it('shows the run type on top and the shoe at the bottom', async () => {
    render(<ActivityMap route={ROUTE} activityType="Base" shoe={{ name: 'Vomero Plus', dotColor: '#fff' }} />)

    expect(screen.getByTestId('map-type-chip').textContent).toBe(t.activityTypes.Base)
    expect(screen.getByTestId('map-shoe-chip').textContent).toContain('Vomero Plus')
  })
})
