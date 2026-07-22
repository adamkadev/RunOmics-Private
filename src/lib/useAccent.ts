'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { ACCENT_CHANGE_EVENT, ACCENT_STORAGE_KEY, ACCENT_SWATCHES, ACCENT_SWATCHES_LIGHT, ACCENT_UI, DEFAULT_ACCENT, HEADLINE_CHART_COLOR, isAccentId, type AccentId } from '@/lib/accent'

function readAccent(): AccentId {
  if (typeof window === 'undefined') return DEFAULT_ACCENT
  const stored = localStorage.getItem(ACCENT_STORAGE_KEY)
  return isAccentId(stored) ? stored : DEFAULT_ACCENT
}

export function useAccent(): AccentId {
  const [accent, setAccent] = useState<AccentId>(readAccent)

  useEffect(() => {
    function onChange() {
      setAccent(readAccent())
    }

    window.addEventListener(ACCENT_CHANGE_EVENT, onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener(ACCENT_CHANGE_EVENT, onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [])

  return accent
}

// Resolved hex for the active accent - for Recharts/SVG props that can't take a CSS var.
export function useAccentColor(): string {
  return ACCENT_SWATCHES[useAccent()]
}

// Darker variant for use on light backgrounds (e.g. the light map style) where the
// raw accent swatch doesn't have enough contrast.
export function useAccentColorLight(): string {
  return ACCENT_SWATCHES_LIGHT[useAccent()]
}

/**
 * The live value of `--accent` for the current accent *and* theme - for chart
 * marks that carry the primary metric and so must repaint with the UI around
 * them. Prefer this over `useAccentColor()` anywhere the mark sits next to
 * accent-colored chrome; the swatch version is only the picker's preview hue.
 */
export function useAccentUiColor(): string {
  const accent = useAccent()
  const { resolvedTheme } = useTheme()
  // `resolvedTheme` is undefined for the first render (next-themes resolves
  // `system` on the client), so the dark value stands in - it is the one that
  // reads on both canvases if the very first paint lands on the wrong branch.
  return ACCENT_UI[accent][resolvedTheme === 'light' ? 0 : 1]
}

/**
 * Like {@link useAccentUiColor} but for a chart's headline line (Form / TSB)
 * that shares a plot with fixed-hue series. Red-adjacent accents that would
 * collide with Fitness/Fatigue/HR fall back to the brand emerald - see
 * {@link HEADLINE_CHART_COLOR}. Use this only in multi-series charts; mono-series
 * charts should keep `useAccentUiColor()`.
 */
export function useHeadlineChartColor(): string {
  const accent = useAccent()
  const { resolvedTheme } = useTheme()
  return HEADLINE_CHART_COLOR[accent][resolvedTheme === 'light' ? 0 : 1]
}
