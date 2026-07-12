import { describe, expect, it } from 'vitest'
import { parseWorkoutStructure } from '../workoutStructure'

describe('parseWorkoutStructure', () => {
  it('parses "2 × 10\' tempo" into warmup + 2 efforts with a default recovery + cooldown', () => {
    const steps = parseWorkoutStructure('2 × 10\' tempo', 59 * 60)
    expect(steps).not.toBeNull()
    const kinds = steps!.map((s) => s.kind)
    expect(kinds).toEqual(['warmup', 'effort', 'recovery', 'effort', 'cooldown'])
    expect(steps![1]!.minutes).toBe(10)
    expect(steps![2]!.minutes).toBe(2)
    // Bookends absorb the rest of the 59 min budget
    const total = steps!.reduce((s, step) => s + step.minutes, 0)
    expect(total).toBe(59)
  })

  it('parses "10 x (1\'/1\')" with explicit recoveries', () => {
    const steps = parseWorkoutStructure("10 x (1'/1')")
    expect(steps).not.toBeNull()
    expect(steps!.filter((s) => s.kind === 'effort')).toHaveLength(10)
    expect(steps!.filter((s) => s.kind === 'recovery')).toHaveLength(9)
    expect(steps![0]!.kind).toBe('warmup')
    expect(steps![steps!.length - 1]!.kind).toBe('cooldown')
  })

  it('parses "50\' dont 20\' actives" as a continuous block', () => {
    const steps = parseWorkoutStructure("50' dont 20' actives")
    expect(steps).not.toBeNull()
    expect(steps!.map((s) => s.kind)).toEqual(['warmup', 'effort', 'cooldown'])
    expect(steps![1]!.minutes).toBe(20)
    expect(steps!.reduce((s, step) => s + step.minutes, 0)).toBe(50)
  })

  it('refuses meter-based intervals rather than guessing a pace', () => {
    expect(parseWorkoutStructure('6 × 600m (R=200m)')).toBeNull()
    expect(parseWorkoutStructure('3000m / 2000m / 1000m')).toBeNull()
  })

  it('returns null for plain endurance names', () => {
    expect(parseWorkoutStructure('40 min footing')).toBeNull()
    expect(parseWorkoutStructure('1 h endurance')).toBeNull()
  })
})
