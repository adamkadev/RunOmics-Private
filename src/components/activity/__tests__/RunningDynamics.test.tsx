import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { t } from '@/i18n'
import { RunningDynamics, deltaSentence } from '../RunningDynamics'
import type { ActivityDetailView } from '../activityViews'

const d = t.activity.dynamics

describe('deltaSentence', () => {
  it('writes the delta with its unit against the baseline', () => {
    expect(deltaSentence({ value: 1.0, band: { min: 0.96, median: 1.04, max: 1.14, low: 1.0, high: 1.08 }, decimals: 2, deltaUnit: 'm' })).toBe(
      `−0.04 m ${d.vsUsual}`,
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

  // The track spans the 8-week range, the pill its middle half, the tick the run.
  it('draws the range scale with a usual-range pill, the note in text-2 and no cadence chart', () => {
    render(<RunningDynamics activity={activity} baseline={baseline} />)

    const card = screen.getByTestId('running-dynamics')
    const bar = screen.getByRole('img', { name: /Stride length/ })
    // The pill runs 1.00-1.08 on a 0.96-1.14 track.
    const band = bar.children[1] as HTMLElement
    expect(parseFloat(band.style.left)).toBeCloseTo(22.22, 1)
    expect(band.className).toContain('border-accent')
    expect(band.style.background).toContain('var(--accent)')
    expect(card.textContent).toContain('0.96')
    expect(card.textContent).toContain('1.14')
    // A shorter stride than usual is the amber way.
    const delta = screen.getByText(`−0.04 m ${d.vsUsual}`)
    expect(delta.style.color).toBe('var(--tone-caution)')
    expect(card.textContent).toContain(d.better.higher)
    expect(screen.queryByText(/cadence through/i)).toBeNull()
  })

  it('reads a shorter ground contact than usual as the better way', async () => {
    const { deltaTone } = await import('../RunningDynamics')
    const band = { min: 230, max: 250, low: 236, high: 244, median: 240 }
    expect(deltaTone({ term: 'groundContact', value: 234, band, decimals: 0 })).toBe('good')
    expect(deltaTone({ term: 'groundContact', value: 246, band, decimals: 0 })).toBe('worse')
    expect(deltaTone({ term: 'strideLength', value: 246, band, decimals: 0 })).toBe('good')
  })

  it('says what the pill and the tick are once, at the top', () => {
    render(<RunningDynamics activity={activity} baseline={baseline} />)

    const legend = screen.getByTestId('dynamics-legend')
    expect(legend.textContent).toContain(d.usualRange(8))
    expect(legend.textContent).toContain(d.thisRun)
    expect(screen.getByTestId('running-dynamics').firstElementChild).toBe(legend)
  })

  it('has no legend without a usual range to show', () => {
    render(<RunningDynamics activity={activity} baseline={null} />)
    expect(screen.queryByTestId('dynamics-legend')).toBeNull()
  })

  it('opens a metric definition from its name, with no info icon on the title', () => {
    render(<RunningDynamics activity={activity} baseline={baseline} />)

    const name = screen.getByRole('button', { name: t.glossary.about(t.glossary.strideLength.term) })
    expect(name.textContent).toBe(d.strideLength)
    expect(name.querySelector('svg')).toBeNull()
    act(() => name.click())
    expect(name).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('note').textContent).toBe(t.glossary.strideLength.definition)
  })
})
