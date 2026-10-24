import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapShellData } from '@/application/usecases/GetAllRoutes'
import { heatBasemapStyle, maptilerStyle } from '@/lib/maptiler'
import { FakeMap } from '@/components/explore/__tests__/fakeMap'

const maps = vi.hoisted(() => ({ built: [] as InstanceType<typeof import('@/components/explore/__tests__/fakeMap').FakeMap>[] }))

vi.mock('@/lib/maplibre', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/maplibre')>()
  const { FakeMap: Base } = await import('@/components/explore/__tests__/fakeMap')
  class TiledMap extends Base {
    tilesLoading = true
    constructor(options?: { style?: unknown; container?: unknown }) {
      super(options)
      maps.built.push(this)
    }
    override isStyleLoaded() {
      return this.loaded && !this.tilesLoading
    }
    override setStyle(style: unknown) {
      super.setStyle(style)
      this.tilesLoading = true
    }
  }
  return { ...real, loadMapLibre: async () => ({ Map: TiledMap }) }
})
vi.mock('../heatLayer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../heatLayer')>()),
  addHeatLayer: () => ({ setTracks() {}, remove() {} }),
}))
vi.mock('@/lib/mapMoving', () => ({ watchMapMoving() {} }))

const { useMapRoutes } = await import('../useMapRoutes')

const TOKEN = 'test-token'
const FRAME = { minLon: 6.1, minLat: 49.1, maxLon: 6.2, maxLat: 49.2 }
const DATA: MapShellData = {
  routeMeta: [],
  clusters: [{ id: 'metz', routeCount: 1, totalKm: 10, center: [6.15, 49.15], labelPoint: [6.15, 49.15], bounds: FRAME, frame: FRAME, routeIndices: [] }],
  defaultClusterIdx: 0,
  totalCount: 1,
  totalKm: 10,
  years: [],
}
const isDarkStyle = (style: unknown) => JSON.stringify(style) === JSON.stringify(heatBasemapStyle(maptilerStyle(true, TOKEN), true))
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

function HeatMap() {
  const { containerRef } = useMapRoutes(DATA, [], 0, [], null)
  return <div ref={containerRef} />
}

describe('the heatmap across a theme that flips and flips back', () => {
  beforeEach(() => {
    maps.built.length = 0
    vi.stubEnv('NEXT_PUBLIC_MAPTILER_TOKEN', TOKEN)
    document.documentElement.classList.add('dark')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    document.documentElement.classList.remove('dark')
  })

  it('ends on the theme the page ends on, when the flip back came while the tiles loaded', async () => {
    render(<HeatMap />)
    await waitFor(() => expect(maps.built).toHaveLength(1))
    const map = maps.built[0] as FakeMap & { tilesLoading: boolean }
    expect(isDarkStyle(map.styles[0])).toBe(true)
    map.finish()
    map.tilesLoading = false

    document.documentElement.classList.remove('dark')
    await tick()
    expect(isDarkStyle(map.styles.at(-1))).toBe(false)
    map.finish()
    document.documentElement.classList.add('dark')
    await tick()
    map.tilesLoading = false
    await tick()

    expect(isDarkStyle(map.styles.at(-1))).toBe(true)
  })

  it('ends on the theme the page ends on, when the flip back came before the style loaded', async () => {
    render(<HeatMap />)
    await waitFor(() => expect(maps.built).toHaveLength(1))
    const map = maps.built[0]!
    map.finish()

    document.documentElement.classList.remove('dark')
    await tick()
    document.documentElement.classList.add('dark')
    await tick()
    map.finish()

    expect(isDarkStyle(map.styles.at(-1))).toBe(true)
  })
})
