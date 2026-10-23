import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { allTimeView } from '@/application/usecases/GetAllTime'
import { t } from '@/i18n'
import { AllTime, monthlyScale } from '../AllTime'

const run = (date: string, distanceKm: number) => ({ id: `a-${date}`, date, distanceKm, durationSeconds: distanceKm * 330 })

describe('monthlyScale', () => {
  it('picks the smallest round step that needs three lines at most, the top a half step up', () => {
    expect(monthlyScale(236)).toEqual({ top: 250, ticks: [100, 200] })
    expect(monthlyScale(194)).toEqual({ top: 200, ticks: [100, 200] })
    expect(monthlyScale(101)).toEqual({ top: 125, ticks: [50, 100] })
    expect(monthlyScale(58)).toEqual({ top: 60, ticks: [20, 40, 60] })
    expect(monthlyScale(200)).toEqual({ top: 200, ticks: [100, 200] })
  })

  it('still draws one line for a first month with next to nothing in it', () => {
    expect(monthlyScale(0)).toEqual({ top: 5, ticks: [5] })
  })
})

describe('AllTime monthly km', () => {
  it('draws each month against the scale\'s lines, the month under way at its pace in a dashed outline', () => {
    // 31 km by 7 October is 137 km at its pace.
    const view = allTimeView([run('2026-08-05', 100), run('2026-09-10', 194), run('2026-10-05', 31)], '2026-10-07')
    render(<AllTime view={view} />)

    expect(screen.getAllByTestId('monthly-gridline').map((line) => line.style.bottom)).toEqual(['50%', '100%'])
    // Against the scale's 200 km top, not the best month's 194.
    const bars = Object.fromEntries(screen.getAllByTestId('month-bar').map((bar) => [bar.dataset.month, bar.style.height]))
    expect(bars).toEqual({ '2026-08': '55px', '2026-09': '107px', '2026-10': '75px' })
    expect(screen.getByTestId('month-so-far').style.height).toBe('17px')
    expect(screen.getByTestId('month-projection').textContent).toBe('137')
    expect(screen.getByTestId('monthly-years').textContent).toBe('2026')
  })

  it('draws the last 18 months, the best with its value, the month under way dashed', () => {
    const runs = Array.from({ length: 24 }, (_, i) => {
      const d = new Date(Date.UTC(2024, 10 + i, 10)).toISOString().slice(0, 10)
      return run(d, d.startsWith('2026-04') ? 236 : 100)
    })
    render(<AllTime view={allTimeView(runs, '2026-10-07')} />)
    const bars = screen.getAllByTestId('month-bar')
    expect(bars).toHaveLength(18)
    expect(bars[0]!.dataset.month).toBe('2025-05')
    const best = bars.find((bar) => bar.dataset.best)!
    expect(best.dataset.month).toBe('2026-04')
    expect(best.style.background).toBe('var(--accent)')
    expect(screen.getByTestId('best-value').textContent).toBe('236')
    expect(bars.at(-1)!.className).toContain('border-dashed')
    expect(bars[0]!.style.background).toBe('var(--band)')
    expect(bars.find((bar) => bar.dataset.month === '2026-03')!.style.background).toBe('var(--accent)')
    // 2025 spans May–Dec (8 months), 2026 Jan–Oct (10).
    expect(screen.getAllByTestId('january-divider')).toHaveLength(1)
    expect(screen.getAllByTestId('monthly-year').map((y) => [y.textContent, y.style.gridColumn])).toEqual([
      ['2025', 'span 8'],
      ['2026', 'span 10'],
    ])
    expect(screen.getByTestId('monthly-header').textContent).toBe(t.allTime.best('236', 'Apr ’26'))
  })
})

describe('AllTime by year (3.0)', () => {
  it('compares km a month, this year with its change on last year in pos, and gives each year\'s totals under it', () => {
    // 2025: 800 km over its 8 months from May, 100 a month; 2026: 1,125 over 9, 125 a month.
    const runs = [run('2025-05-10', 400), run('2025-12-10', 400), run('2026-02-10', 900), run('2026-09-01', 225)]
    render(<AllTime view={allTimeView(runs, '2026-09-20')} />)
    expect(screen.getByTestId('year-change').textContent).toBe('+25%')
    expect(screen.getByTestId('year-change').className).toContain('text-[var(--pos)]')
    expect(screen.getAllByTestId('year-totals').map((line) => line.textContent)).toEqual([
      t.allTime.yearTotals('1,125', 2),
      `${t.allTime.yearTotals('800', 2)} · ${t.allTime.fromMonth('May')}`,
    ])
  })

  it('lists the latest three years, the rest behind All years, each changed on the year before', () => {
    const runs = [2022, 2023, 2024, 2025, 2026].flatMap((y, i) => [run(`${y}-01-10`, 100 + i * 50), run(`${y}-06-10`, 100)])
    render(<AllTime view={allTimeView(runs, '2026-06-20')} />)
    const rows = screen.getAllByTestId('year-row')
    expect(rows.map((r) => r.textContent!.slice(0, 4))).toEqual(['2026', '2025', '2024', '2023', '2022'])
    expect(screen.getByTestId('year-rows').children).toHaveLength(3)
    expect(screen.getByTestId('all-years').textContent).toContain(t.allTime.allYears)
    // Four years have one before them.
    expect(screen.getAllByTestId('year-change')).toHaveLength(4)
  })

  it('opens the longest run and the biggest week in Activities', () => {
    render(<AllTime view={allTimeView([run('2026-04-14', 21.5), run('2026-04-16', 10)], '2026-10-07')} />)
    const [longest, week] = screen.getAllByTestId('all-time-best')
    expect(longest!.getAttribute('href')).toBe('/activities/a-2026-04-14')
    expect(week!.getAttribute('href')).toBe('/activities?week=2026-04-13')
  })
})
