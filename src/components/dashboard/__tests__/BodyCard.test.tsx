import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import type { TrainingStatusDayBar } from '@/application/usecases/GetTrainingStatusDaysBar'
import { t } from '@/i18n'
import { BodyCard, deltaLabel, statusLegend } from '../BodyCard'

const STATUS = { tsbNow: 2, tsbDelta: 10, ctl: 11, ctlDelta: 1, atl: 9, atlDelta: -9 } as unknown as TrainingStatus

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
  it('reads the strip without a tap: status, its day count and a legend', () => {
    render(<BodyCard status={STATUS} days={WEEKS} />)

    expect(screen.getByText(t.trainingStatus.status.fresh)).toBeInTheDocument()
    expect(screen.getByText(t.dashboard.bodyCard.daysOfLast(10, 28))).toBeInTheDocument()
    expect(screen.getByText(t.dashboard.bodyCard.legendItem(t.trainingStatus.status.maintaining, 11))).toBeInTheDocument()
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
    expect(screen.getByText(t.dashboard.bodyCard.deltaIn('↑1', 14))).toBeInTheDocument()
  })
})
