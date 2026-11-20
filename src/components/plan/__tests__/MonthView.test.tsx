import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PlannedWorkout } from '@/domain/activity/types'
import type { PlanRun } from '../planRun'
import type { PlanPhaseRange } from '@/application/usecases/GetTrainingPlan'
import { formatDate } from '@/lib/formatters'
import { t } from '@/i18n'
import { MonthView } from '../MonthView'

function run(id: string, date: string, distanceKm: number, type: PlanRun['type'] = 'Base'): PlanRun {
  return { id, date, type, description: '', distanceKm, durationSeconds: 2_700, paceSecPerKm: 320, avgHeartRate: 140, shownType: type }
}

const TODAY = '2026-10-19'
const RUNS = [run('a', '2026-10-13', 10), run('b', '2026-10-14', 8, 'Threshold'), run('c', '2026-09-30', 9)]
const PLANNED: PlannedWorkout[] = [
  { date: '2026-10-13', name: 'Easy', type: 'Base', distanceM: 10_000 },
  { date: '2026-10-14', name: 'Intervals', type: 'Threshold', distanceM: 8_000 },
  { date: '2026-10-16', name: 'Easy', type: 'Base', distanceM: 6_000 },
  { date: '2026-10-21', name: '3 × 8 min threshold', type: 'Threshold', distanceM: 11_000 },
  { date: '2026-10-25', name: 'Long run', type: 'Base', distanceM: 18_000 },
]
const RANGES: PlanPhaseRange[] = [
  { phase: 'base', startDate: '2026-09-14', endDate: '2026-10-11' },
  { phase: 'build', startDate: '2026-10-12', endDate: '2026-11-22' },
]

function renderMonth(onSelectDay = vi.fn(), { runs = RUNS, planned = PLANNED, goalKm = null }: { runs?: PlanRun[]; planned?: PlannedWorkout[]; goalKm?: number | null } = {}) {
  const byDate = new Map<string, PlanRun[]>()
  for (const a of runs) byDate.set(a.date, [a])
  render(
    <MonthView
      year={2026}
      month={9}
      byDate={byDate}
      byDatePlanned={new Map(planned.map((p) => [p.date, p]))}
      planPhaseRanges={RANGES}
      goalKm={goalKm}
      today={TODAY}
      atPresent
      onToday={() => {}}
      onSelectDay={onSelectDay}
      onPrev={() => {}}
      onNext={() => {}}
      canGoForward={false}
    />,
  )
  return onSelectDay
}

const cell = (date: string) => document.querySelector<HTMLElement>(`[data-date="${date}"]`)!
const tile = (date: string) => within(cell(date)).getByTestId('month-tile')
const weeks = () => screen.getAllByTestId('month-week')

describe('the month grid', () => {
  it('draws only the weeks the month needs, Monday to Sunday', () => {
    renderMonth(vi.fn(), { planned: [...PLANNED, { date: '2026-10-28', name: 'Easy', type: 'Base', distanceM: 6_000 }] })

    expect(weeks()).toHaveLength(5)
    expect(cell('2026-09-28').dataset.outsideMonth).toBe('true')
    expect(cell('2026-09-28').className).toContain('opacity-40')
    expect(screen.queryByTestId('month-plan-end')).toBeNull()
  })

  it('folds the weeks after the plan’s last session into one line', () => {
    renderMonth()

    expect(weeks()).toHaveLength(4)
    expect(screen.getByTestId('month-plan-end').textContent).toBe(t.plan.month.noneAfter(formatDate('2026-10-25', { style: 'bare', year: 'never' })))
  })

  it('fills a run in its colour, dashes a session still to come, and leaves rest empty', () => {
    renderMonth()

    expect(tile('2026-10-13').style.background).toBe('color-mix(in srgb, var(--zone-2) 25%, transparent)')
    expect(tile('2026-10-13').style.border).toBe('1px solid color-mix(in srgb, var(--zone-2) 50%, transparent)')
    expect(tile('2026-10-14').style.background).toBe('color-mix(in srgb, var(--zone-4) 25%, transparent)')
    expect(tile('2026-10-21').style.border).toBe('1px dashed var(--zone-4)')
    // The long run shares the easy blue.
    expect(tile('2026-10-25').style.border).toBe('1px dashed var(--zone-2)')
    expect(tile('2026-10-15').getAttribute('style')).toBeNull()
    expect(tile('2026-10-15').textContent).toBe('')
  })

  it('names a past session that was not run missed, in amber', () => {
    renderMonth()

    expect(cell('2026-10-16').dataset.cellState).toBe('missed')
    expect(tile('2026-10-16').style.border).toBe('1px dashed var(--muted-foreground)')
  })

  it('fills today’s date in the accent', () => {
    renderMonth()

    expect(within(cell(TODAY)).getByText('19').className).toContain('bg-accent')
  })
})

