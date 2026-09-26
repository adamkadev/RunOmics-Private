import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MonthView } from '../MonthView'
import { PlanPhaseTrack } from '../PlanPhaseTrack'
import { t } from '@/i18n'

function renderMonth(today = '2026-09-25') {
  return render(
    <MonthView
      year={2026}
      month={8}
      byDate={new Map()}
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

describe('MonthView colours', () => {
  // The today cell was ringed in a fixed emerald - the colour Base, Form and
  // "productive" wear - which on the Nature accent was the same green twice.
  it('marks today with the accent', () => {
    renderMonth()
    const day = screen.getByText('25')

    expect(day.style.color).toBe('var(--accent-text)')
    expect((day.parentElement!.parentElement as HTMLElement).style.border).toContain('var(--accent)')
  })

  it("draws a planned session in its zone's colour", () => {
    renderMonth()
    const bar = screen.getByRole('button', { name: /September 26/ }).querySelector<HTMLElement>('.rounded-full')!

    expect(bar.style.background).toBe('var(--zone-4)')
  })
})

describe('PlanPhaseTrack', () => {
  it('marks the current phase with the accent, not a phase hue', () => {
    render(
      <PlanPhaseTrack
        ranges={[
          { phase: 'base', startDate: '2026-09-07', endDate: '2026-10-04' },
          { phase: 'build', startDate: '2026-10-05', endDate: '2026-11-01' },
        ]}
        weekStart="2026-09-21"
        weekEnd="2026-09-27"
      />,
    )

    expect(screen.getByText(t.plan.phaseTrack.base).style.color).toBe('var(--accent-text)')
    expect(screen.getByText(t.plan.phaseTrack.build).style.color).toBe('var(--subtle)')
  })
})

describe('MonthView wording and grid', () => {
  // "129 of 89 km planned" read as a plan beaten, not two numbers.
  it('names run and planned km apart in the summary', () => {
    renderMonth()

    expect(screen.getByText(t.plan.summary(0, 0, 10))).toBeInTheDocument()
    expect(t.plan.summary(12, 129, 89)).toContain('129 km run')
  })

  it('draws only the weeks the month needs, each with its total as a footer', () => {
    const { container } = renderMonth()
    // September 2026 starts on a Tuesday: 1 + 30 days is five weeks.
    const footers = [...container.querySelectorAll('p.text-right')]

    expect(footers).toHaveLength(5)
    // G27: the week underway reads ran of planned, not planned alone.
    expect(screen.getByText(t.plan.weekFooter.ranOfPlanned(0, 10))).toBeInTheDocument()
    expect(screen.queryByText('WK')).not.toBeInTheDocument()
  })

  it('hides the Today button while today is in view', () => {
    renderMonth()
    expect(screen.queryByRole('button', { name: t.plan.today })).toBeNull()
  })

  // v4.1 G32: no legend card under the month; shapes and zone colour carry it.
  it('has no legend card', () => {
    renderMonth()

    expect(screen.queryByText(/planned km/)).not.toBeInTheDocument()
  })
})
