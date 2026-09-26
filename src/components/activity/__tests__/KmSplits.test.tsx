import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Activity, ActivitySplit } from '@/domain/activity/types'
import { t } from '@/i18n'
import { KmSplits } from '../KmSplits'
import type { ActivityDetailView } from '../activityViews'

function split(
  type: ActivitySplit['type'],
  durationSec: number,
  distanceM: number,
  avgHr: number | null = null,
  laps: ActivitySplit['laps'] = [],
): ActivitySplit {
  return { type, durationSec, distanceM, avgSpeedMs: distanceM / durationSec, avgHr, laps }
}

function activityWith(splits: ActivitySplit[] | null): Activity {
  return { splits } as Activity
}

describe('KmSplits', () => {
  it('numbers Garmin lap splits and titles them as laps', () => {
    render(
      <KmSplits
        activity={activityWith([
          split('lap', 300, 1000, 150),
          split('lap', 290, 1000, 158),
          split('lap', 310, 1000, 161),
        ])}
      />,
    )

    expect(screen.getByText(t.activity.splits.lapTitle)).toBeInTheDocument()
    expect(screen.queryByText(t.activity.splits.title)).not.toBeInTheDocument()
    expect(screen.getAllByText(t.activity.splits.intervalTypes.lap!)).toHaveLength(3)
    for (const n of ['1', '2', '3']) expect(screen.getByText(n)).toBeInTheDocument()
  })

  it('shows lap duration, distance, pace and heart rate', () => {
    render(<KmSplits activity={activityWith([split('lap', 600, 2000, 150), split('lap', 480, 2000, 158)])} />)

    expect(screen.getByText('10:00')).toBeInTheDocument()
    expect(screen.getByText('5:00')).toBeInTheDocument()
    expect(screen.getByText('8:00')).toBeInTheDocument()
    expect(screen.getByText('4:00')).toBeInTheDocument()
    expect(screen.getAllByText('2.00')).toHaveLength(2)
    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText('158')).toBeInTheDocument()
  })

  it('keeps the interval title and labels for a structured workout', () => {
    render(
      <KmSplits
        activity={activityWith([
          split('interval_warmup', 600, 2000, 120),
          split('interval_active', 240, 1000, 175),
          split('interval_recovery', 120, 300, 140),
        ])}
      />,
    )

    expect(screen.getByText(t.activity.splits.title)).toBeInTheDocument()
    expect(screen.getByText(t.activity.splits.intervalTypes.interval_warmup!)).toBeInTheDocument()
    expect(screen.getByText(t.activity.splits.intervalTypes.interval_active!)).toBeInTheDocument()
  })

  it('totals every split row', () => {
    const { container } = render(
      <KmSplits activity={activityWith([split('lap', 300, 1000, 150), split('lap', 300, 1000, 150)])} />,
    )

    const totalRow = container.querySelector('.border-t')!
    expect(within(totalRow as HTMLElement).getByText('2.00')).toBeInTheDocument()
    expect(within(totalRow as HTMLElement).getByText('10:00')).toBeInTheDocument()
  })

  it('colours the segment labels the way the plan structure bar does', () => {
    // The two surfaces disagreed: blue meant warm-up here and recovery on the
    // structure bar, and cool-down spent a violet nothing else in the app
    // uses. The structure bar draws the two bookends as one neutral, so they
    // match here, and the cool tone belongs to the segments it names.
    render(
      <KmSplits
        activity={activityWith([
          split('interval_warmup', 600, 2000, 120),
          split('interval_active', 240, 1000, 175),
          split('interval_recovery', 120, 300, 140),
          split('interval_cooldown', 300, 1000, 118),
        ])}
      />,
    )

    const ink = (key: string) =>
      screen.getByText(t.activity.splits.intervalTypes[key]!).className

    expect(ink('interval_warmup')).toBe(ink('interval_cooldown'))
    expect(ink('interval_recovery')).toContain('blue')
    expect(ink('interval_warmup')).not.toContain('blue')
    for (const key of ['interval_warmup', 'interval_active', 'interval_recovery', 'interval_cooldown'])
      expect(ink(key), key).not.toContain('violet')
  })

  it('renders nothing without splits', () => {
    const { container } = render(<KmSplits activity={activityWith(null)} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('KmSplits on a continuous run', () => {
  const continuous = {
    distanceKm: 5,
    paceSecPerKm: 300,
    avgHeartRate: 150,
    paceSamples: Array.from({ length: 101 }, () => 300),
    hrSamples: Array.from({ length: 101 }, () => 150),
    splits: [split('lap', 1500, 5000, 150)],
  } as unknown as Activity

  it('derives per-kilometre splits instead of one interval row that restates the total', () => {
    render(<KmSplits activity={continuous} />)

    expect(screen.getByTestId('split-spread')).toBeInTheDocument()
    expect(screen.getByText(t.activity.splits.perKmTitle)).toBeInTheDocument()
    expect(screen.queryByText(t.activity.splits.intervalTypes.lap!)).not.toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('keeps the interval table when the run actually has a structure', () => {
    const structured = {
      ...continuous,
      splits: [split('interval_warmup', 600, 2000, 130), split('interval_active', 300, 1200, 170)],
    } as unknown as Activity

    render(<KmSplits activity={structured} />)

    expect(screen.queryByText(t.activity.splits.continuous)).not.toBeInTheDocument()
    expect(screen.getByText(t.activity.splits.intervalTypes.interval_active!)).toBeInTheDocument()
  })
})

describe('per-km splits', () => {
  it('compares each km: a speed bar, its gap to the average and a spread line', () => {
    render(
      <KmSplits
        activity={{
          ...({} as ActivityDetailView),
          distanceKm: 3,
          durationSeconds: 750,
          paceSecPerKm: 250,
          avgHeartRate: 150,
          splits: [split('lap', 750, 3_000, 150)],
          paceSamples: [...Array(100).fill(240), ...Array(100).fill(250), ...Array(100).fill(260)],
          hrSamples: null,
        }}
      />,
    )

    expect(screen.getByText(t.activity.splits.cols.speed)).toBeInTheDocument()
    expect(screen.getByText(t.activity.splits.cols.vsAvg)).toBeInTheDocument()
    // The spread is the header's qualifier, not a sentence.
    expect(screen.getByTestId('split-spread').textContent).toMatch(/ s spread$/)
  })

  // G14: with a 4:10 total, a 4:04 km read -5 because the unrounded paces
  // were subtracted. It is measured against Total as printed.
  it('measures vs avg against the Total row, both rounded alike', () => {
    render(
      <KmSplits
        activity={{
          ...({} as ActivityDetailView),
          distanceKm: 3,
          durationSeconds: 754,
          paceSecPerKm: 249.5,
          avgHeartRate: 150,
          splits: [split('lap', 750, 3_000, 150)],
          paceSamples: [...Array(100).fill(244.4), ...Array(100).fill(250), ...Array(100).fill(260)],
          hrSamples: null,
        }}
      />,
    )

    // km 1 prints 4:04 and Total 4:10.
    expect(screen.getByText(/^[−-]6$/)).toBeInTheDocument()
  })
})
