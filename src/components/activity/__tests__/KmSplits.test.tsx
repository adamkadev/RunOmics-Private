import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Activity, ActivitySplit } from '@/domain/activity/types'
import { t } from '@/i18n'
import { KmSplits, isStructured } from '../KmSplits'
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

/** A run of laps opens on its kilometres; the laps are one tap away. */
function showLaps() {
  act(() => screen.getByRole('tab', { name: t.activity.splits.lapTitle }).click())
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
    showLaps()

    expect(screen.queryByText(t.activity.splits.title)).not.toBeInTheDocument()
    expect(screen.getAllByText(t.activity.splits.intervalTypes.lap!)).toHaveLength(3)
    for (const n of ['1', '2', '3']) expect(screen.getByText(n)).toBeInTheDocument()
  })

  it('shows lap duration, distance, pace and heart rate', () => {
    render(<KmSplits activity={activityWith([split('lap', 600, 2000, 150), split('lap', 480, 2000, 158)])} />)
    showLaps()

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

    // A structured session opens on its laps.
    expect(screen.getByRole('tab', { name: t.activity.splits.lapTitle })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(t.activity.splits.intervalTypes.interval_warmup!)).toBeInTheDocument()
    expect(screen.getByText(t.activity.splits.intervalTypes.interval_active!)).toBeInTheDocument()
  })

  it('keeps the interval title when there are no kilometres to switch to', () => {
    render(
      <KmSplits
        activity={{
          ...activityWith([split('interval_warmup', 600, 2000, 120), split('interval_active', 240, 1000, 175)]),
          distanceKm: 9,
        }}
      />,
    )

    expect(screen.getByText(t.activity.splits.title)).toBeInTheDocument()
    expect(screen.queryByRole('tab')).toBeNull()
  })

  it('totals every split row', () => {
    const { container } = render(
      <KmSplits activity={activityWith([split('lap', 300, 1000, 150), split('lap', 300, 1000, 150)])} />,
    )
    showLaps()

    const totalRow = container.querySelector('.border-t')!
    expect(within(totalRow as HTMLElement).getByText('2.00')).toBeInTheDocument()
    expect(within(totalRow as HTMLElement).getByText('10:00')).toBeInTheDocument()
  })

  it('colours the segment labels the way the plan structure bar does', () => {
    // The plan structure bar draws warm-up and cool-down as one neutral and keeps blue for recovery.
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

    expect(screen.getByText(t.activity.tabs.intervals)).toBeInTheDocument()
    expect(screen.getAllByTestId('km-split')).toHaveLength(5)
    expect(screen.queryByText(t.activity.splits.intervalTypes.lap!)).not.toBeInTheDocument()
    // One lap and no auto laps: nothing to switch to.
    expect(screen.queryByRole('tab', { name: t.activity.splits.lapTitle })).toBeNull()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('keeps the interval table when the run actually has a structure', () => {
    const structured = {
      ...continuous,
      splits: [split('interval_warmup', 600, 2000, 130), split('interval_active', 300, 1200, 170)],
    } as unknown as Activity

    render(<KmSplits activity={structured} />)

    expect(screen.queryByTestId('km-split')).toBeNull()
    expect(screen.getByText(t.activity.splits.intervalTypes.interval_active!)).toBeInTheDocument()
  })

  // A long run started from a workout comes as one interval, though no laps were pressed.
  it('opens a run kept as one interval on its kilometres, and calls it the whole run under Laps', async () => {
    const user = userEvent.setup()
    const autoLaps = [1, 2, 3, 4, 5].map(() => ({ durationSec: 300, distanceM: 1000, avgSpeedMs: 1000 / 300, avgHr: 150 }))
    // The lap is the run: 5 km of a 5 km activity.
    render(<KmSplits activity={{ ...continuous, distanceKm: 5, splits: [split('interval_active', 1500, 5000, 150, autoLaps)] } as Activity} />)

    expect(screen.getAllByTestId('km-split')).toHaveLength(5)
    expect(screen.getByRole('tab', { name: t.activity.splits.cols.km })).toHaveAttribute('aria-selected', 'true')
    showLaps()
    expect(screen.queryByTestId('km-split')).toBeNull()
    const whole = screen.getByTestId('whole-run-lap')
    expect(within(whole).getByText(t.activity.splits.wholeRun)).toBeInTheDocument()
    expect(whole.textContent).not.toContain(t.activity.splits.intervalTypes.interval_active!)
    expect(whole.textContent).toContain(t.activity.splits.noLapsPressed)

    await user.click(within(whole).getByRole('button', { name: new RegExp(t.activity.splits.seeKmSplits) }))
    expect(screen.getAllByTestId('km-split')).toHaveLength(5)
  })

  // A session started as one interval records its work block as that lap: 1.6 km of a 9.3 km threshold run.
  it('calls a single lap that is only part of the run its first lap, not the whole run', () => {
    const autoLaps = [1, 2, 3, 4].map(() => ({ durationSec: 93, distanceM: 400, avgSpeedMs: 400 / 93, avgHr: 185 }))
    render(<KmSplits activity={{ ...continuous, distanceKm: 9.3, splits: [split('interval_active', 372, 1600, 185, autoLaps)] } as Activity} />)

    showLaps()
    const card = screen.getByTestId('whole-run-lap')
    expect(card.dataset.wholeRun).toBeUndefined()
    expect(within(card).getByText(t.activity.splits.lapNumber(1))).toBeInTheDocument()
    expect(card.textContent).not.toContain(t.activity.splits.wholeRun)
    // The note still points at the kilometres, which do cover the run.
    expect(card.textContent).toContain(t.activity.splits.noLapsPressed)
  })

  it('drops the number column when the table has one row', () => {
    const autoLaps = [1, 2].map(() => ({ durationSec: 300, distanceM: 1000, avgSpeedMs: 1000 / 300, avgHr: 150 }))
    render(<KmSplits activity={{ ...continuous, distanceKm: 2, splits: [split('interval_active', 600, 2000, 150, autoLaps)] } as Activity} />)

    showLaps()
    const card = screen.getByTestId('whole-run-lap')
    expect(within(card).queryByText(t.activity.splits.cols.step)).toBeNull()
    expect(within(card).getByText(t.activity.splits.cols.lap)).toBeInTheDocument()
  })
})

