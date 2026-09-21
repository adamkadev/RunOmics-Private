import { describe, expect, it } from 'vitest'
import { formFade } from '../formFade'

const flat = (count: number, spm: number) => Array.from({ length: count }, () => spm)

describe('formFade', () => {
  it('reports no fade when cadence holds to the finish', () => {
    expect(formFade(flat(100, 170), 10)).toEqual({ fadedFromKm: null, referenceSpm: 170 })
  })

  it('finds where cadence dropped away and stayed down', () => {
    const samples = [...flat(70, 170), ...flat(30, 158)]

    expect(formFade(samples, 10)?.fadedFromKm).toBeCloseTo(7.1, 1)
  })

  it('ignores a dip that recovers before the finish', () => {
    const samples = [...flat(60, 170), ...flat(10, 150), ...flat(30, 170)]

    expect(formFade(samples, 10)?.fadedFromKm).toBeNull()
  })

  it('leaves walked and stopped samples out of the reference', () => {
    const samples = [...flat(10, 0), ...flat(90, 170)]

    expect(formFade(samples, 10)?.referenceSpm).toBe(170)
  })

  it('has nothing to say without enough cadence to read', () => {
    expect(formFade(null, 10)).toBeNull()
    expect(formFade(flat(10, 170), 10)).toBeNull()
    expect(formFade(flat(100, 170), 0)).toBeNull()
  })
})
