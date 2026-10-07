import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MonthView } from '../MonthView'
import { PlanPhaseTrack } from '../PlanPhaseTrack'
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

function cellOf(day: string): HTMLElement {
  return screen.getByText(day).closest<HTMLElement>('[data-cell-state]')!
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
    expect(cellOf('8').textContent).toContain(`45 ${t.units.min}`)
  })

  it('writes both figures with their unit', () => {
    renderMonth()

    expect(screen.getByRole('button', { name: /September 21/ }).textContent).toContain(`8.4 ${t.units.km}`)
    expect(screen.getByRole('button', { name: /September 26/ }).textContent).toContain(`10 ${t.units.km}`)
  })
})

describe('PlanPhaseTrack', () => {
  const ranges = [
    { phase: 'base' as const, startDate: '2026-09-07', endDate: '2026-10-04' },
    { phase: 'build' as const, startDate: '2026-10-05', endDate: '2026-11-01' },
  ]

  it('marks the current phase with the accent, not a phase hue', () => {
    render(<PlanPhaseTrack ranges={ranges} weekStart="2026-09-21" weekEnd="2026-09-27" />)

    expect(screen.getByText(t.plan.phaseTrack.base).parentElement!.className).toContain('text-accent-text')
    expect(screen.getByText(t.plan.phaseTrack.build).parentElement!.className).toContain('text-muted-foreground')
  })

  // v4.17: each segment is labelled with its length, and filled to the week shown.
  it('labels each phase with its weeks and fills the current one to the week', () => {
    render(<PlanPhaseTrack ranges={ranges} weekStart="2026-09-21" weekEnd="2026-09-27" />)
    const track = screen.getByTestId('phase-track')

    expect(track.textContent).toContain(`${t.plan.phaseTrack.base} · ${t.plan.phaseTrack.weeks(4)}`)
    const fills = [...track.querySelectorAll<HTMLElement>('.bg-accent')].map((el) => el.style.width)
    expect(fills).toEqual(['75%', '0%'])
  })
})

describe('MonthView wording and grid', () => {
  // "129 of 89 km planned" read as a plan beaten, not two numbers.
  it('names run and planned km apart in the summary', () => {
    renderMonth()

    expect(screen.getByText(t.plan.summary(1, 8, 10))).toBeInTheDocument()
    expect(t.plan.summary(12, 129, 89)).toContain('129 km run')
  })

  it('draws only the weeks the month needs, each with its total as a footer', () => {
    renderMonth()
    // September 2026 starts on a Tuesday: 1 + 30 days is five weeks.
    const footers = screen.getAllByTestId('month-week-total').map((p) => p.textContent)

    // H21 and the design review: run against plan in the week view's
    // rounding, a week without a plan says so, and one still to come too.
    expect(footers).toEqual([
      t.plan.weekNoPlan('0'),
      t.plan.weekNoPlan('0'),
      t.plan.weekNoPlan('0'),
      t.plan.weekSummary.ranOfPlan('8.4', '10'),
      t.plan.noPlanYet,
    ])
    // The week's run against its plan as a bar, capped at the plan.
    const bar = screen.getAllByTestId('month-week-total')[3]!.querySelector<HTMLElement>('[aria-hidden] > span')!
    expect(bar.style.width).toBe('84%')
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
