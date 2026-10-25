import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import type { FitnessAgeSample } from '@/infrastructure/repositories/JsonFitnessAgeRepository'

const store = vi.hoisted(() => ({ athlete: {} as AthleteProfile, samples: [] as FitnessAgeSample[] }))

vi.mock('@/infrastructure/repositories/JsonAthleteRepository', () => ({ getAthleteProfile: () => store.athlete }))
vi.mock('@/infrastructure/repositories/JsonFitnessAgeRepository', () => ({ getFitnessAgeSamples: () => store.samples }))

import { getFitnessAge } from '../GetFitnessAge'

const TODAY = '2026-10-25'

describe('getFitnessAge', () => {
  beforeEach(() => {
    store.athlete = {}
    store.samples = []
  })

  it('is absent on a watch without fitness age', () => {
    store.athlete = { age: 22 }
    expect(getFitnessAge(TODAY)).toBeNull()
  })

  it('keeps the last reading of each week over the last year', () => {
    store.athlete = { fitnessAgeYrs: 18.2, age: 29 }
    store.samples = [
      { date: '2025-10-20', years: 30 },
      { date: '2026-10-05', years: 19.1 },
      { date: '2026-10-07', years: 18.9 },
      { date: '2026-10-12', years: 18.6 },
      { date: '2026-10-19', years: 18.2 },
      { date: '2026-10-26', years: 18.0 },
    ]
    expect(getFitnessAge(TODAY)).toEqual({
      now: 18.2,
      age: 29,
      achievable: null,
      trend: [
        { date: '2026-10-07', years: 18.9 },
        { date: '2026-10-12', years: 18.6 },
        { date: '2026-10-19', years: 18.2 },
      ],
    })
  })

  it('offers the achievable age only while it is younger than the current one', () => {
    store.athlete = { fitnessAgeYrs: 21.6, achievableFitnessAgeYrs: 18 }
    expect(getFitnessAge(TODAY)?.achievable).toBe(18)
    store.athlete = { fitnessAgeYrs: 18.2, achievableFitnessAgeYrs: 21.1 }
    expect(getFitnessAge(TODAY)?.achievable).toBeNull()
  })
})
