import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import type { TrainingStatusDayBar } from '@/application/usecases/GetTrainingStatusDaysBar'
import { t } from '@/i18n'
import { BodyCard, deltaLabel, statusLegend } from '../BodyCard'

const STATUS = { tsbNow: 2, tsbDelta: 10, ctl: 11, ctlDelta: 3, ctlDeltaShown: 1, atl: 9, atlDelta: -9 } as unknown as TrainingStatus

function days(pattern: string): TrainingStatusDayBar[] {
  const key = { f: 'fresh', p: 'productive', m: 'maintaining', r: 'recovery' } as const
  return pattern.split('').map((c, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, status: key[c as keyof typeof key] }))
}

const WEEKS = days('mmfrpmffffrmpmmfmfmpmrmfmrff')

describe('statusLegend', () => {
  it('counts the days of each status, most first', () => {
    expect(statusLegend(WEEKS)).toEqual([
      { status: 'maintaining', days: 11 },
      { status: 'fresh', days: 10 },
      { status: 'recovery', days: 4 },
      { status: 'productive', days: 3 },
    ])
  })
})

describe('deltaLabel', () => {
  // Green "+10" and green "−9" used to mean opposite directions.
  it('gives every delta an arrow and a window', () => {
    expect(deltaLabel(10, 7)).toBe(t.dashboard.bodyCard.deltaIn('↑10', 7))
    expect(deltaLabel(-9.4, 7)).toBe(t.dashboard.bodyCard.deltaIn('↓9', 7))
    expect(deltaLabel(0.2, 14)).toBe(t.dashboard.bodyCard.deltaIn('0', 14))
  })
})

describe('BodyCard', () => {
  // No legend under the strip (v4.1 G32): the status word and colour carry it.
  it('reads the strip without a tap: status and its day count, with no legend', () => {
    render(<BodyCard status={STATUS} days={WEEKS} />)

    expect(screen.getByText(t.trainingStatus.status.fresh)).toBeInTheDocument()
    expect(screen.getByText(t.dashboard.bodyCard.daysOfLast(10, 28))).toBeInTheDocument()
    expect(screen.queryByText(new RegExp(`${t.trainingStatus.status.maintaining} 11`))).not.toBeInTheDocument()
  })

  // 28 buttons of about 23 x 16 pt needed 28 taps to decode.
  it('makes the whole strip one target that opens the history', () => {
    render(<BodyCard status={STATUS} days={WEEKS} />)

    const link = screen.getByRole('link', { name: t.dashboard.bodyCard.openHistory })
    expect(link).toHaveAttribute('href', '/analytics')
    expect(within(link).queryAllByRole('button')).toHaveLength(0)
  })

  it('places Form on a named band and keeps Fitness and Fatigue beside it', () => {
    render(<BodyCard status={STATUS} days={WEEKS} />)

    expect(screen.getByText(t.formBand.neutral.toLowerCase())).toBeInTheDocument()
    expect(screen.getByText(t.dashboard.trainingLoad.form)).toBeInTheDocument()
    expect(screen.getByText(t.trainingStatus.metrics.fitness)).toBeInTheDocument()
    expect(screen.getByText(t.dashboard.trainingLoad.fatigue)).toBeInTheDocument()
    // R1: one 7-day window for all three; Fitness read "in 14 d" beside the others.
    expect(screen.getByText(t.dashboard.bodyCard.deltaIn('↑1', 7))).toBeInTheDocument()
    expect(screen.queryByText(/in 14 d/)).toBeNull()
  })
})

describe('BodyCard definitions', () => {
  // TSB, CTL and ATL had no definition on Today.
  it('explains Form, Fitness and Fatigue behind one (i)', () => {
    render(<BodyCard status={STATUS} days={WEEKS} />)

    expect(screen.getByRole('button', { name: t.glossary.aboutThese })).toBeInTheDocument()
  })
})
