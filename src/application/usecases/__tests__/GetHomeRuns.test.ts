import { describe, it, expect, vi } from 'vitest'
import type { Activity } from '@/domain/activity/types'
import { decodeIntegers, decodePolyline } from '@/lib/polyline'

const { getAllActivities } = vi.hoisted(() => ({ getAllActivities: vi.fn() }))
vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({ getAllActivities }))

const { getHomeRuns, getHomeRunsSummary } = await import('../GetHomeRuns')

const HOME: [number, number] = [6.1, 49.6]
const AWAY: [number, number] = [2.3, 48.8]

function run(id: string, date: string, start: [number, number], durationSeconds = 1800): Activity {
  const route: [number, number][] = [start, [start[0] + 0.01, start[1]], [start[0] + 0.02, start[1] + 0.01]]
  return { id, date, route, durationSeconds, distanceKm: 5, paceSamples: [360, 360, 360] } as Activity
}

const homes = Array.from({ length: 6 }, (_, i) => run(`home-${i}`, `2026-0${i + 1}-10`, [HOME[0] + i * 0.0002, HOME[1]]))

describe('getHomeRuns', () => {
  it('keeps the runs from the shared start, oldest first, and leaves a lone start out', () => {
    getAllActivities.mockReturnValue([...homes].reverse().concat(run('away', '2026-03-01', AWAY)))

    const spots = getHomeRuns()

    expect(spots).toHaveLength(1)
    expect(spots[0]!.runs.map((r) => r.id)).toEqual(homes.map((a) => a.id))
    expect(spots[0]!.firstDate).toBe('2026-01-10')
    expect(spots[0]!.totalKm).toBe(30)
  })

  it('sends each track with one time per point, ending at the run’s duration', () => {
    getAllActivities.mockReturnValue([...homes])

    const first = getHomeRuns()[0]!.runs[0]!
    const times = decodeIntegers(first.times).reduce<number[]>((acc, d) => [...acc, (acc[acc.length - 1] ?? 0) + d], [])

    expect(decodePolyline(first.track)).toHaveLength(3)
    expect(times[0]).toBe(0)
    expect(times[2]).toBe(1800)
  })

  it('has no spot and no summary under five runs from one start', () => {
    getAllActivities.mockReturnValue(homes.slice(0, 4))

    expect(getHomeRuns()).toEqual([])
    expect(getHomeRunsSummary()).toBeNull()
  })

  it('summarises the biggest spot with a preview path', () => {
    getAllActivities.mockReturnValue([...homes])

    const summary = getHomeRunsSummary()

    expect(summary?.runCount).toBe(6)
    expect(summary?.preview.startsWith('M')).toBe(true)
  })
})
