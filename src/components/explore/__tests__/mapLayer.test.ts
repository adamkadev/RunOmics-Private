import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAP_LAYER_KEY, initialMapLayer, parseMapLayer, readStoredMapLayer, storeMapLayer } from '../mapLayer'

function memoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, String(value)),
    removeItem: (key) => void store.delete(key),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() {
      return store.size
    },
  }
}

describe('the map layer', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reads only the two layers it knows', () => {
    expect(parseMapLayer('districts')).toBe('districts')
    expect(parseMapLayer('heat')).toBe('heat')
    expect(parseMapLayer('Districts')).toBeNull()
    expect(parseMapLayer('')).toBeNull()
    expect(parseMapLayer(null)).toBeNull()
  })

  it('opens on the linked layer, else the stored one', () => {
    expect(initialMapLayer('districts', 'heat')).toBe('districts')
    expect(initialMapLayer('heat', 'districts')).toBe('heat')
    expect(initialMapLayer('nonsense', 'districts')).toBe('districts')
    expect(initialMapLayer(null, 'heat')).toBe('heat')
  })

  it('remembers the choice, and defaults to the heat', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    expect(readStoredMapLayer()).toBe('heat')
    storeMapLayer('districts')
    expect(localStorage.getItem(MAP_LAYER_KEY)).toBe('districts')
    expect(readStoredMapLayer()).toBe('districts')
    localStorage.setItem(MAP_LAYER_KEY, 'satellite')
    expect(readStoredMapLayer()).toBe('heat')
  })

  it('falls back to the heat when storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    })
    expect(readStoredMapLayer()).toBe('heat')
    expect(() => storeMapLayer('districts')).not.toThrow()
  })
})
