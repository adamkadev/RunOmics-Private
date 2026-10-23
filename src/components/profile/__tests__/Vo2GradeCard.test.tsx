import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Vo2GradeView } from '@/application/usecases/GetVo2Grade'
import { Vo2GradeCard, gradeDelta } from '../Vo2GradeCard'
import { Vo2GradeDetail } from '../Vo2GradeDetail'
import { Vo2GradeTodayRow } from '@/components/dashboard/Vo2GradeTodayRow'
import { t } from '@/i18n'

vi.mock('@/components/ui/BackButton', () => ({ BackButton: () => <div data-testid="back-button" /> }))

const LADDER = [
  { grade: 'A+', min: 55.4, max: null, topPercent: 5 },
  { grade: 'A', min: 54.5, max: 55.4, topPercent: 8 },
  { grade: 'A−', min: 53.4, max: 54.5, topPercent: 12 },
  { grade: 'B+', min: 51.1, max: 53.4, topPercent: 20 },
  { grade: 'B', min: 46.8, max: 51.1, topPercent: 35 },
  { grade: 'B−', min: 42.6, max: 46.8, topPercent: 55 },
  { grade: 'C', min: null, max: 42.6, topPercent: null },
] as const

const GRADED: Vo2GradeView = {
  status: 'graded',
  grade: 'A−',
  value: 54,
  topPercent: 10,
  band: { sex: 'male', bracket: '20-29' },
  delta30: 0.8,
  ladder: [...LADDER],
  floor: 53.4,
  next: { grade: 'A', min: 54.5, gap: 0.5 },
  etaWeeks: 6,
  change: null,
  season: [{ month: '2026-01', grade: 'B' }, { month: '2026-03', grade: 'B+' }, { month: '2026-06', grade: 'B+' }, { month: '2026-09', grade: 'A−' }],
}

describe('Vo2GradeCard (v5.3 G1; 3.0 1j)', () => {
  it('shows grade, value, percentile in its band and delta, the whole card opening the grade page', () => {
    render(<Vo2GradeCard view={GRADED} />)
    const card = screen.getByTestId('vo2-grade-card')
    expect(card.tagName).toBe('A')
    expect(card.getAttribute('href')).toBe('/athlete/vo2max')
    expect(screen.getByTestId('grade-letter').textContent).toBe('A−')
    expect(screen.getByTestId('grade-letter').className).toContain('bg-[var(--accent-soft)]')
    expect(screen.getByTestId('grade-letter').className).toContain('text-accent-text')
    expect(card.textContent).toContain(`54.0${t.vo2Grade.valueLabel}`)
    expect(screen.getByTestId('grade-band').textContent).toBe('Top 10% · men 20–29')
    expect(screen.getByTestId('grade-delta').textContent).toBe(`+0.8 ${t.vo2Grade.in30d}`)
    expect(screen.getByTestId('grade-delta').getAttribute('style')).toContain('var(--good)')
    expect(screen.queryByTestId('grade-progress')).toBeNull()
    expect(screen.queryByTestId('grade-footer')).toBeNull()
  })

  it('says a level-up in pos, and a drop in muted ink, never amber', () => {
    const { unmount } = render(<Vo2GradeCard view={{ ...GRADED, change: { kind: 'up', from: 'B+', date: '2026-09-26', regained: false } }} />)
    expect(screen.getByTestId('grade-up').className).toContain('var(--pos)')
    expect(screen.getByTestId('grade-up').textContent).toBe(`${t.vo2Grade.newGrade} · ${t.vo2Grade.upFrom('B+')}`)
    unmount()
    render(<Vo2GradeCard view={{ ...GRADED, grade: 'B+', change: { kind: 'down', from: 'A−', date: '2026-09-20', daysOff: 10 } }} />)
    const down = screen.getByTestId('grade-down')
    expect(down.textContent).toBe(t.vo2Grade.downFrom('A−', 10))
    expect(down.className).toContain('text-muted-foreground')
    expect(screen.getByTestId('vo2-grade-card').innerHTML).not.toContain('tone-caution')
  })

  it('calibrates with dots for new users', () => {
    render(<Vo2GradeCard view={{ status: 'calibrating', runs: 7, runsNeeded: 5, runsTarget: 12 }} />)
    expect(screen.getByText(t.vo2Grade.gradeIn(5))).toBeInTheDocument()
    expect(screen.getByTestId('grade-calibration').children).toHaveLength(12)
  })

  it('reads a small change as ± inside the 0.3 neutral band', () => {
    expect(gradeDelta(0.2)).toBe('±0.2')
    expect(gradeDelta(-0.4)).toBe('−0.4')
    expect(gradeDelta(0.8)).toBe('+0.8')
  })
})

describe('Vo2GradeDetail (G2)', () => {
  it('marks the current row and lists the season', () => {
    render(<Vo2GradeDetail view={GRADED} />)
    const row = screen.getByTestId('grade-row-A−')
    expect(row.getAttribute('aria-current')).toBe('true')
    expect(row.textContent).toContain(t.vo2Grade.you('54.0'))
    expect(screen.getByTestId('grade-row-A').getAttribute('aria-current')).toBeNull()
    expect(screen.getByTestId('grade-row-A+').textContent).toContain(t.vo2Grade.andAbove('55.4'))
    expect(screen.getByTestId('grade-row-C').textContent).toContain(t.vo2Grade.below('42.6'))
    expect(screen.getByTestId('grade-season').textContent).toContain('B+')
    expect(screen.queryByTestId('grade-coach')).toBeNull()
  })
})

describe('Vo2GradeTodayRow (G3)', () => {
  it('shows only after a level-up, never for a drop or a steady grade', () => {
    const { rerender, container } = render(<Vo2GradeTodayRow view={{ ...GRADED, change: { kind: 'up', from: 'B+', date: '2026-09-26', regained: false } }} />)
    expect(screen.getByTestId('vo2-grade-today').textContent).toContain(t.vo2Grade.todayUp('A−'))
    expect(screen.getByTestId('vo2-grade-today').getAttribute('href')).toBe('/athlete/vo2max')
    rerender(<Vo2GradeTodayRow view={{ ...GRADED, change: { kind: 'down', from: 'A', date: '2026-09-26', daysOff: null } }} />)
    expect(container.innerHTML).toBe('')
    rerender(<Vo2GradeTodayRow view={GRADED} />)
    expect(container.innerHTML).toBe('')
  })

  it('puts the row away until the grade changes again', () => {
    localStorage.clear()
    const up = (date: string): Vo2GradeView => ({ ...GRADED, change: { kind: 'up', from: 'B+', date, regained: false } })
    const { rerender } = render(<Vo2GradeTodayRow view={up('2026-09-26')} />)
    fireEvent.click(screen.getByRole('button', { name: t.vo2Grade.dismiss }))
    expect(screen.queryByTestId('vo2-grade-today')).toBeNull()
    rerender(<Vo2GradeTodayRow view={up('2026-10-07')} />)
    expect(screen.getByTestId('vo2-grade-today')).toBeInTheDocument()
  })
})
