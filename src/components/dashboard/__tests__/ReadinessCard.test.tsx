import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { formBand } from '@/domain/training/formBand'
import { t } from '@/i18n'
import { ReadinessCard } from '../ReadinessCard'
import { FORM_SCALE, dialFraction } from '../FormDial'

const STATUS = {
  status: 'productive', risk: 'low', loadTrend: 'building',
  tsbNow: -6, tsbDelta: 3, ctl: 54, ctlDelta: 2, ctlDeltaShown: 1, atl: 60, atlDelta: 4, acwr: 0.98,
} as unknown as TrainingStatus

describe('the Form dial', () => {
  // Design review 3.0: a 270° arc filled as far as Form, in the band's own
  // colour - the arc says how the athlete is, so it never takes the accent.
  it('fills as far as today’s Form on the scale and names its band', () => {
    render(<ReadinessCard status={STATUS} />)
    const dial = screen.getByTestId('form-dial')

    expect(dial.dataset.fraction).toBe(dialFraction(-6).toFixed(4))
    expect(dial.getAttribute('aria-label')).toBe(t.dashboard.readiness.formOnDial('−6', t.formBand[formBand(-6)]))
    expect(dial).toHaveTextContent('−6')
    expect(dial).toHaveTextContent(t.dashboard.readiness.formLabel)
    expect(screen.getByTestId('form-dial-fill').getAttribute('stroke')).toBe('var(--form-band-neutral)')
  })

  // App Fixes review 5: -18 read mint on Today and "Tired · below -10" in
  // amber on Analytics. One number, one tone.
  it('takes the tone of the band it falls in, as Analytics does', () => {
    const { unmount } = render(<ReadinessCard status={{ ...STATUS, tsbNow: -18 }} />)
    expect(screen.getByTestId('form-dial-fill').dataset.band).toBe('tired')
    expect(screen.getByTestId('form-dial-fill').getAttribute('stroke')).toBe('var(--form-band-tired)')
    unmount()
    render(<ReadinessCard status={{ ...STATUS, tsbNow: 12 }} />)
    expect(screen.getByTestId('form-dial-fill').getAttribute('stroke')).toBe('var(--form-band-fresh)')
  })

  it('rests on the edge past the scale, with no fill at its foot', () => {
    expect(dialFraction(40)).toBe(1)
    expect(dialFraction(-80)).toBe(0)
    render(<ReadinessCard status={{ ...STATUS, tsbNow: FORM_SCALE.min - 5 }} />)
    expect(screen.queryByTestId('form-dial-fill')).toBeNull()
  })
})

describe('ReadinessCard', () => {
  it('reads Fitness, Fatigue and Load on three tiles, and no watch status', () => {
    render(<ReadinessCard status={STATUS} />)

    expect(screen.getByTestId('tile-fitness')).toHaveTextContent(`${t.dashboard.readiness.ctl}54`)
    expect(screen.getByTestId('tile-fatigue')).toHaveTextContent(`${t.dashboard.readiness.atl}60`)
    expect(screen.getByTestId('tile-load')).toHaveTextContent(`${t.dashboard.readiness.acwr}×0.98`)
    expect(screen.getByTestId('readiness-card')).not.toHaveTextContent(t.trainingStatus.status.productive)
  })

  it('writes a dash where the load ratio has nothing', () => {
    render(<ReadinessCard status={{ ...STATUS, acwr: null }} />)
    expect(screen.getByTestId('tile-load')).toHaveTextContent(t.dashboard.readiness.noValue)
  })

  // App Fixes 1a: the line's second half is the load against its safe range,
  // the reading Analytics prints, not a word chosen off Form.
  it('says how the load sits against its safe range, in Analytics\' own words', () => {
    render(<ReadinessCard status={STATUS} load={{ acute: 456, lo: 462, hi: 750, state: 'below', ratio: 0.79 }} />)
    const line = screen.getByTestId('readiness-status')
    expect(line.textContent).toBe(`${t.dashboard.readiness.eyebrowByTone.build} · ${t.dashboard.readiness.loadState.below}`)
    expect(line.style.color).toBe('var(--warn)')
    // And the tile reads the ratio off that same pair, not a second source.
    expect(screen.getByTestId('tile-load')).toHaveTextContent(`${t.dashboard.readiness.acwr}×0.79`)
  })

  it('falls back to the tone\'s own line where the watch has no load pair', () => {
    render(<ReadinessCard status={STATUS} />)
    expect(screen.getByTestId('readiness-status').textContent).toBe(
      `${t.dashboard.readiness.eyebrowByTone.build} · ${t.dashboard.readiness.lineByTone.build}`,
    )
  })

  // Fitness climbing is good news, fatigue climbing is a caution.
  it('colours each delta by what it means', () => {
    render(<ReadinessCard status={STATUS} />)
    const [fitness, fatigue] = screen.getAllByTestId('readiness-delta')

    expect(fitness!.textContent).toContain('+1')
    expect(fitness!.getAttribute('style')).toContain('var(--good)')
    expect(fatigue!.textContent).toContain('+4')
    expect(fatigue!.getAttribute('style')).toContain('var(--tone-caution)')
  })

  it('says the readiness word and its line in the accent, and opens Analytics', () => {
    render(<ReadinessCard status={STATUS} />)
    const line = screen.getByTestId('readiness-status')

    expect(line.textContent).toBe(`${t.dashboard.readiness.eyebrowByTone.build} · ${t.dashboard.readiness.lineByTone.build}`)
    expect(line.getAttribute('style')).toContain('var(--accent-text)')
    expect(screen.getByRole('link', { name: t.dashboard.readiness.open })).toHaveAttribute('href', '/analytics')
  })

  // Design review 3.0: the dot and the words take the warn colour once the
  // state asks for care.
  it('turns the status line to warn when it is a caution', () => {
    render(<ReadinessCard status={{ ...STATUS, tsbNow: -32, atlDelta: 12, atl: 79 }} />)
    const line = screen.getByTestId('readiness-status')

    expect(line.textContent).toContain(t.dashboard.readiness.eyebrowByTone.hold)
    expect(line.getAttribute('style')).toContain('var(--warn)')
    expect(line.querySelector<HTMLElement>('[aria-hidden]')!.style.background).toBe('var(--warn)')
  })

  // The coach's headline and body beside the dial, with no "generated" label.
  it('puts the written verdict beside the dial', () => {
    render(<ReadinessCard status={STATUS} verdict={{ headline: 'Long run day.', body: 'Keep it conversational.' }} />)
    const verdict = screen.getByTestId('readiness-verdict')

    expect(verdict).toHaveTextContent('Long run day.')
    expect(verdict).toHaveTextContent('Keep it conversational.')
    expect(screen.getByTestId('readiness-card')).not.toHaveTextContent(/generated/i)
  })

  // Without a written verdict there is no sentence: the rules-based prose is gone.
  it('shows no sentence without a written verdict', () => {
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
