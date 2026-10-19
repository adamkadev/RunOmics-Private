import { describe, expect, it } from 'vitest'
import { t } from '@/i18n'
import {
  ALL_RUNS,
  checkedTypes,
  countByType,
  filterTypes,
  matchingCount,
  normalizeTypes,
  parseFilter,
  parseSort,
  sortQuery,
  typesLabel,
} from '../activityFilter'

describe('the activities filter in the URL', () => {
  it('reads a group, or the picked types over it', () => {
    expect(parseFilter(null, null)).toEqual(ALL_RUNS)
    expect(parseFilter('workouts', null)).toEqual({ group: 'workouts', types: [] })
    expect(parseFilter('easy', 'Threshold,VO2Max')).toEqual({ group: 'all', types: ['Threshold', 'VO2Max'] })
  })

  it('drops what it does not know', () => {
    expect(parseFilter('long', null)).toEqual(ALL_RUNS)
    expect(parseFilter(null, 'Recovery,Tempo')).toEqual({ group: 'all', types: ['Tempo'] })
    expect(parseSort('slowest')).toBe('newest')
    expect(parseSort('fastest')).toBe('fastest')
  })
})

describe('the sheet ticks as a filter', () => {
  it('is every run with nothing ticked', () => {
    expect(normalizeTypes([])).toEqual(ALL_RUNS)
  })

  it("is a group's chip when they are exactly its types", () => {
    expect(normalizeTypes(['Base'])).toEqual({ group: 'easy', types: [] })
    expect(normalizeTypes(['Sprint', 'Tempo', 'VO2Max', 'Anaerobic', 'Threshold'])).toEqual({ group: 'workouts', types: [] })
    expect(normalizeTypes(['Race'])).toEqual({ group: 'races', types: [] })
  })

  it("is the types themselves otherwise, in the sheet's order", () => {
    expect(normalizeTypes(['VO2Max', 'Threshold'])).toEqual({ group: 'all', types: ['Threshold', 'VO2Max'] })
    expect(normalizeTypes(['Race', 'Base'])).toEqual({ group: 'all', types: ['Base', 'Race'] })
  })

  it('opens the sheet on a group chip with its types ticked', () => {
    expect(checkedTypes({ group: 'workouts', types: [] })).toEqual(['Tempo', 'Threshold', 'VO2Max', 'Anaerobic', 'Sprint'])
    expect(checkedTypes(ALL_RUNS)).toEqual([])
    expect(filterTypes(ALL_RUNS)).toBeNull()
  })
})

describe('the sheet counts', () => {
  const counts = countByType([{ type: 'Base' }, { type: 'Base' }, { type: 'Threshold' }, { type: 'HillRepeats' as never }])

  it('counts each type, and every run with nothing ticked', () => {
    expect(counts.get('Base')).toBe(2)
    expect(matchingCount(counts, ['Base', 'Threshold', 'Tempo'])).toBe(3)
    expect(matchingCount(counts, [])).toBe(4)
  })
})

describe('the sort', () => {
  it('asks the query for newest, longest and fastest first', () => {
    expect(sortQuery('newest')).toEqual({ sortBy: 'date', sortOrder: 'desc' })
    expect(sortQuery('longest')).toEqual({ sortBy: 'distance', sortOrder: 'desc' })
    expect(sortQuery('fastest')).toEqual({ sortBy: 'pace', sortOrder: 'asc' })
  })
})

it('names picked types as one chip', () => {
  expect(typesLabel(['Threshold', 'VO2Max'])).toBe(`${t.activityTypes.Threshold}, ${t.activityTypes.VO2Max}`)
})
