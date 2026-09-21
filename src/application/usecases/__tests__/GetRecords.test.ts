import { describe, it, expect } from 'vitest'
import { computeBestEfforts, getMostRecentRecord, getQualifiedEffortsByActivityId, getTopEfforts, type RecordEntry } from '../GetRecords'
import type { Activity } from '@/domain/activity/types'

const act = (id: string, date: string, bestEfforts: Record<string, number> | null, description = ''): Activity =>
  ({ id, date, bestEfforts, description } as Activity)

describe('computeBestEfforts', () => {
  it('returns the fastest time per effort key across activities', () => {
    const activities = [
      act('a1', '2026-01-01', { '5k': 1200 }),
      act('a2', '2026-02-01', { '5k': 1100, '10k': 2400 }),
    ]
    const best = computeBestEfforts(activities)
    expect(best.get('5k')).toMatchObject({ seconds: 1100, activityId: 'a2' })
    expect(best.get('10k')).toMatchObject({ seconds: 2400, activityId: 'a2' })
  })

  it('ignores activities without bestEfforts', () => {
    const activities = [act('a1', '2026-01-01', null)]
    expect(computeBestEfforts(activities).size).toBe(0)
  })

  it('ignores effort keys not in EFFORTS', () => {
    const activities = [act('a1', '2026-01-01', { '5k': 1200, unknown: 1 })]
    expect(computeBestEfforts(activities).has('unknown')).toBe(false)
  })
})

describe('getMostRecentRecord', () => {
  const record = (key: string, date: string | null): RecordEntry => ({
    key,
    label: key,
    seconds: 100,
    paceSecPerKm: 100,
    activityId: 'a',
    date,
    official: false,
  })

  it('returns the record with the latest date', () => {
    const records = [record('5k', '2026-01-01'), record('10k', '2026-03-01'), record('half', '2026-02-01')]
    expect(getMostRecentRecord(records)?.key).toBe('10k')
  })

  it('ignores records without a date', () => {
    const records = [record('5k', null), record('10k', '2026-03-01')]
    expect(getMostRecentRecord(records)?.key).toBe('10k')
  })

  it('returns null when no record has a date', () => {
    expect(getMostRecentRecord([record('5k', null)])).toBeNull()
  })
})

describe('getQualifiedEffortsByActivityId', () => {
  const record = (key: string, label: string, activityId: string | null): RecordEntry => ({
    key,
    label,
    seconds: 1,
    paceSecPerKm: 1,
    activityId,
    date: null,
    official: false,
  })

  it('labels the current record holder as rank 1', () => {
    const records: RecordEntry[] = [record('5k', '5K', 'a1'), record('10k', '10K', 'a1'), record('half', 'Half', 'a2')]
    const activities = [act('a1', '2026-01-01', { '5k': 1200, '10k': 2500 }), act('a2', '2026-01-05', { half: 6000 })]

    const result = getQualifiedEffortsByActivityId(records, activities)
    expect(result.a1).toEqual(
      expect.arrayContaining([
        { key: '5k', label: '5K', rank: 1 },
        { key: '10k', label: '10K', rank: 1 },
      ]),
    )
    expect(result.a2).toEqual(expect.arrayContaining([{ key: 'half', label: 'Half', rank: 1 }]))
  })

  it('ranks the next-best locally recorded efforts as #2/#3, skipping the record holder', () => {
    const records: RecordEntry[] = [record('5k', '5K', 'a1')]
    const activities = [
      act('a1', '2026-03-01', { '5k': 1000 }),
      act('a2', '2026-02-01', { '5k': 1100 }),
      act('a3', '2026-01-01', { '5k': 1200 }),
      act('a4', '2025-12-01', { '5k': 1300 }),
    ]

    const result = getQualifiedEffortsByActivityId(records, activities, 3)
    expect(result.a1).toEqual([{ key: '5k', label: '5K', rank: 1 }])
    expect(result.a2).toEqual([{ key: '5k', label: '5K', rank: 2 }])
    expect(result.a3).toEqual([{ key: '5k', label: '5K', rank: 3 }])
    expect(result.a4).toBeUndefined()
  })

  it('breaks ties by recency (newest activity keeps the better rank)', () => {
    const activities = [
      act('newer', '2026-02-01', { '5k': 1000 }),
      act('older', '2026-01-01', { '5k': 1000 }),
    ]
    const result = getQualifiedEffortsByActivityId([], activities, 2)
    expect(result.newer).toEqual([{ key: '5k', label: '5K', rank: 1 }])
    expect(result.older).toEqual([{ key: '5k', label: '5K', rank: 2 }])
  })
})

