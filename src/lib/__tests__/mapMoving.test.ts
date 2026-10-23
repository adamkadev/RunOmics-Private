// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { MAP_MOVING_ATTR, watchMapMoving } from '../mapMoving'

function fakeMap(container: HTMLElement) {
  const handlers = new Map<string, Set<() => void>>()
  const map = {
    getContainer: () => container,
    on: (type: string, fn: () => void) => handlers.set(type, (handlers.get(type) ?? new Set()).add(fn)),
    off: (type: string, fn: () => void) => handlers.get(type)?.delete(fn),
  }
  const fire = (type: string) => handlers.get(type)?.forEach((fn) => fn())
  return { map: map as unknown as MapLibreMap, fire }
}

// The glass over a map drops its blur while the camera moves, on the element holding both canvas and glass.
describe('watchMapMoving', () => {
  it('marks the map root while the camera moves, and clears it once it stops', () => {
    const root = document.createElement('section')
    root.setAttribute('data-map-root', '')
    const container = document.createElement('div')
    root.appendChild(container)
    const { map, fire } = fakeMap(container)

    const stop = watchMapMoving(map)
    fire('movestart')
    expect(root.hasAttribute(MAP_MOVING_ATTR)).toBe(true)
    fire('moveend')
    expect(root.hasAttribute(MAP_MOVING_ATTR)).toBe(false)

    fire('movestart')
    stop()
    expect(root.hasAttribute(MAP_MOVING_ATTR)).toBe(false)
    fire('movestart')
    expect(root.hasAttribute(MAP_MOVING_ATTR)).toBe(false)
  })

  it('falls back to the map container without a root', () => {
    const container = document.createElement('div')
    const { map, fire } = fakeMap(container)
    watchMapMoving(map)
    fire('movestart')
    expect(container.hasAttribute(MAP_MOVING_ATTR)).toBe(true)
  })
})
