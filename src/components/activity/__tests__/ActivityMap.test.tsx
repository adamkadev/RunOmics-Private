import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { t } from '@/i18n'
import ActivityMap from '../ActivityMap'

const maps = vi.hoisted(() => ({ built: [] as { container: HTMLElement; resizes: number }[] }))

vi.mock('@/lib/maplibre', () => {
  class FakeMap {
    container: HTMLElement
    resizes = 0
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
  }
  class FakeBounds {
    extend() {
      return this
    }
  }
  return {
    loadMapLibre: async () => ({ Map: FakeMap, LngLatBounds: FakeBounds, AttributionControl: class {}, Marker: class {} }),
    showPlaceLabelsAtAnyZoom: () => {},
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
})
