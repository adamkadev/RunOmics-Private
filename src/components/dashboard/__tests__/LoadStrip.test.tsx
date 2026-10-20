import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { dayTypes, type RecentLoad } from '@/application/usecases/GetRecentLoad'
import { LoadStrip } from '../LoadStrip'
import { t } from '@/i18n'

const RECENT: RecentLoad = {
  band: { lo: 42, hi: 69 },
  reading: { acute: 456, lo: 462, hi: 750, state: 'below' },
  peak: 80,
  days: [
    { date: '2026-10-16', load: 60, isToday: false, type: 'Base' },
    { date: '2026-10-17', load: 80, isToday: false, type: 'Threshold' },
    { date: '2026-10-18', load: 0, isToday: false, type: null },
    { date: '2026-10-19', load: 0, isToday: true, type: null },
  ],
}

// 3.0.2 (mock 5f): the bars in Plan's type colours - an easy or long run's
// blue, threshold's purple - a day off grey. Today without a run is an
// accent outline rather than an accent fill (App Fixes, 5a rule 2).
describe('LoadStrip', () => {
  // App Fixes 1a: the seven-day load and its safe range come from the pair
  // Analytics reads, so the two screens cannot disagree.
  it('prints the seven-day load against the safe range', () => {
    render(<LoadStrip recent={RECENT} />)
    const reading = screen.getByTestId('load-reading')
    expect(reading.textContent).toBe(`456 ${t.dashboard.loadStrip.safe(462, 750)}`)
    expect(reading.dataset.state).toBe('below')
  })

  it('colours each day by the session it was', () => {
    render(<LoadStrip recent={RECENT} />)
    const bars = screen.getAllByTestId('load-bar').map((bar) => bar.style.background)
    expect(bars).toEqual(['var(--zone-2)', 'var(--zone-4)', 'var(--line-2)', 'transparent'])
  })

  it('draws today without a run as an accent outline, never an accent fill', () => {
    render(<LoadStrip recent={RECENT} />)
    const today = screen.getAllByTestId('load-bar').at(-1)!
    expect(today.style.border).toBe('1.5px solid var(--accent)')
    expect(today.style.background).toBe('transparent')
  })

  it("types a day by its longest run, and a long run as an easy run's blue", () => {
    const types = dayTypes([
      { date: '2026-10-17', type: 'Base', durationSeconds: 900 },
      { date: '2026-10-17', type: 'Threshold', durationSeconds: 3_000 },
      { date: '2026-10-18', type: 'Base', durationSeconds: 7_200 },
    ])
    expect(Object.fromEntries(types)).toEqual({ '2026-10-17': 'Threshold', '2026-10-18': 'Base' })
  })
})
