import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TrainingStatusDay } from '@/infrastructure/repositories/JsonTrainingStatusRepository'

const { getTrainingStatusDays } = vi.hoisted(() => ({ getTrainingStatusDays: vi.fn() }))
vi.mock('@/infrastructure/repositories/JsonTrainingStatusRepository', () => ({ getTrainingStatusDays }))

const { getTrainingStatusDaysBar } = await import('../GetTrainingStatusDaysBar')

const TODAY = '2026-07-30'
const day = (date: string, status?: string): TrainingStatusDay => ({ date, status })

const series = (count: number, status = 'productive') =>
  Array.from({ length: count }, (_, i) => day(`2026-07-${String(i + 1).padStart(2, '0')}`, status))

describe('getTrainingStatusDaysBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('empty before the watch has rated a day in the window', () => {
    getTrainingStatusDays.mockReturnValue([])
    expect(getTrainingStatusDaysBar(28, TODAY)).toEqual([])
  })

  it('covers the last 28 calendar days to today, oldest first', () => {
    getTrainingStatusDays.mockReturnValue(series(30))
    const bar = getTrainingStatusDaysBar(28, TODAY)

    expect(bar).toHaveLength(28)
    expect(bar[0]?.date).toBe('2026-07-03')
    expect(bar.at(-1)?.date).toBe('2026-07-30')
  })

  it('leaves days the watch skipped as gaps instead of reaching back for more records', () => {
    getTrainingStatusDays.mockReturnValue([day('2026-05-01', 'peaking'), day('2026-07-20', 'productive'), day('2026-07-28', 'recovery')])
    const bar = getTrainingStatusDaysBar(28, TODAY)

    expect(bar).toHaveLength(28)
    expect(bar.filter((d) => d.status).map((d) => d.date)).toEqual(['2026-07-20', '2026-07-28'])
  })

  it('honours a shorter window when one is asked for', () => {
    getTrainingStatusDays.mockReturnValue(series(30))
    expect(getTrainingStatusDaysBar(7, TODAY)).toHaveLength(7)
  })

  it('renames the watch verdict into the vocabulary the bar reads', () => {
    getTrainingStatusDays.mockReturnValue([day('2026-07-20', 'peaking')])
    expect(getTrainingStatusDaysBar(28, TODAY).find((d) => d.date === '2026-07-20')?.status).toBe('fresh')
  })

  it('keeps an unrated day in place, with no status, so the bar shows the gap', () => {
    getTrainingStatusDays.mockReturnValue([day('2026-07-29', 'no_status'), day('2026-07-30', 'productive')])
    expect(getTrainingStatusDaysBar(2, TODAY)).toEqual([
      { date: '2026-07-29', status: null },
      { date: '2026-07-30', status: 'productive' },
    ])
  })
})
