import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { t } from '@/i18n'
import { RunningDynamics, deltaSentence } from '../RunningDynamics'
import type { ActivityDetailView } from '../activityViews'

const d = t.activity.dynamics

describe('deltaSentence', () => {
  // H17: the delta against the baseline tick, with its unit, in grey.
  it('writes the delta with its unit against the baseline', () => {
    expect(deltaSentence({ value: 1.0, band: { min: 0.96, median: 1.04, max: 1.14, low: 1.0, high: 1.08 }, decimals: 2, deltaUnit: 'm' })).toBe(
      `−0.04 m ${d.vsBaselineShort}`,
    )
  })

  it('says level when the run sits on the baseline', () => {
    expect(deltaSentence({ value: 246, band: { min: 231, median: 246, max: 260, low: 240, high: 252 }, decimals: 0, deltaUnit: 'ms' })).toBe(d.level)
  })

  it('has nothing to say without a baseline', () => {
    expect(deltaSentence({ value: 1.4, band: null, decimals: 2, deltaUnit: 'm' })).toBeNull()
  })
})

describe('RunningDynamics', () => {
  const activity = { strideLengthM: 1.0, cadenceSamples: [170, 171], distanceKm: 8.6 } as unknown as ActivityDetailView
  const baseline = {
    weeks: 8, runs: 20,
    strideLengthM: { min: 0.96, median: 1.04, max: 1.14, low: 1.0, high: 1.08 },
    groundContactMs: null, verticalOscillationMm: null, verticalRatioPct: null,
  }

  // v4.17: a range bar - the 8-week ends, the middle half shaded as the
  // baseline band, the run as the marker - and the note in text-2.
  it('draws the range with a baseline band, the note in text-2 and no cadence chart', () => {
    render(<RunningDynamics activity={activity} baseline={baseline} />)

    const card = screen.getByTestId('running-dynamics')
    const bar = screen.getByRole('img', { name: /Stride length/ })
    // The band runs 1.00-1.08 on a 0.96-1.14 track.
    const band = bar.children[1] as HTMLElement
    expect(parseFloat(band.style.left)).toBeCloseTo(22.22, 1)
    expect(band.style.background).toContain('var(--accent) 45%')
    expect(card.textContent).toContain('0.96')
    expect(card.textContent).toContain('1.14')
    const delta = screen.getByText(`−0.04 m ${d.vsBaselineShort}`)
    expect(delta.className).toContain('text-[var(--text-2)]')
    expect(delta.className).not.toMatch(/warn|orange|pos|neg/)
    expect(card.textContent).toContain(d.baselineNote(8))
    expect(screen.queryByText(/cadence through/i)).toBeNull()
  })
})
