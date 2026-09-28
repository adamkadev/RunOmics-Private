import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AccentPicker } from '@/components/settings/AccentPicker'
import { ACCENT_IDS } from '@/lib/accent'

/** Tailwind gap step -> px, for the phone gap classes this row is allowed to use. */
const GAP_PX: Record<string, number> = { 'gap-2.5': 10, 'gap-4': 16 }

/**
 * Width available to the swatch row on the narrowest device we ship a splash
 * screen for (375px, scripts/generate-splash.mjs): 375 - 32 (main's px-4,
 * AppShell) - 40 (the card's px-5, SettingsClient) - 2 (1px border either
 * side). On a phone the row sits under its label, so it has the whole width.
 */
const NARROWEST_ROW_PX = 375 - 32 - 40 - 2
/** The visible swatch (v4.17), and the target every button keeps (hit-44). */
const SWATCH_PX = 28
const TARGET_PX = 44

function swatchRow(): HTMLElement {
  const swatches = screen.getAllByRole('button')
  const row = swatches[0]?.parentElement
  if (!row) throw new Error('no swatch row')
  return row
}

describe('AccentPicker swatch row', () => {
  // v4.3: five palettes and no custom hue, which could land on a zone colour.
  it('renders one swatch per accent and no custom wheel', () => {
    render(<AccentPicker />)
    expect(screen.getAllByRole('button')).toHaveLength(ACCENT_IDS.length)
  })

  it('never wraps, so no swatch is orphaned onto a second row', () => {
    render(<AccentPicker />)
    expect(swatchRow().classList.contains('flex-wrap')).toBe(false)
  })

  // v4.17: 28 pt swatches, each with a 44 pt target; on a phone the row's gap
  // spaces the targets so they never overlap, and the row still fits.
  it('keeps every 44 pt target apart and on one row at the narrowest supported width', () => {
    render(<AccentPicker />)
    const row = swatchRow()
    // The mobile-first gap (the sm: one is for a pointer).
    const gap = Object.keys(GAP_PX).find((c) => row.classList.contains(c))
    expect(gap, `swatch row uses an unbudgeted gap: ${row.className}`).toBe('gap-4')

    for (const button of screen.getAllByRole('button')) {
      expect(button.classList.contains('size-7')).toBe(true)
      expect(button.classList.contains('hit-44')).toBe(true)
    }
    expect(SWATCH_PX + GAP_PX[gap!]!).toBeGreaterThanOrEqual(TARGET_PX)

    const count = screen.getAllByRole('button').length
    const needed = count * SWATCH_PX + (count - 1) * GAP_PX[gap!]! + (TARGET_PX - SWATCH_PX)
    expect(needed).toBeLessThanOrEqual(NARROWEST_ROW_PX)
  })
})
