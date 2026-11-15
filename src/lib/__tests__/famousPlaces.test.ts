import { describe, expect, it } from 'vitest'
import { famousLimit, isStadiumName, metresFromRoute, pickFamousPlaces, type FamousPlace } from '@/lib/famousPlaces'

const route: [number, number][] = [[6.15, 49.11], [6.17, 49.11]]
const north = (m: number) => 49.11 + m / 111_320

describe('famous places', () => {
  it('keeps those within 300 m, a cathedral before a station before a stadium, two at most', () => {
    const places: FamousPlace[] = [
      { name: 'Stade A', kind: 'stadium', at: [6.155, north(50)] },
      { name: 'Gare', kind: 'station', at: [6.16, north(250)] },
      { name: 'Cathédrale', kind: 'cathedral', at: [6.165, north(280)] },
      { name: 'Far Cathedral', kind: 'cathedral', at: [6.16, north(400)] },
    ]

    expect(pickFamousPlaces(places, route, 2).map((p) => p.name)).toEqual(['Cathédrale', 'Gare'])
  })

  it('keeps a name twice in the tiles at its nearer entry', () => {
    const places: FamousPlace[] = [
      { name: 'Gare', kind: 'station', at: [6.16, north(900)] },
      { name: 'Gare', kind: 'station', at: [6.16, north(100)] },
    ]

    expect(pickFamousPlaces(places, route, 2)).toEqual([places[1]])
  })

  it('measures to the nearest stretch of the route, not its nearest point', () => {
    expect(metresFromRoute([6.16, north(100)], route)).toBeCloseTo(100, 0)
  })

  it('names a stadium by its name, never a city court', () => {
    expect(isStadiumName('Stade de France')).toBe(true)
    expect(isStadiumName('Wembley Stadium')).toBe(true)
    expect(isStadiumName('City-stade')).toBe(false)
    expect(isStadiumName('Stade municipal')).toBe(false)
    expect(isStadiumName('Stade annexe de la Plaine')).toBe(false)
    expect(isStadiumName('Gymnase Jean Moulin')).toBe(false)
  })

  it('allows a third on a route over 8 km across', () => {
    expect(famousLimit(route)).toBe(2)
    expect(famousLimit([[6.1, 49.11], [6.25, 49.11]])).toBe(3)
  })
})
