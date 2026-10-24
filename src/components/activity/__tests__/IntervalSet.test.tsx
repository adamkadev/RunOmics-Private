import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RepSet } from '@/domain/activity/repSet'
import { recoveryAverage } from '@/domain/activity/repSet'
import { t } from '@/i18n'
import { IntervalSet } from '../IntervalSet'

const rec = (durationSec: number, distanceM: number, avgHr: number) => ({ durationSec, distanceM, paceSecPerKm: Math.round((durationSec / distanceM) * 1000), avgHr })

const SET: RepSet = {
  reps: [
    { number: 1, durationSec: 420, distanceM: 1647, paceSecPerKm: 255, avgHr: 175, recovery: rec(120, 270, 160) },
    { number: 2, durationSec: 420, distanceM: 1647, paceSecPerKm: 255, avgHr: 178, recovery: rec(120, 280, 166) },
    { number: 3, durationSec: 420, distanceM: 1653, paceSecPerKm: 254, avgHr: 179, recovery: null },
  ],
  warmups: [{ type: 'interval_warmup', durationSec: 727, distanceM: 2000, avgSpeedMs: 2.75, avgHr: 147, laps: [] }],
  cooldowns: [{ type: 'interval_cooldown', durationSec: 606, distanceM: 1600, avgSpeedMs: 2.64, avgHr: 157, laps: [] }],
  body: null,
  strides: false,
  repDurationSec: 420,
  band: { min: 255, max: 275 },
  inBand: 3,
  spreadSecPerKm: 1,
  hrDriftBpm: 4,
}

describe('IntervalSet', () => {
  it('draws each rep as a tick on a banded track, under "band 4:15–4:35"', () => {
    render(<IntervalSet set={SET} />)

    expect(screen.getByTestId('band-header').textContent).toBe(t.activity.splits.bandLabel('4:15–4:35'))
    expect(screen.getAllByTestId('rep-row')).toHaveLength(3)
    expect(screen.getAllByTestId('rep-tick')).toHaveLength(3)
    expect(screen.getAllByTestId('rep-band')).toHaveLength(3)
    expect(screen.queryByText(/faster/i)).toBeNull()
  })

  it('collapses the recoveries into one average row', () => {
    render(<IntervalSet set={SET} />)

    expect(screen.getAllByText(t.activity.splits.recoveryAvg)).toHaveLength(1)
    const avg = recoveryAverage(SET.reps)!
    expect(avg.paceSecPerKm).toBe(Math.round((240 / 550) * 1000))
    expect(avg.avgHr).toBe(163)
    expect(screen.getByText(`${t.activity.splits.intervalTypes.interval_warmup} 2.00 ${t.units.km}`)).toBeInTheDocument()
  })

  it('lists strides after the run they follow, counted rather than graded', () => {
    const stride = (n: number, durationSec: number) => ({ number: n, durationSec, distanceM: 95, paceSecPerKm: Math.round((durationSec / 95) * 1000), avgHr: 155, recovery: null })
    const body = { type: 'interval_active' as const, durationSec: 2900, distanceM: 8000, avgSpeedMs: 2.76, avgHr: 142, laps: [] }
    render(<IntervalSet set={{ ...SET, reps: [stride(1, 20), stride(2, 19), stride(3, 20)], warmups: [], cooldowns: [], body, strides: true }} />)

    expect(screen.getByText(`${t.activity.splits.bodyLap} 8.00 ${t.units.km}`)).toBeInTheDocument()
    expect(screen.getByText(t.activity.splits.stridesLabel)).toBeInTheDocument()
    expect(screen.queryByText(t.activity.splits.inBandLabel)).toBeNull()
    expect(screen.queryByText(t.activity.splits.hrDrift)).toBeNull()
    expect(screen.getByTestId('band-header').textContent).toBe('')
    expect(screen.queryAllByTestId('rep-track')).toHaveLength(0)
  })
})
