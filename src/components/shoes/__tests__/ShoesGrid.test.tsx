import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShoesGrid } from '@/components/shoes/ShoesGrid'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'
import { t } from '@/i18n'

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
    firstUsedDate: '2026-01-01',
    kmPerWeek: 10,
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

    for (const km of [Math.round(1000 - 604), Math.round(1000 - 53)]) {
      const label = screen.getByText(t.shoes.kmLeft(km))
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

    expect(screen.getByText(t.shoes.kmLeft(250)).className).toContain('amber')
  })

  it('leads the row with kilometres left rather than a percentage', () => {
    render(<ShoesGrid shoes={[shoe({ totalKm: 604, maxKm: 1000, wearPercent: 60 })]} />)

    expect(screen.getByText(t.shoes.kmLeft(396))).toBeInTheDocument()
    expect(screen.queryByText('60%')).not.toBeInTheDocument()
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

  it('says what the date is, instead of leaving a bare day beside the mileage', () => {
    const thisYear = new Date().getFullYear()
    const { container } = render(<ShoesGrid shoes={[shoe({ lastUsedDate: `${thisYear}-09-10` })]} />)

    expect(container.textContent).toContain('last run Sep 10')
  })

  it('spells the year out when the pair last ran in an earlier one', () => {
    const lastYear = new Date().getFullYear() - 1
    const { container } = render(<ShoesGrid shoes={[shoe({ lastUsedDate: `${lastYear}-12-12` })]} />)

    // The formatter this row used to call dropped the day for older dates and
    // printed `Dec 25`, which reads as the 25th of December, not December 2025.
    expect(container.textContent).toContain(`last run Dec 12, ${lastYear}`)
  })

  it('gives a retired pair its life instead of a percentage: an era, its runs, and its weeks', () => {
    const { container } = render(
      <ShoesGrid
        shoes={[
          shoe({ gearId: 'a', name: 'Adizero EVO SL', totalKm: 53, wearPercent: 7 }),
          shoe({
            gearId: 'b',
            name: 'Adizero EVO SL',
            totalKm: 786,
            retired: true,
            wearPercent: 100,
            sessionCount: 90,
            firstUsedDate: '2025-05-01',
            lastUsedDate: '2025-12-12',
          }),
        ]}
      />
    )

    // Total km trails the row instead of a percentage, and the subline swaps
    // "worn" for the shape of the pair's life - no bare "94% worn" left over.
    expect(container.textContent).toContain('786')
    expect(container.textContent).toContain('90')
    expect(screen.queryByText('100%')).not.toBeInTheDocument()
    expect(container.textContent).not.toMatch(/worn/)
  })

  it('groups retired pairs under a heading rather than dimming each row below AA contrast', () => {
    const { container } = render(<ShoesGrid shoes={[shoe({ retired: true, wearPercent: 100 })]} />)

    // opacity-65 composited the AA-compliant text-subtle down to ~3.2:1.
    expect(container.querySelector('a')?.className).not.toContain('opacity')

    // The heading carries retirement once, so the row does not repeat it.
    expect(screen.getAllByText('Retired')).toHaveLength(1)
  })

  it('splits the rotation into labelled groups, so two pairs of the same name cannot be confused', () => {
    render(
      <ShoesGrid
        shoes={[
          shoe({ gearId: 'a', name: 'Adizero EVO SL', retired: false, wearPercent: 40 }),
          shoe({ gearId: 'b', name: 'Adizero EVO SL', retired: true, wearPercent: 100 }),
        ]}
      />,
    )

    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Retired')).toBeInTheDocument()
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
