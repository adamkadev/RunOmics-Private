import { useSyncExternalStore } from 'react'

/**
 * Where the Charts scrub is, for the map above the tabs (v4.17). The charts
 * write to it every frame of a drag; only what reads it re-renders - the map
 * marker - not the whole activity page around the two.
 */
export interface ScrubChannel {
  get: () => number | null
  set: (fraction: number | null) => void
  subscribe: (listener: () => void) => () => void
}

export function createScrubChannel(): ScrubChannel {
  let value: number | null = null
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set: (next) => {
      if (next === value) return
      value = next
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

const serverSnapshot = () => null

export function useScrubFraction(channel: ScrubChannel): number | null {
  return useSyncExternalStore(channel.subscribe, channel.get, serverSnapshot)
}
