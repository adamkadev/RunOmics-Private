import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TrainingStatusDay } from '@/infrastructure/repositories/JsonTrainingStatusRepository'

const { getTrainingStatusDays } = vi.hoisted(() => ({ getTrainingStatusDays: vi.fn() }))
vi.mock('@/infrastructure/repositories/JsonTrainingStatusRepository', () => ({ getTrainingStatusDays }))

const { getTrainingStatusCalendar } = await import('../GetTrainingStatusCalendar')

const day = (date: string, status?: string): TrainingStatusDay => ({ date, status })

describe('getTrainingStatusCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('empty before the watch has rated a single day', () => {
    getTrainingStatusDays.mockReturnValue([])

    expect(getTrainingStatusCalendar()).toEqual({})
  })

  it('keys each rating by its date', () => {
    getTrainingStatusDays.mockReturnValue([day('2026-07-19', 'productive'), day('2026-07-20', 'recovery')])

    expect(getTrainingStatusCalendar()).toEqual({
      '2026-07-19': 'productive',
      '2026-07-20': 'recovery',
    })
  })

  it('renames the watch verdicts into the vocabulary the views read', () => {
    getTrainingStatusDays.mockReturnValue([
      day('2026-07-14', 'maintaining'),
      day('2026-07-15', 'detraining'),
      day('2026-07-16', 'overreaching'),
      day('2026-07-17', 'unproductive'),
    ])

    expect(Object.values(getTrainingStatusCalendar())).toEqual([
      'maintaining',
      'detraining',
      'overreaching',
      'unproductive',
    ])
  })

  it('folds peaking into fresh, which is what it describes here', () => {
    getTrainingStatusDays.mockReturnValue([day('2026-07-20', 'peaking')])

    expect(getTrainingStatusCalendar()['2026-07-20']).toBe('fresh')
  })

  it('leaves out the days the watch declined to rate', () => {
    getTrainingStatusDays.mockReturnValue([
      day('2026-07-18', 'no_status'),
      day('2026-07-19'),
      day('2026-07-20', 'productive'),
    ])

    expect(getTrainingStatusCalendar()).toEqual({ '2026-07-20': 'productive' })
  })

  it('leaves out a verdict it has no name for', () => {
    getTrainingStatusDays.mockReturnValue([day('2026-07-20', 'some_new_garmin_status')])

    expect(getTrainingStatusCalendar()).toEqual({})
  })
})