describe('the phases down the side', () => {
  it('names each phase once, over its first week on screen', () => {
    renderMonth()

    expect(screen.getAllByTestId('month-phase-label').map((p) => p.textContent)).toEqual([
      t.plan.month.phaseEnds(t.plan.weekPurpose.planPhase.base, formatDate('2026-10-11', { style: 'bare' })),
      t.plan.month.phaseWeeks(t.plan.weekPurpose.planPhase.build, 6),
    ])
  })

  it('borders each week in its phase, the current one in the accent, and lifts the current week', () => {
    renderMonth()

    const [first, , , current] = weeks()
    expect(first!.style.borderLeftColor).toBe('var(--zone-1)')
    expect(current!.style.borderLeftColor).toBe('var(--accent)')
    expect(current!.dataset.current).toBe('true')
    expect(current!.className).toContain('bg-card')
  })
})

describe('the km column', () => {
  it('reads each week as run over planned, this week before a run as in progress, and a week to come as planned', () => {
    renderMonth(vi.fn(), { planned: [...PLANNED, { date: '2026-10-28', name: 'Easy', type: 'Base', distanceM: 6_000 }] })

    const totals = screen.getAllByTestId('month-week-total').map((c) => c.textContent)
    expect(totals[2]).toBe('18/ 24')
    expect(totals[3]).toBe(`29${t.plan.month.inProgressWord}`)
    expect(totals[4]).toBe(`6${t.plan.month.plannedWord}`)
  })
})

describe('opening a week', () => {
  it('opens the Week view on the day tapped', () => {
    const onSelectDay = renderMonth()

    fireEvent.click(cell('2026-10-14'))
    expect(onSelectDay).toHaveBeenCalledWith('2026-10-14')
  })

  it('opens the current week on today, another on its Monday', () => {
    const onSelectDay = renderMonth()

    fireEvent.click(within(weeks()[3]!).getByTestId('month-week-total'))
    expect(onSelectDay).toHaveBeenLastCalledWith(TODAY)
    fireEvent.click(within(weeks()[1]!).getByTestId('month-week-total'))
    expect(onSelectDay).toHaveBeenLastCalledWith('2026-10-05')
  })
})

describe('the quality letter on a tile (review 10)', () => {
  it('letters a quality day and leaves an easy one to its number', () => {
    renderMonth()

    // 14 Oct was run as a Threshold, 13 Oct as an easy run.
    expect(tile('2026-10-14').textContent).toContain(t.plan.typeLetters.Threshold)
    expect(tile('2026-10-13').textContent).not.toContain(t.plan.typeLetters.Threshold)
    // 21 Oct is a Threshold still to come.
    expect(tile('2026-10-21').textContent).toContain(t.plan.typeLetters.Threshold)
  })
})

describe('the legend and the summary', () => {
  it('keys the kinds the month draws and the dashed planned tile, Easy and Long as one blue entry', () => {
    renderMonth()

    expect(screen.getByTestId('month-legend').textContent).toBe(
      [t.plan.month.easyLong, t.activityTypes.Threshold, t.sessionState.planned].join(''),
    )
    expect(screen.getByTestId('legend-easy').querySelector<HTMLElement>('span')!.style.background).toBe('var(--zone-2)')
  })

  it('reads the month’s km against its goal, and the plan’s days and km on a line of their own', () => {
    renderMonth(vi.fn(), { goalKm: 120 })

    const covers = t.plan.month.planCovers(formatDate('2026-10-13', { style: 'bare', year: 'never' }), formatDate('2026-10-25', { style: 'bare', year: 'never' }))
    expect(screen.getByTestId('month-km').textContent).toBe(t.plan.month.runGoal('18', '120'))
    expect(screen.getByTestId('month-plan').textContent).toBe(`${covers} · ${t.plan.month.plannedKm('53')}`)
    expect(screen.getByTestId('month-plan-fill').style.width).toBe('15%')
  })

  it('compares the plan’s own days, and says the month’s total beside them', () => {
    renderMonth()

    expect(screen.getByTestId('month-km').textContent).toBe(t.plan.month.runPlanned('18', '53'))
    expect(screen.getByTestId('month-plan').textContent).toBe(
      t.plan.month.planCovers(formatDate('2026-10-13', { style: 'bare', year: 'never' }), formatDate('2026-10-25', { style: 'bare', year: 'never' })),
    )
  })

  it('counts a run between the plan’s first and last day though no session was set for it', () => {
    renderMonth(vi.fn(), { runs: [...RUNS, run('d', '2026-10-15', 5), run('e', '2026-10-05', 7)] })

    expect(screen.getByTestId('month-km').textContent).toBe(t.plan.month.runPlanned('23', '53'))
    expect(screen.getByTestId('month-plan').textContent).toContain(t.plan.month.monthTotal('30'))
  })

  it('leaves the caption out when the plan runs through the whole month', () => {
    const planned: PlannedWorkout[] = ['2026-09-29', '2026-10-02', '2026-10-06', '2026-10-13', '2026-10-20', '2026-10-27', '2026-11-03'].map((date) => ({
      date,
      name: 'Easy',
      type: 'Base',
      distanceM: 5_000,
    }))
    renderMonth(vi.fn(), { planned, runs: [...RUNS, run('d', '2026-10-01', 4)] })

    expect(screen.getByTestId('month-km').textContent).toBe(t.plan.month.runPlanned('22', '25'))
    expect(screen.queryByTestId('month-plan')).toBeNull()
  })
})
