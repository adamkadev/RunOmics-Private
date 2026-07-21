import { describe, it, expect } from 'vitest'
import { buildSegments } from '../statusHistory'
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
    // The watch was not worn on the 2nd; the ribbon must not imply the status
    // held across the gap.
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
