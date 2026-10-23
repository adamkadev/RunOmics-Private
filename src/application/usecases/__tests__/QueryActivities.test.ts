import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Activity } from '@/domain/activity/types'

const { getActivities } = vi.hoisted(() => ({ getActivities: vi.fn() }))
vi.mock('../GetActivities', () => ({ getActivities }))

const { queryActivities } = await import('../QueryActivities')

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'a1',
    date: '2026-07-20',
    dayOfWeek: 'Monday',
    type: 'Base',
    description: 'Morning run',
    comment: '',
    distanceKm: 10,
    durationSeconds: 3000,
    paceSecPerKm: 300,
    avgHeartRate: 150,
    rpe: 4,
    hrZones: [],
    week: 202630,
    elevationGain: 40,
    route: [[2.3, 48.8]],
    paceSamples: [300],
    ...overrides,
  } as unknown as Activity
}

const ids = (activities: { id: string }[]) => activities.map((a) => a.id)

function withHistory(activities: Activity[]) {
  getActivities.mockReturnValue(activities)
}

describe('queryActivities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the newest runs first by default', () => {
    withHistory([
      activity({ id: 'old', date: '2026-01-01' }),
      activity({ id: 'new', date: '2026-07-01' }),
      activity({ id: 'mid', date: '2026-04-01' }),
    ])

    expect(ids(queryActivities({}).items)).toEqual(['new', 'mid', 'old'])
  })

  it('maps down to summaries so no sample array leaves the server', () => {
    withHistory([activity()])

    const [item] = queryActivities({}).items
    expect(item).not.toHaveProperty('route')
    expect(item).not.toHaveProperty('paceSamples')
    expect(item?.distanceKm).toBe(10)
  })

  it('keeps only the requested activity types', () => {
    withHistory([
      activity({ id: 'base', type: 'Base' }),
      activity({ id: 'threshold', type: 'Threshold' }),
      activity({ id: 'vo2', type: 'VO2Max' }),
      activity({ id: 'race', type: 'Race' }),
    ])

    expect(ids(queryActivities({ types: ['Threshold'] }).items)).toEqual(['threshold'])
    expect(ids(queryActivities({ types: ['Threshold', 'VO2Max'] }).items).sort()).toEqual(['threshold', 'vo2'])
  })

  it('keeps only the runs in the requested shoe', () => {
    withHistory([
      activity({ id: 'racer', gearId: 'g1' } as Partial<Activity>),
      activity({ id: 'cloud', gearId: 'g2' } as Partial<Activity>),
    ])

    expect(ids(queryActivities({ gearId: 'g1' }).items)).toEqual(['racer'])
    expect(queryActivities({ gearId: null }).total).toBe(2)
  })

  it('keeps every type when none is asked for', () => {
    withHistory([activity({ id: 'a', type: 'Base' }), activity({ id: 'b', type: 'Race' })])

    expect(queryActivities({ types: null }).total).toBe(2)
    expect(queryActivities({ types: [] }).total).toBe(2)
  })

  it('searches the description, the comment, the weekday and the date', () => {
    withHistory([
      activity({ id: 'desc', description: 'Fartlek session' }),
      activity({ id: 'comment', comment: 'new shoes felt great' }),
      activity({ id: 'weekday', dayOfWeek: 'Saturday' }),
      activity({ id: 'dated', date: '2024-03-11' }),
    ])

    expect(ids(queryActivities({ search: 'fartlek' }).items)).toEqual(['desc'])
    expect(ids(queryActivities({ search: 'shoes' }).items)).toEqual(['comment'])
    expect(ids(queryActivities({ search: 'saturday' }).items)).toEqual(['weekday'])
    expect(ids(queryActivities({ search: '2024-03' }).items)).toEqual(['dated'])
  })

  it('ignores the case and the padding around the search term', () => {
    withHistory([activity({ id: 'a', description: 'Long Run' })])

    expect(ids(queryActivities({ search: '  lOnG  ' }).items)).toEqual(['a'])
  })

  it('treats an empty search as no filter at all', () => {
    withHistory([activity({ id: 'a' }), activity({ id: 'b' })])

    expect(queryActivities({ search: '   ' }).total).toBe(2)
  })

  it('combines the type filter with the search', () => {
    withHistory([
      activity({ id: 'a', type: 'Base', description: 'hills' }),
      activity({ id: 'b', type: 'Threshold', description: 'hills' }),
      activity({ id: 'c', type: 'Threshold', description: 'flat' }),
    ])

    expect(ids(queryActivities({ types: ['Threshold'], search: 'hills' }).items)).toEqual(['b'])
  })

  it('sorts on distance, duration, pace and heart rate', () => {
    withHistory([
      activity({ id: 'a', distanceKm: 5, durationSeconds: 1800, paceSecPerKm: 360, avgHeartRate: 140 }),
      activity({ id: 'b', distanceKm: 21, durationSeconds: 6000, paceSecPerKm: 285, avgHeartRate: 165 }),
      activity({ id: 'c', distanceKm: 10, durationSeconds: 3000, paceSecPerKm: 300, avgHeartRate: 152 }),
    ])

    expect(ids(queryActivities({ sortBy: 'distance', sortOrder: 'asc' }).items)).toEqual(['a', 'c', 'b'])
    expect(ids(queryActivities({ sortBy: 'duration', sortOrder: 'desc' }).items)).toEqual(['b', 'c', 'a'])
    expect(ids(queryActivities({ sortBy: 'pace', sortOrder: 'asc' }).items)).toEqual(['b', 'c', 'a'])
    expect(ids(queryActivities({ sortBy: 'avgHr', sortOrder: 'desc' }).items)).toEqual(['b', 'c', 'a'])
  })

  it('sends a run without a pace to the slow end of a pace sort', () => {
    withHistory([
      activity({ id: 'nopace', paceSecPerKm: null }),
      activity({ id: 'fast', paceSecPerKm: 280 }),
    ])

    expect(ids(queryActivities({ sortBy: 'pace', sortOrder: 'asc' }).items)).toEqual(['fast', 'nopace'])
  })

  it('sends a run without a heart rate to the bottom of a heart-rate sort', () => {
    withHistory([activity({ id: 'nohr', avgHeartRate: null }), activity({ id: 'hr', avgHeartRate: 140 })])

    expect(ids(queryActivities({ sortBy: 'avgHr', sortOrder: 'desc' }).items)).toEqual(['hr', 'nohr'])
  })

  it('pages through the result and points at the next offset', () => {
    withHistory(Array.from({ length: 5 }, (_, i) => activity({ id: `a${i}`, date: `2026-01-0${i + 1}` })))

    const first = queryActivities({ limit: 2, sortBy: 'date', sortOrder: 'asc' })
    expect(ids(first.items)).toEqual(['a0', 'a1'])
    expect(first.nextOffset).toBe(2)

    const second = queryActivities({ limit: 2, offset: 2, sortBy: 'date', sortOrder: 'asc' })
    expect(ids(second.items)).toEqual(['a2', 'a3'])
  })

  it('closes the pagination on the last page', () => {
    withHistory(Array.from({ length: 5 }, (_, i) => activity({ id: `a${i}`, date: `2026-01-0${i + 1}` })))

    expect(queryActivities({ limit: 2, offset: 4 }).nextOffset).toBeNull()
    expect(queryActivities({ limit: 10 }).nextOffset).toBeNull()
  })

  it('counts the whole filtered set, not just the page', () => {
    withHistory(Array.from({ length: 30 }, (_, i) => activity({ id: `a${i}` })))

    const result = queryActivities({ limit: 5 })
    expect(result.items).toHaveLength(5)
    expect(result.total).toBe(30)
  })

  it('returns an empty page past the end rather than wrapping round', () => {
    withHistory([activity({ id: 'a' })])

    expect(queryActivities({ offset: 50 })).toEqual({ items: [], total: 1, nextOffset: null })
  })

  it('leaves the repository list untouched while sorting', () => {
    const history = [activity({ id: 'a', distanceKm: 20 }), activity({ id: 'b', distanceKm: 5 })]
    withHistory(history)

    queryActivities({ sortBy: 'distance', sortOrder: 'asc' })
    expect(ids(history)).toEqual(['a', 'b'])
  })
})
