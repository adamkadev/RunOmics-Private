import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MonthView } from '../MonthView'
import { t } from '@/i18n'
import type { ActivitySummary } from '@/domain/activity/types'

const RUN: ActivitySummary = {
  id: 'run', date: '2026-09-21', dayOfWeek: 'Monday', type: 'Base', description: '', comment: '', distanceKm: 8.4, durationSeconds: 2_700,
  paceSecPerKm: 320, avgHeartRate: 140, rpe: 3, hrZones: [], week: 202639, elevationGain: 10,
}

function renderMonth(today = '2026-09-25') {
  return render(
    <MonthView
      year={2026}
      month={8}
      byDate={new Map([[RUN.date, [RUN]]])}
      byDatePlanned={new Map([['2026-09-26', { date: '2026-09-26', name: 'Threshold', type: 'Threshold', distanceM: 10_000 }]])}
      today={today}
      atPresent
      onToday={() => {}}
      onSelectDay={() => {}}
      onPrev={() => {}}
      onNext={() => {}}
      canGoForward={false}
    />,
  )
}

/** The month's own tile for a day number: the grid's edges repeat 1 to 4 from the months either side. */
function cellOf(day: string): HTMLElement {
  return screen.getAllByText(day).map((el) => el.closest<HTMLElement>('[data-cell-state]')!).find((cell) => !cell.dataset.outsideMonth)!
}

describe('MonthView colours', () => {
  // The today cell was ringed in a fixed emerald - the colour Base, Form and
  // "productive" wear - which on the Nature accent was the same green twice.
  it('marks today with an accent outline', () => {
    renderMonth()
    const day = screen.getByText('25')

    expect(day.style.color).toBe('var(--accent-text)')
    expect(cellOf('25').style.boxShadow).toContain('var(--accent)')
  })

  // v4.17: a planned day is its type's zone at 12%, never its own hue.
  it("tints a planned session in its zone's colour", () => {
    renderMonth()
    const cell = screen.getByRole('button', { name: /September 26/ }).closest<HTMLElement>('[data-cell-state]')!

    expect(cell.dataset.cellState).toBe('planned')
    expect(cell.style.getPropertyValue('--cell-zone')).toBe('var(--zone-4)')
    expect(cell.className).toContain('var(--cell-zone)_12%')
    // The tint alone (owner, Oct 2026): no dashed outline, no square inside.
    expect(cell.className).not.toContain('border-dashed')
    expect(cell.style.outline).toBe('')
    expect(cell.querySelector('[data-testid="month-zone-mark"]')).toBeNull()
  })

  // Design review, Oct 2026: a run nothing was planned for read the same as
  // one run to plan, and a missed day was colour alone.
  it('draws a run nothing was planned for as extra, and a past planned day as missed, never in colour alone', () => {
    renderMonth('2026-09-27')

    expect(cellOf('21').dataset.cellState).toBe('extra')
    expect(cellOf('21').className).toContain('bg-[var(--accent-soft)]')
    expect(cellOf('21').textContent).toContain(t.plan.extra)
    expect(cellOf('26').dataset.cellState).toBe('missed')
    expect(cellOf('26').className).toContain('var(--neg)')
    expect(cellOf('26').style.outline).toContain('dashed')
    expect(cellOf('26').textContent).toContain('✕')
    expect(cellOf('26').style.getPropertyValue('--cell-zone')).toBe('')
    expect(screen.getByRole('button', { name: /September 26/ }).getAttribute('aria-label')).toContain(t.sessionState.missed)
  })

  it('opens a missed session read-only, saying nothing matched it', () => {
    renderMonth('2026-09-27')
    fireEvent.click(screen.getByRole('button', { name: /September 26/ }))

    expect(screen.getByText(t.plan.missedNoRun)).toBeInTheDocument()
  })

  // Month read July's sessions planned by time alone as rest days, never missed.
  it('counts a session planned by time alone', () => {
    render(
      <MonthView
        year={2026}
        month={6}
        byDate={new Map()}
        byDatePlanned={new Map([['2026-07-08', { date: '2026-07-08', name: 'Easy', type: 'Base', durationSecs: 2_700 }]])}
        today="2026-07-20"
        atPresent={false}
        onToday={() => {}}
        onSelectDay={() => {}}
        onPrev={() => {}}
        onNext={() => {}}
        canGoForward
      />,
    )

    expect(cellOf('8').dataset.cellState).toBe('missed')
    // Bare in the tile, as mock 1c draws it; with its unit in the day's name.
    expect(cellOf('8').textContent).toContain('45′')
    expect(cellOf('8').querySelector('button')!.getAttribute('aria-label')).toContain(`45 ${t.units.min}`)
  })

  // Design review, Oct 2026 (mock 1c): one bare figure a tile, a run's bold;
  // the unit is in the day's name, and on the week row under it.
  it('shows one bare figure a day, its unit in the name', () => {
    renderMonth()

    const ran = screen.getByRole('button', { name: new RegExp(`September 21.*8\\.4 ${t.units.km}`) })
    expect(ran.textContent).toContain('8.4')
    expect(ran.textContent).not.toContain(t.units.km)
    expect(ran.querySelector('.font-semibold')!.textContent).toBe('8.4')
    const planned = screen.getByRole('button', { name: new RegExp(`September 26.*10 ${t.units.km}`) })
    expect(planned.textContent).not.toContain(t.units.km)
  })

  it('draws each day as its own rounded tile', () => {
    renderMonth()
    expect(cellOf('21').className).toContain('rounded-[10px]')
    expect(cellOf('1').className).toContain('border')
  })
})

