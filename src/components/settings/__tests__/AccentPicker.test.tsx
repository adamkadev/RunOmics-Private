import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AccentPicker } from '@/components/settings/AccentPicker'
import { ACCENT_IDS } from '@/lib/accent'

/** Tailwind gap step -> px, for the gap classes this row is allowed to use. */
const GAP_PX: Record<string, number> = { 'gap-1.5': 6, 'gap-2': 8, 'gap-3': 12, 'gap-[13px]': 13 }

/** Tailwind size step -> px, for the square classes a swatch is allowed to use. */
const SIZE_PX: Record<string, number> = { 'h-11': 44, 'w-11': 44, 'h-12': 48, 'w-12': 48 }

/**
 * Width available to the swatch row on the narrowest device we ship a splash
 * screen for (375px, scripts/generate-splash.mjs): 375 - 32 (main's px-4,
 * AppShell) - 40 (the card's p-5, SettingsClient) - 2 (1px glass border either
 * side, .glass-card in globals.css).
 *
 * The row reads its mobile-first classes here, which is the case that has to
 * fit: six circles at 44px with a 6px gap need 294px. The design's 48px and
 * 13px gap apply from `sm` up, where 353px is no longer a problem.
 */
const NARROWEST_ROW_PX = 375 - 32 - 40 - 2

function swatchRow(): HTMLElement {
  const swatches = screen.getAllByRole('button')
  const row = swatches[0]?.parentElement
  if (!row) throw new Error('no swatch row')
  return row
}

describe('AccentPicker swatch row', () => {
  it('renders one swatch per curated accent, plus the custom wheel', () => {
    render(<AccentPicker />)
    expect(screen.getAllByRole('button')).toHaveLength(ACCENT_IDS.length + 1)
  })

  it('never wraps, so no swatch is orphaned onto a second row', () => {
    render(<AccentPicker />)
    expect(swatchRow().classList.contains('flex-wrap')).toBe(false)
  })

  it('fits every 44px target on one row at the narrowest supported width', () => {
    render(<AccentPicker />)
    const row = swatchRow()

    const gap = Object.keys(GAP_PX).find((c) => row.classList.contains(c))
    expect(gap, `swatch row uses an unbudgeted gap: ${row.className}`).toBeDefined()

    const widths = screen.getAllByRole('button').map((b) => {
      const size = Object.keys(SIZE_PX).find((c) => c.startsWith('w-') && b.classList.contains(c))
      const height = Object.keys(SIZE_PX).find((c) => c.startsWith('h-') && b.classList.contains(c))
      // The 44px HIG minimum the rest of Settings holds to (ThemeSegmented's
      // min-h-[44px], .tap-target in globals.css).
      expect(size && SIZE_PX[size]).toBeGreaterThanOrEqual(44)
      expect(height && SIZE_PX[height]).toBeGreaterThanOrEqual(44)
      return SIZE_PX[size!]!
    })

    const needed =
      widths.reduce((sum, w) => sum + w, 0) + (widths.length - 1) * GAP_PX[gap!]!
    expect(needed).toBeLessThanOrEqual(NARROWEST_ROW_PX)
  })
})
