import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { t } from '@/i18n'
import { RunningDynamics, deltaSentence } from '../RunningDynamics'
import type { ActivityDetailView } from '../activityViews'

const d = t.activity.dynamics

describe('deltaSentence', () => {
  // H17: the delta against the baseline tick, with its unit, in grey.
  it('writes the delta with its unit against the baseline', () => {
    expect(deltaSentence({ value: 1.0, band: { min: 0.96, median: 1.04, max: 1.14 }, decimals: 2, deltaUnit: 'm' })).toBe(
      `−0.04 m ${d.vsBaselineShort}`,
    )
  })

  it('says level when the run sits on the baseline', () => {
    expect(deltaSentence({ value: 246, band: { min: 231, median: 246, max: 260 }, decimals: 0, deltaUnit: 'ms' })).toBe(d.level)
  })

  it('has nothing to say without a baseline', () => {
    expect(deltaSentence({ value: 1.4, band: null, decimals: 2, deltaUnit: 'm' })).toBeNull()
  })
})

describe('RunningDynamics', () => {
  const activity = { strideLengthM: 1.0, cadenceSamples: [170, 171], distanceKm: 8.6 } as unknown as ActivityDetailView
  const baseline = {
    weeks: 8, runs: 20,
    strideLengthM: { min: 0.96, median: 1.04, max: 1.14 },
    groundContactMs: null, verticalOscillationMm: null, verticalRatioPct: null,
  }

  it('draws the range with a baseline tick, the delta in grey and no cadence chart', () => {
    render(<RunningDynamics activity={activity} baseline={baseline} />)

    const card = screen.getByTestId('running-dynamics')
    expect(screen.getByTestId('baseline-tick')).toBeInTheDocument()
    expect(screen.getByTestId('value-tick')).toBeInTheDocument()
    expect(card.textContent).toContain('0.96')
    expect(card.textContent).toContain('1.14')
    const delta = screen.getByText(`−0.04 m ${d.vsBaselineShort}`)
    expect(delta.className).toContain('text-muted-foreground')
    expect(delta.className).not.toMatch(/warn|orange/)
    expect(screen.queryByText(/cadence through/i)).toBeNull()
  })
})
