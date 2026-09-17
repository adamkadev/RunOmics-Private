import { describe, expect, it } from 'vitest'
import { cleanStream, paddedDomain } from '../cleanStream'

const flat = (count: number, value: number) => Array.from({ length: count }, () => value)

describe('cleanStream', () => {
  it('drops the leading stretch while GPS settles', () => {
    const samples = [...flat(10, 900), ...flat(90, 300)]
    const cleaned = cleanStream(samples, { settleKm: 0.1, distanceKm: 1 })

    expect(cleaned.slice(0, 10).every((v) => v === null)).toBe(true)
    expect(cleaned[10]).toBe(300)
  })

  it('drops readings outside the bounds a runner can produce', () => {
    const cleaned = cleanStream([...flat(20, 170), 0], { min: 60, max: 250 })

    expect(cleaned[20]).toBeNull()
  })

  it('draws through a one-sample dropout instead of breaking the line', () => {
    const samples = [...flat(20, 170), 0, ...flat(20, 174)]
    const cleaned = cleanStream(samples, { min: 60, max: 250, spikeFloor: 25 })

    expect(cleaned[20]).toBe(172)
  })

  it('leaves a real stop as a gap', () => {
    const samples = [...flat(20, 170), ...flat(6, 0), ...flat(20, 170)]
    const cleaned = cleanStream(samples, { min: 60, max: 250, spikeFloor: 25 })

    expect(cleaned.slice(20, 26).every((v) => v === null)).toBe(true)
  })

  it('keeps a sustained excursion, which is a stride and not an artifact', () => {
    const samples = [...flat(40, 168), ...flat(8, 190), ...flat(40, 168)]
    const cleaned = cleanStream(samples, { min: 60, max: 250, spikeFloor: 25 })

    expect(cleaned.filter((v) => v === 190)).toHaveLength(8)
  })
})

describe('paddedDomain', () => {
  it('widens a flat series so its wobble is not drawn as a mountain range', () => {
    expect(paddedDomain([135, 137, 140], 20)).toEqual([127.5, 147.5])
  })

  it('leaves a series that already spans the minimum alone', () => {
    expect(paddedDomain([120, 190], 20)).toEqual([120, 190])
  })

  it('has no domain without values', () => {
    expect(paddedDomain([null, null], 20)).toBeNull()
  })
})
