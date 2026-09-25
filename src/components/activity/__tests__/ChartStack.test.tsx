import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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

function renderStack() {
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
    />
  )
  const rows = result.container.querySelector('.touch-pan-y') as HTMLDivElement
  // jsdom lays nothing out; give the rows the width a phone would.
  rows.getBoundingClientRect = () => ({ left: 0, right: 350, top: 0, bottom: 200, width: 350, height: 200, x: 0, y: 0, toJSON: () => ({}) })
  return rows
}

describe('ChartStack scrub', () => {
  // Every pointer move used to rebuild all the lanes - a cleanup pass over
  // every sample of every stream - and re-render every chart.
  it('moves the readout without rebuilding the lanes', async () => {
    streamCleanups.count = 0
    const rows = renderStack()
    const afterMount = streamCleanups.count
    expect(afterMount).toBe(2)

    fireEvent.pointerDown(rows, { clientX: 42, pointerId: 1 })
    for (const x of [100, 150, 196]) fireEvent.pointerMove(rows, { clientX: x, pointerId: 1 })

    // The fraction lands on the next frame: (196 - 42) / (342 - 42) of 10 km.
    await waitFor(() => expect(screen.getByText(/5\.1 km/)).toBeInTheDocument())
    expect(streamCleanups.count).toBe(afterMount)
  })
})
