import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { DayStateCell } from '@/components/ui/DayStateStrip'
import { t } from '@/i18n'
import { WeekChart } from '../WeekChart'

function cell(date: string, state: DayStateCell['state'], km: number | null, extra: Partial<DayStateCell> = {}): DayStateCell {
  return { date, label: date.slice(-2), fullLabel: `Day ${date}`, state, color: 'var(--zone-4)', km, isToday: false, ...extra }
}

const DAYS: DayStateCell[] = [
  cell('2026-09-28', 'done', 8.46),
  cell('2026-09-29', 'missed', 10),
  cell('2026-09-30', 'planned', 10, { isToday: true }),
  cell('2026-10-01', 'planned', 5),
  cell('2026-10-02', 'rest', null),
  cell('2026-10-03', 'rest', null, { isToday: false }),
  cell('2026-10-04', 'planned', null),
]

const bar = (date: string) => screen.getByLabelText(new RegExp(`Day ${date}`)).querySelector<HTMLElement>('[data-bar-state]')!

describe('WeekChart', () => {
  // v4.17: done the accent, planned dashed in its zone, missed neg, today the accent outline.
  it('draws each state in its own shape', () => {
    render(<WeekChart days={DAYS} />)

    expect(bar('2026-09-28').className).toContain('bg-accent')
    expect(bar('2026-09-29').className).toContain('border-[var(--neg)]')
    expect(bar('2026-09-30').className).toContain('border-accent')
    expect(bar('2026-10-01').className).toContain('border-dashed')
    expect(bar('2026-10-01').style.getPropertyValue('--bar-zone')).toBe('var(--zone-4)')
    expect(bar('2026-10-02').className).toContain('bg-[var(--surface-2)]')
  })

  it('writes each km with its unit, a run to the tenth', () => {
    render(<WeekChart days={DAYS} />)

    expect(screen.getByLabelText(/Day 2026-09-28/).textContent).toContain(`8.5 ${t.units.km}`)
    expect(screen.getByLabelText(/Day 2026-10-01/).textContent).toContain(`5 ${t.units.km}`)
    expect(screen.getByLabelText(/Day 2026-10-04/).textContent).toContain('–')
  })

  it('scales the bars to the longest day, with a stub for rest', () => {
    render(<WeekChart days={DAYS} />)

    expect(bar('2026-09-29').style.height).toBe('110px')
    expect(bar('2026-10-01').style.height).toBe('55px')
    expect(bar('2026-10-02').style.height).toBe('8px')
  })

  it("labels today's rest day as rest", () => {
    render(<WeekChart days={[cell('2026-09-28', 'rest', null, { isToday: true })]} />)

    expect(screen.getByLabelText(/Day 2026-09-28/).textContent).toContain(t.plan.restDay)
  })

  it('selects a day on tap', async () => {
    const onSelect = vi.fn()
    render(<WeekChart days={DAYS} selectedDate="2026-10-01" onSelect={onSelect} />)

    expect(screen.getByLabelText(/Day 2026-10-01/)).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByLabelText(/Day 2026-09-29/))
    expect(onSelect).toHaveBeenCalledWith('2026-09-29')
  })
})
