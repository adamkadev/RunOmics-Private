import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { formBand } from '@/domain/training/formBand'
import { t } from '@/i18n'
import { ReadinessCard } from '../ReadinessCard'

const STATUS = {
  status: 'productive', risk: 'low', loadTrend: 'building',
  tsbNow: -6, tsbDelta: 3, ctl: 54, ctlDelta: 2, ctlDeltaShown: 1, atl: 60, atlDelta: 4, acwr: 0.98,
} as unknown as TrainingStatus

describe('ReadinessCard (App Fixes 1a)', () => {
  it('reads Form, Fitness and Fatigue on three tiles, and no watch status', () => {
    render(<ReadinessCard status={STATUS} />)

    expect(screen.getByTestId('tile-form')).toHaveTextContent(`${t.dashboard.readiness.formLabel}−6`)
    expect(screen.getByTestId('tile-form')).toHaveTextContent(t.formBand.neutral.toLowerCase())
    expect(screen.getByTestId('tile-fitness')).toHaveTextContent(`${t.dashboard.readiness.ctl}54`)
    expect(screen.getByTestId('tile-fatigue')).toHaveTextContent(`${t.dashboard.readiness.atl}60`)
    expect(screen.queryByTestId('tile-load')).toBeNull()
    expect(screen.getByTestId('readiness-card')).not.toHaveTextContent(t.trainingStatus.status.productive)
  })

  // The line is the form state, then the load against its safe range.
  it('names the form state and the load against its range, amber while out of it', () => {
    render(<ReadinessCard status={STATUS} load={{ acute: 456, lo: 462, hi: 750, state: 'below', ratio: 0.79 }} />)
    const line = screen.getByTestId('readiness-status')
    expect(line.textContent).toBe(`${t.formBand[formBand(-6)]} · ${t.dashboard.readiness.loadState.below}`)
    expect(line.style.color).toBe('var(--warn)')
  })

  it('falls back to the tone\'s own line where the watch has no load pair', () => {
    render(<ReadinessCard status={STATUS} />)
    expect(screen.getByTestId('readiness-status').textContent).toBe(`${t.formBand.neutral} · ${t.dashboard.readiness.lineByTone.build}`)
  })

  // Rule 04: the arrow follows the number, the colour what it means.
  it('colours each delta by what it means', () => {
    render(<ReadinessCard status={STATUS} />)
    const [fitness, fatigue] = screen.getAllByTestId('readiness-delta')

    expect(fitness!.textContent).toBe(t.dashboard.readiness.deltaWeek(1, 7))
    expect(fitness!.dataset.tone).toBe('good')
    expect(fatigue!.textContent).toBe(t.dashboard.readiness.deltaWeek(4, 7))
    expect(fatigue!.dataset.tone).toBe('worse')
  })

  it('says its line in the accent while load is in range, and opens Analytics', () => {
    render(<ReadinessCard status={STATUS} />)
    expect(screen.getByTestId('readiness-status').getAttribute('style')).toContain('var(--accent-text)')
    expect(screen.getByRole('link', { name: t.dashboard.readiness.open })).toHaveAttribute('href', '/analytics')
  })

  it('turns the status line to warn when it is a caution', () => {
    render(<ReadinessCard status={{ ...STATUS, tsbNow: -32, atlDelta: 12, atl: 79 }} />)
    const line = screen.getByTestId('readiness-status')
    expect(line.textContent).toContain(t.formBand.tired)
    expect(line.getAttribute('style')).toContain('var(--warn)')
    expect(line.querySelector<HTMLElement>('[aria-hidden]')!.style.background).toBe('var(--warn)')
  })

  // Wave 5 A0: the headline follows the form state the line names.
  it('writes its own headline and body from the load, matching the form state', () => {
    const load = { acute: 456, lo: 462, hi: 750, state: 'below' as const, ratio: 0.79 }
    const { rerender } = render(<ReadinessCard status={{ ...STATUS, tsbNow: 4 }} load={load} />)
    expect(screen.getByTestId('readiness-verdict')).toHaveTextContent(t.dashboard.readiness.fallback.below(456, 462, 750).headline)
    expect(screen.getByTestId('readiness-verdict')).toHaveTextContent('456')

    rerender(<ReadinessCard status={{ ...STATUS, tsbNow: 4 }} load={load} verdict={{ headline: 'You’re fresh. Build again.', body: 'Run it in full.' }} />)
    expect(screen.getByTestId('readiness-verdict')).toHaveTextContent(t.dashboard.readiness.fallback.below(456, 462, 750).headline)

    rerender(<ReadinessCard status={{ ...STATUS, tsbNow: 12 }} load={load} />)
    expect(screen.getByTestId('readiness-verdict')).toHaveTextContent(t.dashboard.readiness.fallback.below(456, 462, 750, true).headline)
  })

  // The coach's headline and body, with no "generated" label.
  it('puts the written verdict under the line', () => {
    render(<ReadinessCard status={STATUS} verdict={{ headline: 'Long run day.', body: 'Keep it conversational.' }} />)
    const verdict = screen.getByTestId('readiness-verdict')

    expect(verdict).toHaveTextContent('Long run day.')
    expect(verdict).toHaveTextContent('Keep it conversational.')
    expect(screen.getByTestId('readiness-card')).not.toHaveTextContent(/generated/i)
  })

  // Without a verdict or a load reading there is nothing to say.
  it('shows no sentence without a written verdict or a load', () => {
    render(<ReadinessCard status={STATUS} />)
    expect(screen.queryByTestId('readiness-verdict')).toBeNull()
  })

  it('draws nothing without a training status', () => {
    const { container } = render(<ReadinessCard status={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  // 3.1.0: yesterday's verdict, until the night's sync writes today's, says so.
  it("labels yesterday's verdict, and only that one", () => {
    const { rerender } = render(<ReadinessCard status={STATUS} verdict={{ headline: 'Long run day.', body: 'Keep it conversational.', yesterday: true }} />)
    expect(screen.getByTestId('verdict-yesterday')).toHaveTextContent(t.dashboard.readiness.yesterday)
    rerender(<ReadinessCard status={STATUS} verdict={{ headline: 'Long run day.', body: 'Keep it conversational.' }} />)
    expect(screen.queryByTestId('verdict-yesterday')).toBeNull()
  })
})
