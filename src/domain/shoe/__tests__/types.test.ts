import { describe, it, expect } from 'vitest'
import { buildShoeRegistry, type ShoeRecord } from '../types'

const record = (gearId: string, maxKm = 800): ShoeRecord => ({
  gearId,
  brand: 'Nike',
  model: `Model ${gearId}`,
  maxKm,
  retired: false,
  firstUseDate: null,
})

describe('buildShoeRegistry', () => {
  it('keys each pair by gear id and takes its model as the display name', () => {
    const registry = buildShoeRegistry([record('a'), record('b')])

    expect(Object.keys(registry)).toEqual(['a', 'b'])
    expect(registry.a?.name).toBe('Model a')
  })

  it('alerts at 80% of the pair own limit', () => {
    expect(buildShoeRegistry([record('a', 750)]).a?.alertThresholdKm).toBe(600)
  })

  // The ramp used to be eight hues, three of which (amber, violet, pink) read as
  // status on a dot that only ever carried pair identity. It is now four neutral
  // steps - four because the registry holds four pairs - so the cycle is shorter
  // and the assertion moved with it.
  it('gives consecutive pairs distinct dots, cycling once the ramp runs out', () => {
    const registry = buildShoeRegistry(Array.from({ length: 5 }, (_, i) => record(`s${i}`)))
    const dots = Object.values(registry).map((info) => info.dotColor)

    expect(new Set(dots.slice(0, 4)).size).toBe(4)
    expect(dots[4]).toBe(dots[0])
  })

  it('keeps the dots neutral, so identity never borrows a status hue', () => {
    const registry = buildShoeRegistry(Array.from({ length: 4 }, (_, i) => record(`s${i}`)))

    for (const info of Object.values(registry)) {
      expect(info.dotColor).toMatch(/^var\(--/)
    }
  })
})
