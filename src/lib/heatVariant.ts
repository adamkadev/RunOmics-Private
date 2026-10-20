'use client'

import { useEffect, useSyncExternalStore } from 'react'

/**
 * A temporary switch for the dark heatmap (owner test, Oct 2026), to
 * compare on the device and then remove:
 * - A: 3.1.0's additive tracks, burning towards white;
 * - B: the glow in normal blending capped at 0.35, the colour capped at the accent;
 * - C (the candidate, default): A's glow capped at 0.40, the core coloured by
 *   frequency up to a light accent, never white, and 2.4 px at most.
 * Kept on the device and mirrored on <html data-heat-variant>, which the map
 * watches to redraw.
 */
export type HeatVariant = 'A' | 'B' | 'C'

export const HEAT_VARIANTS: readonly HeatVariant[] = ['A', 'B', 'C']

const KEY = 'runomics-heat-variant'
const ATTR = 'data-heat-variant'
const EVENT = 'runomics:heat-variant'

export function readHeatVariant(): HeatVariant {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'A' || v === 'B' ? v : 'C'
  } catch {
    return 'C'
  }
}

export function setHeatVariant(variant: HeatVariant): void {
  try {
    localStorage.setItem(KEY, variant)
  } catch {
    // Storage is off: the switch lasts until the page reloads.
  }
  document.documentElement.setAttribute(ATTR, variant)
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

export function useHeatVariant(): [HeatVariant, () => void] {
  const variant = useSyncExternalStore(subscribe, readHeatVariant, () => 'C' as HeatVariant)
  // The map reads the variant off <html>, so mirror it there once mounted.
  useEffect(() => {
    document.documentElement.setAttribute(ATTR, variant)
  }, [variant])
  // A → B → C → A.
  return [variant, () => setHeatVariant(HEAT_VARIANTS[(HEAT_VARIANTS.indexOf(variant) + 1) % HEAT_VARIANTS.length]!)]
}
