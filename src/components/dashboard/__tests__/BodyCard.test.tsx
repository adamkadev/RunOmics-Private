import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import type { TrainingStatusDayBar } from '@/application/usecases/GetTrainingStatusDaysBar'
import { t } from '@/i18n'
import { formBand } from '@/domain/training/formBand'
import { BodyCard, FormScale, deltaLabel, latestRatedStatus } from '../BodyCard'

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
  // v4.17: the sign says which way ("+4 in 7 days"), the colour what it means.
  it('gives every delta its sign and its window', () => {
    expect(deltaLabel(10, 7)).toBe(t.dashboard.bodyCard.deltaIn('+10', 7))
    expect(deltaLabel(-9.4, 7)).toBe(t.dashboard.bodyCard.deltaIn('−9', 7))
    expect(deltaLabel(0.2, 14)).toBe(t.dashboard.bodyCard.deltaIn('±0', 14))
  })
})

describe('BodyCard', () => {
  // H03: Form, Fitness and Fatigue only; the status word is the hero's head
  // and the 28-day strip is off Today.
  it('holds the three numbers and nothing else', () => {
    render(<BodyCard status={STATUS} />)

    expect(screen.getByText(t.dashboard.trainingLoad.form)).toBeInTheDocument()
    expect(screen.getByText(t.trainingStatus.metrics.fitness)).toBeInTheDocument()
    expect(screen.getByText(t.dashboard.trainingLoad.fatigue)).toBeInTheDocument()
    expect(screen.getByText(t.dashboard.bodyCard.deltaIn('+1', 7))).toBeInTheDocument()
    // Nothing to follow inside it: the card as a whole opens Analytics › Load,
    // the three numbers' home (design review, Oct 2026).
    expect(screen.getByTestId('body-card').querySelector('a')).toBeNull()
    expect(screen.getByRole('link', { name: t.dashboard.bodyCard.open }).getAttribute('href')).toBe('/analytics')
    expect(screen.getByTestId('body-card').textContent).not.toMatch(/of the last/)
  })

  // v4.7: Form's note is its band, as Analytics names it - "Productive" was
  // Garmin's training status, not a Form band.
  it("writes Form's band before its delta, never the watch's status", () => {
    render(<BodyCard status={STATUS} watchStatus="productive" />)
    expect(screen.getByTestId('form-band').textContent).toBe(t.formBand[formBand(Math.round(STATUS.tsbNow))])
    expect(screen.getByTestId('body-card').textContent).not.toContain(t.trainingStatus.status.productive)
  })

  // v4.17: each delta takes its meaning's status colour - fatigue falling is
  // good, fatigue rising is caution - and never the accent.
  it('colours each delta by what it means', () => {
    render(<BodyCard status={{ ...STATUS, ctlDeltaShown: 4, atlDelta: -6 }} />)
    const [, fitness, fatigue] = screen.getAllByTestId('metric-delta')
    expect(fitness!.dataset.tone).toBe('pos')
    expect(fitness!.parentElement!.className).toContain('text-[var(--pos)]')
    expect(fatigue!.textContent).toBe(t.dashboard.bodyCard.deltaIn('−6', 7))
    expect(fatigue!.dataset.tone).toBe('pos')
    expect(screen.getByTestId('body-card').innerHTML).not.toContain('var(--accent')
  })

  it('reads fatigue rising and a tired Form as caution', () => {
    render(<BodyCard status={{ ...STATUS, tsbNow: -15, tsbDelta: 7, atl: 62, atlDelta: 6, ctl: 47, ctlDeltaShown: 4 }} />)
    const [form, , fatigue] = screen.getAllByTestId('metric-delta')
    expect(fatigue!.dataset.tone).toBe('warn')
    expect(fatigue!.parentElement!.className).toContain('text-[var(--warn)]')
    // v4.17.1: one meaning colour - the band's; which way Form moved is muted.
    const band = screen.getByTestId('form-band')
    expect(band.textContent).toBe(t.formBand.tired)
    expect(band.closest('.text-\\[var\\(--warn\\)\\]')).not.toBeNull()
    expect(form!.dataset.tone).toBe('muted')
    expect(form!.className).toContain('text-muted-foreground')
    expect(form!.textContent).toBe(`·${t.dashboard.bodyCard.formMoveLead(t.dashboard.bodyCard.formTrend.up)} ${t.dashboard.bodyCard.deltaIn('+7', 7)}`)
    expect(form!.querySelector('.sr-only')!.textContent).toContain(t.dashboard.bodyCard.formTrend.up)
    // v4.17.2: it wraps on a phone, never cut.
    expect(form!.closest('[class*="truncate"], [class*="nowrap"]')).toBeNull()
  })

  it('says which way Form moved in a word', () => {
    render(<BodyCard status={{ ...STATUS, tsbNow: -4, tsbDelta: -5 }} />)
    expect(screen.getAllByTestId('metric-delta')[0]!.textContent).toContain(t.dashboard.bodyCard.formTrend.down)
  })
})

// Design review, Oct 2026: "−18" alone did not say whether it was deep or normal.
describe('the Form scale', () => {
  it('marks Form on the tired / neutral / fresh scale and names its band', () => {
    render(<FormScale form={-18} />)
    const scale = screen.getByTestId('form-scale')
    expect(scale.getAttribute('aria-label')).toBe(t.dashboard.bodyCard.formOnScale('−18', t.formBand.tired))
    // −40 to +25: −18 sits a third of the way along.
    expect(screen.getByTestId('form-marker').style.left).toBe(`${(22 / 65) * 100}%`)
    expect(scale.textContent).toBe(`${t.formBand.tired}${t.formBand.neutral}${t.formBand.fresh}`)
  })

  it('rests the marker on the edge past the scale', () => {
    render(<FormScale form={40} />)
    expect(screen.getByTestId('form-marker').style.left).toBe('100%')
  })
})
