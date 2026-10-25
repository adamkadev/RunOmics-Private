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
  return Array.from(container.querySelectorAll<HTMLElement>('[data-testid="wear-fill"]')).map((fill) => fill.style.width)
}

describe('ShoesGrid', () => {
  it('flags every pair past its limit in its meta line and its bar', () => {
    render(
      <ShoesGrid
        shoes={[
          shoe({ gearId: 'a', name: 'Tempo Racer 2', totalKm: 1375, maxKm: 500, wearPercent: 100 }),
          shoe({ gearId: 'b', name: 'Cloudrun 4', totalKm: 1187, maxKm: 800, wearPercent: 100 }),
        ]}
      />,
    )

    expect(screen.getAllByTestId('shoe-card')).toHaveLength(2)
    for (const meta of screen.getAllByTestId('shoe-meta')) expect(meta.textContent).toContain(t.shoes.overLimit)
    for (const bar of screen.getAllByTestId('wear-bar')) expect(bar.getAttribute('data-tone')).toBe('replace')
  })

  it('shows km left in bold, and the bar turns warn at Replace soon, from 70% of the limit', () => {
    render(
      <ShoesGrid
        shoes={[
          shoe({ gearId: 'a', totalKm: 604, wearPercent: 60 }),
          shoe({ gearId: 'b', totalKm: 750, wearPercent: 75 }),
        ]}
      />,
    )

    const rows = screen.getAllByTestId('shoe-card')
    expect(rows[0]!.textContent).toContain(`250 ${t.shoes.kmLeftShort}`)
    expect(screen.getAllByTestId('wear-bar').map((bar) => bar.getAttribute('data-tone'))).toEqual(['watch', 'ok'])
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

  it('writes km / limit, runs, last run and role in the meta line, and the page\'s context line', () => {
    const thisYear = new Date().getFullYear()
    render(
      <ShoesGrid
        shoes={[shoe({ gearId: 'a', wearPercent: 90, totalKm: 900 }), shoe({ gearId: 'b', lastUsedDate: `${thisYear}-09-17`, mainType: 'Base' })]}
        insights={{ a: t.shoes.hero.usage(3, 6) }}
      />,
    )

    expect(screen.getByText(t.shoes.hero.usage(3, 6))).toBeInTheDocument()
    const meta = screen.getAllByTestId('shoe-meta')[1]!.textContent
    expect(meta).toBe(`${t.shoes.kmOf('150', '1,000')} · ${t.shoes.runs(12)} · ${t.shoes.lastRun('Sep 17')} · ${t.shoes.roles.daily}`)
  })

  it('keys the retire-from-workouts tick once when every pair shares it', () => {
    render(<ShoesGrid shoes={[shoe({ gearId: 'a' }), shoe({ gearId: 'b', totalKm: 300, wearPercent: 30 })]} />)

    expect(screen.getByTestId('shoes-tick-key').textContent).toBe(t.shoes.detail.retireFromWorkouts('800'))
    expect(screen.queryAllByTestId('wear-tick-label')).toHaveLength(0)
    expect(screen.getAllByTestId('wear-tick')).toHaveLength(2)
  })

  it('pills a pair to replace soon under its km left, in warn, and links to it from Shoes', () => {
    render(<ShoesGrid shoes={[shoe({ gearId: 'a', totalKm: 716, wearPercent: 72 }), shoe({ gearId: 'b' })]} />)

    const [soon, fresh] = screen.getAllByTestId('shoe-card')
    const pill = soon!.querySelector<HTMLElement>('[data-testid="shoe-verdict-pill"]')!
    expect(pill.textContent).toBe(t.shoes.status.watch)
    expect(pill.style.color).toBe('var(--warn)')
    expect(fresh!.querySelector('[data-testid="shoe-verdict-pill"]')).toBeNull()
    expect(soon!.getAttribute('href')).toBe('/shoes/a?from=shoes')
  })

  it('names each pair\'s tick under it when the thresholds differ', () => {
    render(<ShoesGrid shoes={[shoe({ gearId: 'a' }), shoe({ gearId: 'b', maxKm: 800, alertThresholdKm: 640 })]} />)

    expect(screen.getAllByTestId('wear-tick-label').map((label) => label.textContent)).toEqual([
      t.shoes.detail.retireFromWorkouts('800'),
      t.shoes.detail.retireFromWorkouts('640'),
    ])
  })

  it('lists a retired pair under its own label, with its era, runs and km, and no bar', () => {
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

    expect(screen.getByText(t.shoes.retiredSection(1))).toBeInTheDocument()
    const row = screen.getByTestId('retired-row')
    expect(row.textContent).toContain('Cloudrun 3')
    expect(row.textContent).toContain(t.shoes.runs(9))
    expect(row.textContent).toContain('92 km')
    expect(barWidths(container)).toEqual([])
  })

  it('opens the comparison from an outline card', () => {
    render(<ShoesGrid shoes={[shoe({})]} compare={<p>comparison</p>} />)

    expect(screen.getByText(t.shoes.comparison.title)).toBeInTheDocument()
    expect(screen.getByText(t.shoes.comparison.subtitle)).toBeInTheDocument()
    const card = screen.getByText('comparison').closest('details')!
    expect(card.className).toContain('border')
    expect(card.className).not.toContain('glass-card')
  })
})
