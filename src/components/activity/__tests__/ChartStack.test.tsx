import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RUN_CHART_LINE } from '@/lib/colors'
import { t } from '@/i18n'
import { ChartStack } from '../ChartStack'

const streamCleanups = vi.hoisted(() => ({ count: 0 }))

vi.mock('@/domain/activity/cleanStream', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/domain/activity/cleanStream')>()
  return {
    ...real,
    cleanStream: (...args: Parameters<typeof real.cleanStream>) => {
      streamCleanups.count += 1
      return real.cleanStream(...args)
    },
  }
})

const SAMPLES = Array.from({ length: 200 }, (_, i) => 140 + (i % 20))

function renderStack(onScrub?: (fraction: number | null) => void) {
  const result = render(
    <ChartStack
      distanceKm={10}
      hrSamples={SAMPLES}
      avgHr={150}
      paceSamples={SAMPLES.map((hr) => hr + 160)}
      avgPaceSecPerKm={310}
      cadenceSamples={null}
      avgCadence={null}
      elevationProfile={null}
      elevationGain={null}
      onScrub={onScrub}
    />
  )
  const area = screen.getByTestId('chart-scrub') as HTMLDivElement
  // jsdom lays nothing out; give the scrub area the width a phone would.
  area.getBoundingClientRect = () => ({ left: 0, right: 350, top: 0, bottom: 200, width: 350, height: 200, x: 0, y: 0, toJSON: () => ({}) })
  return { ...result, area }
}

describe('ChartStack scrub', () => {
  // Every pointer move used to rebuild all the lanes - a cleanup pass over
  // every sample of every stream - and re-render every chart.
  it('moves the reading without rebuilding the lanes', async () => {
    streamCleanups.count = 0
    const { area } = renderStack()
    const afterMount = streamCleanups.count
    expect(afterMount).toBe(2)

    fireEvent.pointerDown(area, { clientX: 42, pointerId: 1 })
    for (const x of [100, 150, 196]) fireEvent.pointerMove(area, { clientX: x, pointerId: 1 })

    // The fraction lands on the next frame, snapped to a sample: 196 / 350 of
    // 10 km is sample 111 of 199.
    await waitFor(() => expect(screen.getByTestId('scrub-header').textContent).toMatch(/^At 5\.6 km · \d+:\d\d elapsed$/))
    expect(streamCleanups.count).toBe(afterMount)
  })

  // v4.17: the reading sits beside each lane's name; no readout card.
  it('reads each lane at the scrub point beside its name, and the map follows', async () => {
    const onScrub = vi.fn()
    const { area, unmount } = renderStack(onScrub)
    expect(screen.getByTestId('scrub-header').textContent).toBe(t.activity.charts.scrubHint)

    fireEvent.pointerMove(area, { clientX: 175, pointerId: 1, pointerType: 'mouse' })
    await waitFor(() => expect(screen.getByTestId('lane-hr').textContent).toMatch(/\d+ bpm/))
    expect(screen.getByTestId('lane-pace').textContent).toMatch(/\d:\d\d \/km/)
    expect(onScrub).toHaveBeenLastCalledWith(Math.round(0.5 * 199) / 199)

    // A mouse that leaves lets go; leaving the tab takes the marker off the map.
    fireEvent.pointerLeave(area, { pointerId: 1, pointerType: 'mouse' })
    await waitFor(() => expect(screen.getByTestId('scrub-header').textContent).toBe(t.activity.charts.scrubHint))
    onScrub.mockClear()
    unmount()
    expect(onScrub).toHaveBeenCalledWith(null)
  })

  // 3.0.2: the cursor is drawn inside each plot, never across a lane's header
  // and the numbers in it.
  it('keeps the scrub cursor inside the plots, under the lane headers', async () => {
    const { area } = renderStack()
    expect(screen.queryByTestId('scrub-cursor')).toBeNull()
    fireEvent.pointerMove(area, { clientX: 175, pointerId: 1, pointerType: 'mouse' })

    await waitFor(() => expect(screen.getAllByTestId('scrub-cursor')).toHaveLength(2))
    for (const cursor of screen.getAllByTestId('scrub-cursor')) {
      expect(cursor.parentElement!.parentElement!.dataset.testid).toMatch(/^lane-/)
      expect(cursor.parentElement!.parentElement).not.toBe(area)
    }
  })

  // 3.0: the scrub row bolds the distance, heart rate is drawn in ink and pace
  // in the accent, and the legend under the charts is gone.
  it('bolds the distance in the scrub row and colours each lane its own way', async () => {
    const { area } = renderStack()
    fireEvent.pointerMove(area, { clientX: 175, pointerId: 1, pointerType: 'mouse' })
    await waitFor(() => expect(screen.getByTestId('scrub-header').querySelector('b')?.textContent).toBe('5.0 km'))

    const line = (lane: string) => screen.getByTestId(`lane-${lane}`).querySelectorAll('path')[2]!.getAttribute('stroke')
    expect(line('hr')).toBe(RUN_CHART_LINE.hr)
    expect(line('pace')).toBe(RUN_CHART_LINE.pace)
    expect(screen.getByTestId('lane-pace').textContent).toContain(`${t.activity.charts.pace} /km ↑`)
    expect(screen.getByTestId('chart-stack').textContent).not.toContain('Run average')
  })

  it('draws the smoothed line by default and the recorded one on Raw', () => {
    streamCleanups.count = 0
    renderStack()
    const line = () => screen.getByTestId('lane-pace').querySelectorAll('path')[2]!.getAttribute('d')
    const smoothed = line()

    act(() => screen.getByRole('tab', { name: t.activity.charts.raw }).click())
    expect(screen.getByRole('tab', { name: t.activity.charts.raw })).toHaveAttribute('aria-selected', 'true')
    expect(line()).not.toBe(smoothed)
    expect(streamCleanups.count).toBe(2)
  })
})