describe('official race results in effort ranking', () => {
  const escherOfficial = {
    activityId: 'escher',
    eventName: 'Escher Kulturlaf',
    date: '2026-09-05',
    distanceMeters: 5_000,
    chipTimeSeconds: 1_292,
    gunTimeSeconds: 1_293,
    overallPlace: 28,
  }

  const activities = [
    act('escher', '2026-09-05', { '5k': 1237.6 }, 'Escher Kulturlaf'),
    act('wine-route', '2025-09-28', { '5k': 1238.1 }, 'Wine Route'),
  ]

  const pbRecord: RecordEntry[] = [
    { key: '5k', label: '5K', seconds: 1_238, paceSecPerKm: 248, activityId: 'wine-route', date: '2025-09-28', official: true },
  ]

  const ranks = (officialResults: typeof escherOfficial[]) =>
    getQualifiedEffortsByActivityId(pbRecord, activities, 3, officialResults)

  it('credits the certified time instead of the over-read device effort', () => {
    expect(getTopEfforts(activities, 5, [escherOfficial])['5k']).toEqual([
      expect.objectContaining({ activityId: 'wine-route', seconds: 1_238 }),
      expect.objectContaining({ activityId: 'escher', seconds: 1_292 }),
    ])
  })

  it('stops an over-read race from claiming rank 1 over the standing official PB', () => {
    expect(ranks([escherOfficial]).escher).toEqual([{ key: '5k', label: '5K', rank: 2 }])
  })

  it('leaves the official PB holder without a device badge, since its card carries the record', () => {
    expect(ranks([escherOfficial])['wine-route']).toBeUndefined()
  })

  it('lets the over-read race take rank 1 without the overlay, which is the bug it fixes', () => {
    expect(ranks([])).toMatchObject({ escher: [{ key: '5k', rank: 1 }] })
  })

  it('still lets a genuine training effort hold rank 1 when no official result refutes it', () => {
    const remichOfficial = { ...escherOfficial, activityId: 'wine-route', eventName: 'Wine Route Remich', date: '2025-09-28', chipTimeSeconds: 1_242 }
    const withTraining = [...activities, act('seuil', '2026-05-06', { '5k': 1241.3 }, 'Seuil')]
    const result = getQualifiedEffortsByActivityId(pbRecord, withTraining, 3, [escherOfficial, remichOfficial])

    expect(result.seuil).toEqual([{ key: '5k', label: '5K', rank: 1 }])
    expect(result.escher).toEqual([{ key: '5k', label: '5K', rank: 3 }])
  })

  it('only substitutes the distance the race was actually certified over', () => {
    const tenK = [act('escher', '2026-09-05', { '5k': 1237.6, '10k': 2_600 })]
    const best = computeBestEfforts(tenK, [escherOfficial])

    expect(best.get('5k')).toMatchObject({ seconds: 1_292 })
    expect(best.get('10k')).toMatchObject({ seconds: 2_600 })
  })

  it('behaves exactly as before when no official result is linked', () => {
    expect(computeBestEfforts(activities, []).get('5k')).toMatchObject({ seconds: 1237.6, activityId: 'escher' })
    expect(computeBestEfforts(activities).get('5k')).toMatchObject({ seconds: 1237.6, activityId: 'escher' })
  })
})

describe('official PB badges never label a device effort', () => {
  const remichOfficial = {
    activityId: 'remich', eventName: 'Wine Route Remich', date: '2025-09-28',
    distanceMeters: 5_000, chipTimeSeconds: 1_242, gunTimeSeconds: 1_246, overallPlace: 63, finisherCount: 512,
  }
  const ingOfficial = {
    activityId: 'ing', eventName: 'ING Night Marathon Half', date: '2026-05-16',
    distanceMeters: 21_097, chipTimeSeconds: 5_968, gunTimeSeconds: 6_133, overallPlace: 982, finisherCount: 11_036,
  }

  const activities = [
    act('ing', '2026-05-16', { half: 5858.8, '10k': 2677.9 }, 'ING Night Marathon'),
    act('remich', '2025-09-28', { '5k': 1237.6 }, 'Wine Route Remich'),
  ]

  const officialRecords: RecordEntry[] = [
    { key: '5k', label: '5K', seconds: 1_242, paceSecPerKm: 248, activityId: 'remich', date: '2025-09-28', official: true },
    { key: 'half', label: 'Half', seconds: 5_968, paceSecPerKm: 283, activityId: 'ing', date: '2026-05-16', official: true },
  ]

  const qualified = getQualifiedEffortsByActivityId(officialRecords, activities, 3, [remichOfficial, ingOfficial])

  it('leaves the certified 5K time as the record while the device effort stays 20:37.6', () => {
    expect(officialRecords.find((r) => r.key === '5k')?.seconds).toBe(1_242)
    expect(activities.find((a) => a.id === 'remich')?.bestEfforts?.['5k']).toBe(1237.6)
  })

  it('gives Remich no 5K badge, so its 20:38 device effort cannot read as the PR', () => {
    expect(qualified.remich).toBeUndefined()
  })

  it('gives ING no half badge for the same reason', () => {
    expect(qualified.ing?.some((effort) => effort.key === 'half')).toBeFalsy()
  })

  it('credits the certified time, not the device effort, when ranking', () => {
    const top = getTopEfforts(activities, 5, [remichOfficial, ingOfficial])

    expect(top['5k']).toEqual([expect.objectContaining({ activityId: 'remich', seconds: 1_242 })])
    expect(top['half']).toEqual([expect.objectContaining({ activityId: 'ing', seconds: 5_968 })])
  })

  it('still badges a device record when no official PB exists for that distance', () => {
    expect(qualified.ing).toEqual([{ key: '10k', label: '10K', rank: 1 }])
  })

  it('keeps badging device records when the standing record is not official', () => {
    const derivedRecord: RecordEntry[] = [
      { key: '5k', label: '5K', seconds: 1_238, paceSecPerKm: 248, activityId: 'remich', date: '2025-09-28', official: false },
    ]
    const result = getQualifiedEffortsByActivityId(derivedRecord, activities, 3, [])

    expect(result.remich).toEqual([{ key: '5k', label: '5K', rank: 1 }])
  })
})
