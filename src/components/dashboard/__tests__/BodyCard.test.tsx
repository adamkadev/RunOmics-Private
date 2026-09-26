import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import type { TrainingStatusDayBar } from '@/application/usecases/GetTrainingStatusDaysBar'
import { t } from '@/i18n'
import { formBand } from '@/domain/training/formBand'
import { BodyCard, deltaLabel, latestRatedStatus } from '../BodyCard'

const STATUS = { tsbNow: 2, tsbDelta: 10, ctl: 11, ctlDelta: 3, ctlDeltaShown: 1, atl: 9, atlDelta: -9 } as unknown as TrainingStatus

function days(pattern: string): TrainingStatusDayBar[] {
  const key = { f: 'fresh', p: 'productive', m: 'maintaining', r: 'recovery' } as const
  return pattern.split('').map((c, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, status: key[c as keyof typeof key] }))
}

const WEEKS = days('mmfrpmffffrmpmmfmfmpmrmfmrff')

describe('latestRatedStatus', () => {
  it('reads the latest day the watch rated', () => {
    expect(latestRatedStatus(WEEKS)).toBe('fresh')
    expect(latestRatedStatus([...WEEKS, { date: '2026-09-29', status: null }])).toBe('fresh')
    expect(latestRatedStatus([])).toBeNull()
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
  // H03: Form, Fitness and Fatigue only; the status word is the hero's head
  // and the 28-day strip is off Today.
  it('holds the three numbers and nothing else', () => {
    render(<BodyCard status={STATUS} />)

    expect(screen.queryByText(t.formBand.neutral.toLowerCase())).toBeNull()
    expect(screen.getByText(t.dashboard.trainingLoad.form)).toBeInTheDocument()
    expect(screen.getByText(t.trainingStatus.metrics.fitness)).toBeInTheDocument()
    expect(screen.getByText(t.dashboard.trainingLoad.fatigue)).toBeInTheDocument()
    expect(screen.getByText(t.dashboard.bodyCard.deltaIn('↑1', 7))).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByTestId('body-card').textContent).not.toMatch(/of the last/)
  })

  // v4.7: Form's note is its band, as Analytics names it - "Productive" was
  // Garmin's training status, not a Form band.
  it("writes Form's band after its delta, never the watch's status", () => {
    render(<BodyCard status={STATUS} watchStatus="productive" />)
    const note = screen.getByTestId('form-band')
    expect(note.textContent).toBe(`·${t.formBand[formBand(Math.round(STATUS.tsbNow))]}`)
    expect(screen.getByTestId('body-card').textContent).not.toContain(t.trainingStatus.status.productive)
  })

  // v4.7: each delta takes its meaning's colour - fatigue falling is good.
  it('colours each delta by what it means', () => {
    render(<BodyCard status={{ ...STATUS, ctlDeltaShown: 4, atlDelta: -6 }} />)
    const [, fitness, fatigue] = screen.getAllByTestId('metric-delta')
    expect(fitness!.getAttribute('style')).toContain('var(--good)')
    expect(fatigue!.textContent).toContain('↓6')
    expect(fatigue!.getAttribute('style')).toContain('var(--good)')
    expect(screen.getByTestId('body-card').innerHTML).not.toContain('var(--accent')
  })
})
