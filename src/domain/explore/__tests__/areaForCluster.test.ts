import { describe, expect, it } from 'vitest'
import { areaForCluster, areaForPoint } from '../areaForCluster'
import type { ExploreAreaRef } from '../types'

// Fictional areas around the demo dataset's mid-Pacific home, never a real place.
const wide: ExploreAreaRef = { id: 'wide', name: 'Wide', version: 'wide-20261022-aaaaaaaa', bbox: [-150.2, -0.2, -149.8, 0.2] }
const town: ExploreAreaRef = { id: 'town', name: 'Town', version: 'town-20261022-bbbbbbbb', bbox: [-150.05, -0.05, -149.95, 0.05] }
const away: ExploreAreaRef = { id: 'away', name: 'Away', version: 'away-20261022-cccccccc', bbox: [-149.1, 2.9, -148.9, 3.1] }

describe('areaForPoint', () => {
  it('finds the area whose box holds the point', () => {
    expect(areaForPoint([wide, away], [-149, 3])).toBe(away)
  })

  it('prefers the smallest box when boxes overlap, whatever the index order', () => {
    expect(areaForPoint([wide, town], [-150, 0])).toBe(town)
    expect(areaForPoint([town, wide], [-150, 0])).toBe(town)
  })

  it('still finds the wide area outside the small one', () => {
    expect(areaForPoint([wide, town], [-150.15, 0.15])).toBe(wide)
  })

  it('counts a point on the edge as inside', () => {
    expect(areaForPoint([town], [-150.05, 0.05])).toBe(town)
  })

  it('answers null outside every area, and for an empty index', () => {
    expect(areaForPoint([wide, town, away], [10, 10])).toBeNull()
    expect(areaForPoint([], [-150, 0])).toBeNull()
  })
})

describe('areaForCluster', () => {
  it('goes by the label point first', () => {
    expect(areaForCluster([town, away], { labelPoint: [-149, 3], center: [-150, 0] })).toBe(away)
  })

  it('falls back to the centre when the label point is in no area', () => {
    expect(areaForCluster([town, away], { labelPoint: [10, 10], center: [-150, 0] })).toBe(town)
  })

  it('answers null when neither point is in an area', () => {
    expect(areaForCluster([town], { labelPoint: [10, 10], center: [11, 11] })).toBeNull()
  })
})