// The owner's report, Oct 2026: October's first row read 33 of 31 km for a
// week run at 53 - its Tuesday and Wednesday were September's, left blank.
describe('MonthView edges', () => {
  const run = (id: string, date: string, distanceKm: number): ActivitySummary => ({ ...RUN, id, date, distanceKm })

  function renderOctober(onSelectDay: (date: string) => void = () => {}) {
    return render(
      <MonthView
        year={2026}
        month={9}
        byDate={new Map([
          ['2026-09-29', [run('tue', '2026-09-29', 10.4)]],
          ['2026-09-30', [run('wed', '2026-09-30', 9.2)]],
          ['2026-10-02', [run('fri', '2026-10-02', 10)]],
        ])}
        byDatePlanned={new Map([
          ['2026-09-29', { date: '2026-09-29', name: 'Threshold', type: 'Threshold', distanceM: 10_000 }],
          ['2026-10-02', { date: '2026-10-02', name: 'Easy', type: 'Base', distanceM: 10_000 }],
          ['2026-11-01', { date: '2026-11-01', name: 'Long', type: 'Base', distanceM: 14_000 }],
        ])}
        today="2026-10-08"
        atPresent
        onToday={() => {}}
        onSelectDay={onSelectDay}
        onPrev={() => {}}
        onNext={() => {}}
        canGoForward
      />,
    )
  }

  const edgeTile = (name: RegExp) => screen.getByRole('button', { name }).closest<HTMLElement>('[data-cell-state]')!

  it("fills the first and last rows with the months either side's days, muted, their state kept", () => {
    renderOctober()
    const outside = [...document.querySelectorAll<HTMLElement>('[data-outside-month]')].map((cell) => cell.querySelector('.text-xs')!.textContent)

    // October 2026 starts on a Thursday and ends on a Saturday.
    expect(outside).toEqual(['28', '29', '30', '1'])
    expect(edgeTile(/September 29/).dataset.cellState).toBe('done')
    expect(edgeTile(/September 29/).className).toContain('opacity-[0.45]')
    expect(edgeTile(/November 1/).dataset.cellState).toBe('planned')
    expect(cellOf('2').className).not.toContain('opacity-[0.45]')
  })

  it("opens a muted day's week like any other", () => {
    const opened: string[] = []
    renderOctober((date) => opened.push(date))
    fireEvent.click(screen.getByRole('button', { name: /September 30/ }))

    expect(opened).toEqual(['2026-09-30'])
  })

  it('totals each row over its whole week, the summary over the month alone', () => {
    renderOctober()
    const totals = screen.getAllByTestId('month-week-total').map((p) => p.textContent)

    expect(totals[0]).toBe('29.6/ 20')
    expect(totals.at(-1)).toBe('0/ 14')
    expect(screen.getByText(t.plan.summary(1, 10, 10))).toBeInTheDocument()
  })
})

describe('MonthView wording and grid', () => {
  // "129 of 89 km planned" read as a plan beaten, not two numbers.
  it('names run and planned km apart in the summary', () => {
    renderMonth()

    expect(screen.getByText(t.plan.summary(1, 8, 10))).toBeInTheDocument()
    expect(t.plan.summary(12, 129, 89)).toContain('129 km run')
  })

  // Design review, Oct 2026: each week's km in an 8th column, run in bold
  // over "/ planned" muted.
  it('draws only the weeks the month needs, each with its km in an 8th column', () => {
    renderMonth()
    // September 2026 starts on a Tuesday: 1 + 30 days is five weeks.
    const totals = screen.getAllByTestId('month-week-total')

    expect(totals).toHaveLength(5)
    // The column has its own header, and each total sits in its week's row.
    expect(screen.getByText(t.units.km)).toBeInTheDocument()
    expect(totals[3]!.parentElement!.children).toHaveLength(8)
    // Run bold, then the plan muted; a week with no plan has the run alone,
    // and one still to come with nothing planned has nothing.
    const [ran, planned] = [...totals[3]!.children] as HTMLElement[]
    expect(ran!.textContent).toBe('8.4')
    expect(ran!.className).toContain('font-semibold')
    expect(planned!.textContent).toBe('/ 10')
    expect(planned!.className).toContain('text-muted-foreground')
    expect(totals[0]!.textContent).toBe('0')
    expect(totals[4]!.textContent).toBe('')
    expect(screen.queryByText('WK')).not.toBeInTheDocument()
  })

  it('hides the Today button while today is in view', () => {
    renderMonth()
    expect(screen.queryByRole('button', { name: t.plan.today })).toBeNull()
  })

  // Design review, Oct 2026: one line, no card - done, the session types the
  // month plans, missed. Today's outline and "extra" say themselves.
  it('keys the month on one line: done, the types it plans, missed', () => {
    renderMonth()
    const legend = screen.getByTestId('month-legend')

    expect(legend.textContent).toBe(`${t.sessionState.done}${t.zoneLabels[4]}✕${t.sessionState.missed}`)
    expect(screen.queryByText(/planned km/)).not.toBeInTheDocument()
  })
})