describe('isStructured', () => {
  it('reads a warm-up, a recovery or a second interval as a structure', () => {
    expect(isStructured([split('lap', 300, 1000), split('lap', 300, 1000)])).toBe(false)
    expect(isStructured([split('interval_active', 1500, 5000)])).toBe(false)
    expect(isStructured([split('interval_active', 240, 1000), split('interval_active', 240, 1000)])).toBe(true)
    expect(isStructured([split('interval_warmup', 600, 2000), split('interval_active', 240, 1000)])).toBe(true)
  })
})

describe('per-km splits', () => {
  it('compares each km: a speed bar, longer when faster, and its climb', () => {
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

    expect(screen.getByText(t.activity.splits.cols.elev)).toBeInTheDocument()
    const widths = screen.getAllByTestId('km-bar').map((bar) => parseFloat(bar.style.width))
    expect(widths[0]).toBeGreaterThan(widths[1]!)
    expect(widths[1]).toBeGreaterThan(widths[2]!)
    expect(widths[0]).toBe(100)
    // No elevation stream, no climb to show.
    expect(screen.getAllByTestId('km-elev').map((el) => el.textContent)).toEqual(['-', '-', '-'])
  })

  // Here the run faded: a positive split.
  it('names the fastest km and the split in the footer', () => {
    render(
      <KmSplits
        activity={{
          ...({} as ActivityDetailView),
          distanceKm: 4,
          durationSeconds: 1000,
          paceSecPerKm: 250,
          avgHeartRate: 150,
          splits: [split('lap', 240, 1_000), split('lap', 245, 1_000), split('lap', 255, 1_000), split('lap', 260, 1_000)],
          paceSamples: null,
          hrSamples: null,
        }}
      />,
    )

    const fastest = screen.getByTestId('fastest-km')
    expect(fastest.textContent).toBe(`${t.activity.splits.fastest} ${t.activity.splits.fastestKm(1, '4:00')}`)
    expect(fastest.querySelector('b')!.className).toContain('text-accent-text')
    expect(screen.getByTestId('split-verdict').textContent).toBe(t.activity.splits.positiveSplit('+0:30'))
  })

  it('calls a negative split by its gain', () => {
    render(
      <KmSplits
        activity={{
          ...({} as ActivityDetailView),
          distanceKm: 4,
          durationSeconds: 1000,
          paceSecPerKm: 250,
          avgHeartRate: null,
          splits: [split('lap', 260, 1_000), split('lap', 255, 1_000), split('lap', 245, 1_000), split('lap', 240, 1_000)],
          paceSamples: null,
          hrSamples: null,
        }}
      />,
    )

    expect(screen.getByTestId('split-verdict').textContent).toBe(t.activity.splits.negativeSplit('−0:30'))
  })

  it('marks the fastest km and signs the climb', () => {
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
          elevationProfile: Array.from({ length: 300 }, (_, i) => (i < 100 ? 200 + (14 * i) / 99 : i < 200 ? 214 : 214 - (9 * (i - 200)) / 99)),
        }}
      />,
    )

    const rows = screen.getAllByTestId('km-split')
    expect(rows.map((row) => row.hasAttribute('data-fastest'))).toEqual([true, false, false])
    expect(rows[0]!.children[1]!.className).toContain('text-accent-text')
    expect(rows[1]!.children[1]!.className).not.toContain('text-accent-text')
    const bars = screen.getAllByTestId('km-bar')
    expect(bars[0]!.style.background).toBe('var(--accent)')
    expect(bars[1]!.style.background).not.toContain('accent')
    // The stream smoothed as the Charts tab draws it: up on km 1, down later.
    const climbs = screen.getAllByTestId('km-elev').map((el) => el.textContent!)
    expect(climbs[0]).toMatch(/^\+\d+$/)
    expect(climbs[2]).toMatch(/^[−-]\d+$/)
  })

  it('switches between the kilometres and the auto laps', () => {
    const autoLaps = [1, 2, 3].map(() => ({ durationSec: 250, distanceM: 1000, avgSpeedMs: 4, avgHr: 150 }))
    render(
      <KmSplits
        activity={{
          ...({} as ActivityDetailView),
          distanceKm: 3,
          durationSeconds: 750,
          paceSecPerKm: 250,
          avgHeartRate: 150,
          splits: [split('lap', 750, 3_000, 150, autoLaps)],
          paceSamples: null,
          hrSamples: null,
        }}
      />,
    )
    expect(screen.getAllByTestId('km-split')).toHaveLength(3)

    showLaps()
    expect(screen.queryByTestId('km-split')).toBeNull()
    expect(screen.getAllByText(t.activity.splits.intervalTypes.lap!)).toHaveLength(3)
  })
})
