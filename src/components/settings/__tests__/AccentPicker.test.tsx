import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AccentPicker } from '@/components/settings/AccentPicker'
import { ACCENT_IDS } from '@/lib/accent'

const GAP_PX: Record<string, number> = { 'gap-2.5': 10, 'gap-4': 16 }

/**
 * The narrowest splash-screen device (375px, scripts/generate-splash.mjs), less
 * main's px-4, the group row's px-4 and its 1px borders.
 */
const NARROWEST_ROW_PX = 375 - 32 - 32 - 2
const SWATCH_PX = 30
const TARGET_PX = 44

function swatchRow(): HTMLElement {
  const swatches = screen.getAllByRole('button')
  const row = swatches[0]?.parentElement
  if (!row) throw new Error('no swatch row')
  return row
}

describe('AccentPicker swatch row', () => {
  it('renders one swatch per accent and no custom wheel', () => {
    render(<AccentPicker />)
    expect(screen.getAllByRole('button')).toHaveLength(ACCENT_IDS.length)
  })

  it('never wraps, so no swatch is orphaned onto a second row', () => {
    render(<AccentPicker />)
    expect(swatchRow().classList.contains('flex-wrap')).toBe(false)
  })

  it('keeps every 44 pt target apart and on one row at the narrowest supported width', () => {
    render(<AccentPicker />)
    const row = swatchRow()
    // The mobile-first gap (the sm: one is for a pointer).
    const gap = Object.keys(GAP_PX).find((c) => row.classList.contains(c))
    expect(gap, `swatch row uses an unbudgeted gap: ${row.className}`).toBe('gap-4')

    for (const button of screen.getAllByRole('button')) {
      expect(button.classList.contains('size-[30px]')).toBe(true)
      expect(button.classList.contains('hit-44')).toBe(true)
    }
    expect(SWATCH_PX + GAP_PX[gap!]!).toBeGreaterThanOrEqual(TARGET_PX)

    const count = screen.getAllByRole('button').length
    const needed = count * SWATCH_PX + (count - 1) * GAP_PX[gap!]! + (TARGET_PX - SWATCH_PX)
    expect(needed).toBeLessThanOrEqual(NARROWEST_ROW_PX)
  })
})
