'use client'

import { useEffect, useState } from 'react'

/**
 * A temporary A/B switch for the dark heatmap (owner test, Oct 2026), to
 * compare on the device and then remove:
 * - A: 3.1.0's additive tracks, burning towards white;
 * - B: the glow in normal blending capped at 0.35, the colour capped at the accent.
 * Kept on the device and mirrored on <html data-heat-variant>, which the map
 * watches to redraw.
 */
export type HeatVariant = 'A' | 'B'

const KEY = 'runomics-heat-variant'
const ATTR = 'data-heat-variant'

export function readHeatVariant(): HeatVariant {
  try {
    return localStorage.getItem(KEY) === 'B' ? 'B' : 'A'
  } catch {
    return 'A'
  }
}

export function setHeatVariant(variant: HeatVariant): void {
  try {
    localStorage.setItem(KEY, variant)
  } catch {
    // Storage is off: the switch lasts until the page reloads.
  }
  document.documentElement.setAttribute(ATTR, variant)
}

export function useHeatVariant(): [HeatVariant, () => void] {
  const [variant, setVariant] = useState<HeatVariant>('A')
  useEffect(() => {
    const v = readHeatVariant()
    setVariant(v)
    document.documentElement.setAttribute(ATTR, v)
  }, [])
  const toggle = () => {
    const next = variant === 'A' ? 'B' : 'A'
    setHeatVariant(next)
    setVariant(next)
  }
  return [variant, toggle]
}
