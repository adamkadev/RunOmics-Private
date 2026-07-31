import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TrainingStatusDay } from '@/infrastructure/repositories/JsonTrainingStatusRepository'

const { getTrainingStatusDays } = vi.hoisted(() => ({ getTrainingStatusDays: vi.fn() }))
vi.mock('@/infrastructure/repositories/JsonTrainingStatusRepository', () => ({ getTrainingStatusDays }))

const { getTrainingStatusDaysBar } = await import('../GetTrainingStatusDaysBar')

const day = (date: string, status?: string): TrainingStatusDay => ({ date, status })

// The repository hands its days back oldest first.
const series = (count: number, status = 'productive') =>
  Array.from({ length: count }, (_, i) => day(`2026-07-${String(i + 1).padStart(2, '0')}`, status))

describe('getTrainingStatusDaysBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('empty before the watch has rated a single day', () => {
    getTrainingStatusDays.mockReturnValue([])

    expect(getTrainingStatusDaysBar()).toEqual([])
  })

  it('keeps the last four weeks by default', () => {
    getTrainingStatusDays.mockReturnValue(series(40))

    expect(getTrainingStatusDaysBar()).toHaveLength(28)
  })

  it('keeps the most recent days, not the first ones synced', () => {
    getTrainingStatusDays.mockReturnValue(series(30))
    const bar = getTrainingStatusDaysBar()

    expect(bar[0]?.date).toBe('2026-07-03')
    expect(bar.at(-1)?.date).toBe('2026-07-30')
  })

  it('reads oldest first, the way the bar is drawn', () => {
    getTrainingStatusDays.mockReturnValue(series(5))

    expect(getTrainingStatusDaysBar().map((d) => d.date)).toEqual([
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
      '2026-07-04',
      '2026-07-05',
    ])
  })

  it('honours a shorter window when one is asked for', () => {
    getTrainingStatusDays.mockReturnValue(series(30))

    expect(getTrainingStatusDaysBar(7)).toHaveLength(7)
  })

  it('hands back everything there is when the history is shorter than the window', () => {
    getTrainingStatusDays.mockReturnValue(series(3))

    expect(getTrainingStatusDaysBar()).toHaveLength(3)
  })

  it('renames the watch verdict into the vocabulary the bar reads', () => {
    getTrainingStatusDays.mockReturnValue([day('2026-07-20', 'peaking')])

    expect(getTrainingStatusDaysBar()[0]?.status).toBe('fresh')
  })

  it('keeps an unrated day in place, with no status, so the bar shows the gap', () => {
    getTrainingStatusDays.mockReturnValue([day('2026-07-19', 'no_status'), day('2026-07-20', 'productive')])

    expect(getTrainingStatusDaysBar()).toEqual([
      { date: '2026-07-19', status: null },
      { date: '2026-07-20', status: 'productive' },
    ])
  })
})
