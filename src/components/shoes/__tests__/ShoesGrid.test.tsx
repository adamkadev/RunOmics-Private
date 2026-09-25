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

function barWidths(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>('span[style]')).map((fill) => fill.style.width)
}

describe('ShoesGrid', () => {
  // G24: only one of the two worn-out pairs was flagged.
  it('gives every pair past its limit its own "km over" chip', () => {
    render(
      <ShoesGrid
        shoes={[
          shoe({ gearId: 'a', name: 'Tempo Racer 2', totalKm: 1375, maxKm: 500, wearPercent: 100 }),
          shoe({ gearId: 'b', name: 'Cloudrun 4', totalKm: 1187, maxKm: 800, wearPercent: 100 }),
        ]}
      />,
    )

    expect(screen.getAllByTestId('shoe-card')).toHaveLength(2)
    expect(screen.getByText(t.shoes.kmOver('875'))).toBeInTheDocument()
    expect(screen.getByText(t.shoes.kmOver('387'))).toBeInTheDocument()
    expect(screen.getByText(t.shoes.limitLine('1,375', '500', 12))).toBeInTheDocument()
  })

  it('reads a healthy pair neutrally and a pair near its limit in amber', () => {
    render(
      <ShoesGrid
        shoes={[
          shoe({ gearId: 'a', totalKm: 604, wearPercent: 60 }),
          shoe({ gearId: 'b', totalKm: 950, wearPercent: 95 }),
        ]}
      />,
    )

    expect(screen.getByText(t.shoes.kmLeft('396')).className).toContain('text-muted-foreground')
    expect(screen.getByText(t.shoes.kmLeft('50')).className).toContain('amber')
  })

  it('orders the pairs most worn first, each with a bar sized to its wear', () => {
    const { container } = render(
      <ShoesGrid
        shoes={[
          shoe({ gearId: 'a', totalKm: 53, wearPercent: 5 }),
          shoe({ gearId: 'b', totalKm: 604, wearPercent: 60 }),
        ]}
      />,
    )

    expect(barWidths(container)).toEqual(['60.4%', '5.3%'])
  })

  it('writes the context line the page gives, or when the pair last ran', () => {
    const thisYear = new Date().getFullYear()
    render(
      <ShoesGrid
        shoes={[shoe({ gearId: 'a', wearPercent: 90, totalKm: 900 }), shoe({ gearId: 'b', lastUsedDate: `${thisYear}-09-17` })]}
        insights={{ a: t.shoes.hero.usage(3, 6) }}
      />,
    )

    expect(screen.getByText(t.shoes.hero.usage(3, 6))).toBeInTheDocument()
    expect(screen.getByText(t.shoes.lastRunSentence('Sep 17'))).toBeInTheDocument()
  })

  it('lists a retired pair as a row with its era, runs and km, and no bar', () => {
    const { container } = render(
      <ShoesGrid
        shoes={[
          shoe({
            gearId: 'b',
            name: 'Cloudrun 3',
            totalKm: 92,
            retired: true,
            wearPercent: 100,
            sessionCount: 9,
            firstUsedDate: '2025-04-01',
            lastUsedDate: '2025-09-12',
          }),
        ]}
      />,
    )

    expect(screen.getByText(t.shoes.retiredTitle('Cloudrun 3'))).toBeInTheDocument()
    expect(screen.getByTestId('retired-row').textContent).toContain('9 runs · 92 km')
    expect(barWidths(container)).toEqual([])
  })

  it('opens the comparison from its row', () => {
    render(<ShoesGrid shoes={[shoe({})]} compare={<p>comparison</p>} />)

    expect(screen.getByText(t.shoes.comparison.title)).toBeInTheDocument()
    expect(screen.getByText(t.shoes.comparison.subtitle)).toBeInTheDocument()
    expect(screen.getByText('comparison').closest('details')).not.toBeNull()
  })
})
