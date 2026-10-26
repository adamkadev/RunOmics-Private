import { renderHook } from '@testing-library/react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TAP_OPEN_DELAY_MS, useDistrictsTap } from '../useQuartierMap'

type Handler = (event: unknown) => void

function fakeMap(container: HTMLElement) {
  const handlers = new Map<string, Handler[]>()
  const canvas = document.createElement('canvas')
  const map = {
    getContainer: () => container,
    getCanvas: () => canvas,
    getLayer: () => undefined,
    queryRenderedFeatures: () => [],
    on: (type: string, handler: Handler) => handlers.set(type, [...(handlers.get(type) ?? []), handler]),
    off: (type: string, handler: Handler) => handlers.set(type, (handlers.get(type) ?? []).filter((h) => h !== handler)),
  }
  const tap = (lng: number, lat: number) => {
    container.dispatchEvent(new Event('pointerdown'))
    for (const handler of handlers.get('click') ?? []) handler({ lngLat: { lng, lat }, point: { x: 0, y: 0 }, originalEvent: { detail: 1 } })
    vi.advanceTimersByTime(TAP_OPEN_DELAY_MS)
  }
  return { map: map as unknown as MapLibreMap, tap }
}

function mapRoot(overlay: string) {
  const root = document.createElement('div')
  root.setAttribute('data-map-root', '')
  root.innerHTML = `<div data-testid="canvas"></div>${overlay}`
  document.body.append(root)
  return root.querySelector<HTMLElement>('[data-testid="canvas"]')!
}

describe('useDistrictsTap', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('picks the tapped point while the route panel has its options open', () => {
    const container = mapRoot('<div role="dialog"><button aria-expanded="true">Route options</button></div>')
    const { map, tap } = fakeMap(container)
    const onPick = vi.fn()
    renderHook(() => useDistrictsTap({ current: map }, true, () => {}, onPick))
    tap(6.14, 49.13)
    expect(onPick).toHaveBeenCalledWith([6.14, 49.13])
  })

  it('only closes a popover open over the map', () => {
    const container = mapRoot('<button aria-expanded="true">Credits</button>')
    const { map, tap } = fakeMap(container)
    const onPick = vi.fn()
    renderHook(() => useDistrictsTap({ current: map }, true, () => {}, onPick))
    tap(6.14, 49.13)
    expect(onPick).not.toHaveBeenCalled()
  })
})
