import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShoesGrid } from '@/components/shoes/ShoesGrid'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'

function shoe(over: Partial<ShoeStats>): ShoeStats {
  return {
    gearId: 'gear-1',
    name: 'Cloudrun 4',
    brand: 'Nimbus',
    maxKm: 1000,
    alertThresholdKm: 800,
    retired: false,
    totalKm: 150,
    sessionCount: 12,
    lastUsedDate: '2026-09-10',
    wearPercent: 15,
    nearingLimit: false,
    ...over,
  }
}

// Row bars are spans with an inline width; the hero card's bar is a div, so this
// selector picks up the rotation rows only.
function rowBarWidths(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>('span[style]')).map(
    (fill) => fill.style.width
  )
}

describe('ShoesGrid rows', () => {
  it('reads a healthy pair neutrally instead of spending a status hue on it', () => {
    render(
      <ShoesGrid
        shoes={[
          shoe({ gearId: 'a', totalKm: 604, wearPercent: 60 }),
          shoe({ gearId: 'b', totalKm: 53, wearPercent: 5 }),
        ]}
      />
    )

    for (const pct of ['60%', '5%']) {
      const label = screen.getByText(pct)
      expect(label.className).toContain('text-muted-foreground')
      expect(label.className).not.toContain('emerald')
    }
  })

  it('still colours the two states that ask for a decision', () => {
    // 95 becomes the hero, so the 75 pair is the one left in the rows.
    render(
      <ShoesGrid
        shoes={[
          shoe({ gearId: 'a', totalKm: 950, wearPercent: 95 }),
          shoe({ gearId: 'b', totalKm: 750, wearPercent: 75 }),
        ]}
      />
    )

    expect(screen.getByText('75%').className).toContain('amber')
  })

  it('gives every active row a bar sized to its wear, so the digits are not the only signal', () => {
    const { container } = render(
      <ShoesGrid
        shoes={[
          shoe({ gearId: 'a', totalKm: 604, wearPercent: 60 }),
          shoe({ gearId: 'b', totalKm: 53, wearPercent: 5 }),
        ]}
      />
    )

    expect(rowBarWidths(container)).toEqual(['60%', '5%'])
  })

  it('keeps the bar 6px, not the 3px that would undercut the accessible metric-bar height', () => {
    const { container } = render(<ShoesGrid shoes={[shoe({ wearPercent: 60 })]} />)

    const track = container.querySelector<HTMLElement>('span[style]')?.parentElement
    expect(track?.className).toContain('h-1.5')
  })

  it('draws no bar for a retired pair, whose wear is forced to 100', () => {
    const { container } = render(
      <ShoesGrid
        shoes={[
          shoe({ gearId: 'a', totalKm: 604, wearPercent: 60 }),
          shoe({ gearId: 'b', totalKm: 786, retired: true, wearPercent: 100 }),
        ]}
      />
    )

    expect(rowBarWidths(container)).toEqual(['60%'])
  })
})
