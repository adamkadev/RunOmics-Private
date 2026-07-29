import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RacePredictionDay } from '@/infrastructure/repositories/JsonRacePredictionRepository'

vi.mock('@/infrastructure/repositories/JsonRacePredictionRepository', () => ({
  getRacePredictionDays: vi.fn(),
}))

async function run(days: RacePredictionDay[]) {
  const { getRacePredictionDays } = await import('@/infrastructure/repositories/JsonRacePredictionRepository')
  vi.mocked(getRacePredictionDays).mockReturnValue(days)

  const { getGarminRacePredictions } = await import('../GetGarminRacePredictions')
  return getGarminRacePredictions()
}

const dayAt = (i: number) => new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10)

describe('getGarminRacePredictions', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('null below the two days a trend needs', async () => {
    expect(await run([])).toBeNull()
    expect(await run([{ date: '2026-01-01', '5k': 1200 }])).toBeNull()
  })

  it('null when the watch never predicted any distance', async () => {
    expect(await run([{ date: '2026-01-01' }, { date: '2026-01-02' }])).toBeNull()
  })

  it('converts each finish time into a pace per kilometre', async () => {
    const data = await run([
      { date: '2026-01-01', '5k': 1200, '10k': 2500 },
      { date: '2026-01-02', '5k': 1200, '10k': 2500 },
    ])

    expect(data?.points[0]).toMatchObject({ '5k': 240, '10k': 250 })
  })

  it('divides the long distances by their real length, not a round number', async () => {
    const data = await run([
      { date: '2026-01-01', half: 5400, marathon: 11_400 },
      { date: '2026-01-02', half: 5400, marathon: 11_400 },
    ])

    expect(data?.points[0]?.half).toBe(Math.round(5400 / 21.0975))
    expect(data?.points[0]?.marathon).toBe(Math.round(11_400 / 42.195))
  })

  it('reports only the distances the watch actually predicted', async () => {
    const data = await run([
      { date: '2026-01-01', '5k': 1200 },
      { date: '2026-01-02', '5k': 1200, marathon: 11_400 },
    ])

    expect(data?.distances).toEqual(['5k', 'marathon'])
  })

  it('keeps the distances in the canonical short-to-long order', async () => {
    const data = await run([
      { date: '2026-01-01', marathon: 11_400, '5k': 1200, half: 5400, '10k': 2500 },
      { date: '2026-01-02', marathon: 11_400, '5k': 1200, half: 5400, '10k': 2500 },
    ])

    expect(data?.distances).toEqual(['5k', '10k', 'half', 'marathon'])
  })

  it('reports the latest finish times in seconds, not paces', async () => {
    const data = await run([
      { date: '2026-01-01', '5k': 1300 },
      { date: '2026-01-02', '5k': 1200 },
    ])

    expect(data?.latest).toEqual({ '5k': 1200 })
    expect(data?.latestDate).toBe('2026-01-02')
  })

  it('omits from latest a distance the final day did not predict', async () => {
    const data = await run([
      { date: '2026-01-01', '5k': 1200, marathon: 11_400 },
      { date: '2026-01-02', '5k': 1200 },
    ])

    expect(data?.distances).toEqual(['5k', 'marathon'])
    expect(data?.latest).toEqual({ '5k': 1200 })
  })

  it('carries a gap in the series through as null so the chart can bridge it', async () => {
    const data = await run([
      { date: '2026-01-01', '5k': 1200 },
      { date: '2026-01-02' },
      { date: '2026-01-03', '5k': 1190 },
    ])

    expect(data?.points.map((p) => p['5k'])).toEqual([240, null, 238])
  })

  it('caps the payload at three years, keeping the most recent days', async () => {
    const days = Array.from({ length: 1200 }, (_, i) => ({ date: dayAt(i), '5k': 1200 }))
    const data = await run(days)

    expect(data?.points).toHaveLength(1095)
    expect(data?.latestDate).toBe(dayAt(1199))
  })
})
