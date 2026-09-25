import { describe, it, expect } from 'vitest'
import { buildSegments, trainingStatusDays } from '../statusHistory'
import type { TrainingStatusType } from '@/application/usecases/GetTrainingStatus'

const point = (date: string, status: TrainingStatusType | null) => ({ date, status })

describe('buildSegments', () => {
  it('collapses consecutive days sharing a status', () => {
    const segments = buildSegments([
      point('2026-07-01', 'productive'),
      point('2026-07-02', 'productive'),
      point('2026-07-03', 'recovery'),
    ])

    expect(segments).toEqual([
      { status: 'productive', days: 2, from: '2026-07-01', to: '2026-07-02' },
      { status: 'recovery', days: 1, from: '2026-07-03', to: '2026-07-03' },
    ])
  })

  it('breaks a run across an unrated day instead of bridging it', () => {
    const segments = buildSegments([
      point('2026-07-01', 'productive'),
      point('2026-07-02', null),
      point('2026-07-03', 'productive'),
    ])

    expect(segments).toHaveLength(2)
    expect(segments.every((s) => s.days === 1)).toBe(true)
  })

  it('breaks a run across a calendar gap in the stored days', () => {
    const segments = buildSegments([point('2026-07-01', 'productive'), point('2026-07-05', 'productive')])

    expect(segments).toHaveLength(2)
  })

  it('is empty when nothing was rated', () => {
    expect(buildSegments([point('2026-07-01', null)])).toEqual([])
    expect(buildSegments([])).toEqual([])
  })
})

describe('trainingStatusDays', () => {
  // G05: Today took the last 28 records, Analytics the last 28 days.
  it('gives one entry per calendar day, unrated days as null', () => {
    const points = [
      { date: '2026-09-01', status: 'recovery' as const },
      { date: '2026-09-13', status: 'peaking' as const },
      { date: '2026-09-25', status: 'peaking' as const },
    ]
    const days = trainingStatusDays(points, '2026-09-25', 28)
    expect(days).toHaveLength(28)
    expect(days[0]!.date).toBe('2026-08-29')
    expect(days[27]).toEqual({ date: '2026-09-25', status: 'peaking' })
    expect(days.filter((d) => d.status).length).toBe(3)
    expect(days.find((d) => d.date === '2026-09-02')!.status).toBeNull()
  })
})
