import { describe, it, expect } from 'vitest'
import { collapseUnusedZones, zoneRangeLabel } from '../zoneRows'

const entry = (zone: number, used: boolean) => ({ zone, used, data: `z${zone}` })

describe('collapseUnusedZones', () => {
  it('folds a contiguous run of empty zones into one item', () => {
    const items = collapseUnusedZones([
      entry(5, false),
      entry(4, false),
      entry(3, false),
      entry(2, true),
      entry(1, true),
    ])

    expect(items).toEqual([
      { kind: 'unused', zones: [5, 4, 3] },
      { kind: 'zone', zone: 2, data: 'z2' },
      { kind: 'zone', zone: 1, data: 'z1' },
    ])
  })

  it('keeps separate runs separate, so a gap is not claimed as one range', () => {
    const items = collapseUnusedZones([
      entry(5, false),
      entry(4, true),
      entry(3, false),
      entry(2, false),
      entry(1, true),
    ])

    expect(items.map((i) => i.kind)).toEqual(['unused', 'zone', 'unused', 'zone'])
    expect(items[2]).toEqual({ kind: 'unused', zones: [3, 2] })
  })

  it('leaves a fully used list untouched', () => {
    const items = collapseUnusedZones([entry(2, true), entry(1, true)])
    expect(items.every((i) => i.kind === 'zone')).toBe(true)
  })

  it('keeps every row when nothing was used at all, because then the list is the reference', () => {
    const items = collapseUnusedZones([entry(2, false), entry(1, false)])

    expect(items).toEqual([
      { kind: 'zone', zone: 2, data: 'z2' },
      { kind: 'zone', zone: 1, data: 'z1' },
    ])
  })
})

describe('zoneRangeLabel', () => {
  it('names a run by its ends, lowest first, however the list was ordered', () => {
    expect(zoneRangeLabel([5, 4, 3])).toBe('Z3–Z5')
    expect(zoneRangeLabel([3, 4, 5])).toBe('Z3–Z5')
  })

  it('names a single zone without a range', () => {
    expect(zoneRangeLabel([4])).toBe('Z4')
  })

  it('has no name for an empty run', () => {
    expect(zoneRangeLabel([])).toBe('')
  })
})
