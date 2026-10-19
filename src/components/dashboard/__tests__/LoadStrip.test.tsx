import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { dayTypes, type RecentLoad } from '@/application/usecases/GetRecentLoad'
import { LoadStrip } from '../LoadStrip'

const RECENT: RecentLoad = {
  band: { lo: 42, hi: 69 },
  peak: 80,
  days: [
    { date: '2026-10-16', load: 60, isToday: false, type: 'Base' },
    { date: '2026-10-17', load: 80, isToday: false, type: 'Threshold' },
    { date: '2026-10-18', load: 0, isToday: false, type: null },
    { date: '2026-10-19', load: 0, isToday: true, type: null },
  ],
}

// 3.0.2 (mock 5f): the bars in Plan's type colours - an easy or long run's
// blue, threshold's purple - a day off grey, today without a run the accent.
describe('LoadStrip', () => {
  it('colours each day by the session it was', () => {
    render(<LoadStrip recent={RECENT} />)
    const bars = screen.getAllByTestId('load-bar').map((bar) => bar.style.background)
    expect(bars).toEqual(['var(--zone-2)', 'var(--zone-4)', 'var(--line-2)', 'var(--accent)'])
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
