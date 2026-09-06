import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Activity, ActivitySplit } from '@/domain/activity/types'
import { t } from '@/i18n'
import { KmSplits } from '../KmSplits'

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

  it('renders nothing without splits', () => {
    const { container } = render(<KmSplits activity={activityWith(null)} />)
    expect(container.firstChild).toBeNull()
  })
})
