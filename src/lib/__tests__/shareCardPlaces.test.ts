import { describe, expect, it } from 'vitest'
import {
  areaLimit, evidentArea, firstName, geocodeLevel, passedAreas, pointsInside, sameArea, shortGreenName, tilePlaceLevel, type TilePlace,
} from '@/lib/shareCardPlaces'

const M = 10
const start: [number, number] = [100, 100]
const place = (name: string, level: TilePlace['level'], x: number, y: number): TilePlace => ({ name, level, at: [x, y] })

describe('the start area', () => {
  it('is the quarter the start is in, not the town', () => {
    const places = [place('Grandville', 'city', 102, 102), place('Le Faubourg', 'mid', 110, 95), place('Les Prés', 'fine', 104, 96)]
    expect(evidentArea(start, places, [], M)).toEqual({ name: 'Les Prés', level: 'fine', at: [104, 96] })
  })

  it('goes up to the district when the quarter\'s name is over 300 m from the start', () => {
    const places = [place('Les Prés', 'fine', 140, 100), place('Le Faubourg', 'mid', 120, 100), place('Grandville', 'city', 101, 101)]
    expect(evidentArea(start, places, [], M)?.name).toBe('Le Faubourg')
  })

  it('takes the geocoder\'s quarter when the tiles name none near, but never a nearby place it is not in', () => {
    expect(evidentArea(start, [], [{ name: 'Quartier des Lilas', level: 'fine', contains: true }, { name: 'Grandville', level: 'city', contains: true }], M)?.name)
      .toBe('Quartier des Lilas')
    expect(evidentArea(start, [], [{ name: 'Le Rond-Point', level: 'fine', contains: false, at: [180, 100] }, { name: 'Grandville', level: 'city', contains: true }], M)?.name)
      .toBe('Grandville')
    expect(evidentArea(start, [], [], M)).toBeNull()
  })

  it('reads the tiles\' and the geocoder\'s place kinds as quarter, district or town', () => {
    expect([tilePlaceLevel('place_label', 'neighbourhood'), tilePlaceLevel('place_label', 'suburb'), tilePlaceLevel('town_label', undefined), tilePlaceLevel('place_label', 'isolated_dwelling')])
      .toEqual(['fine', 'mid', 'city', null])
    expect([geocodeLevel('locality'), geocodeLevel('place'), geocodeLevel('municipal_district'), geocodeLevel('municipality'), geocodeLevel('region')])
      .toEqual([{ level: 'fine', contains: true }, { level: 'fine', contains: false }, { level: 'mid', contains: true }, { level: 'city', contains: true }, null])
  })

  it('treats a quarter named with and without "Quartier" as one place, but not a reserve named after it', () => {
    expect(sameArea('Quartier du Gros-Caillou', 'Gros-Caillou')).toBe(true)
    expect(sameArea('Les Prés', 'Le Moulin')).toBe(false)
    expect(sameArea('Réserve naturelle du bois des Prés', 'Les Prés')).toBe(false)
  })
})

describe('the areas the route passes', () => {
  const route: [number, number][] = Array.from({ length: 41 }, (_, i) => [i * 10, 100])

  it('ranks by the stretch of route nearest each name, quarters before the town', () => {
    const places = [place('Est', 'fine', 360, 160), place('Ouest', 'mid', 60, 160), place('Grandville', 'city', 200, 100)]
    expect(passedAreas(route, places, M, { limit: 4 }).map((a) => a.name)).toEqual(['Ouest', 'Est'])
  })

  it('names the town only when no quarter or district is passed', () => {
    expect(passedAreas(route, [place('Grandville', 'city', 200, 110)], M, { limit: 2 }).map((a) => a.name)).toEqual(['Grandville'])
  })

  it('leaves out named places and keeps the rest apart', () => {
    const places = [place('Est', 'fine', 320, 105), place('Est-Bis', 'fine', 330, 105), place('Ouest', 'fine', 40, 105)]
    expect(passedAreas(route, places, M, { limit: 4, exclude: ['Ouest'], spacingPx: 60 }).map((a) => a.name)).toEqual(['Est'])
  })

  it('names up to four on a route over 8 km across, two on a smaller one', () => {
    expect(areaLimit([[0, 0], [900, 0]], M)).toBe(4)
    expect(areaLimit([[0, 0], [400, 0]], M)).toBe(2)
  })
})

describe('naming the landmark', () => {
  it('cuts a reserve\'s long legal name to the place it names, to fit two lines', () => {
    expect(shortGreenName('Réserve naturelle nationale du massif forestier des Prés et de la Combe')).toBe('Massif forestier des Prés')
    expect(shortGreenName('Parc naturel régional des Monts Bleus')).toBe('Monts Bleus')
    expect(shortGreenName('Bois des Hêtres')).toBe('Bois des Hêtres')
  })

  it('asks each source in turn until one names it', async () => {
    const asked: string[] = []
    const source = (name: string, answer: string | null) => async () => { asked.push(name); return answer }
    expect(await firstName([source('centre', null), source('inside', null), source('landform', 'Forêt des Hêtres'), source('tiles', 'never')])).toBe('Forêt des Hêtres')
    expect(asked).toEqual(['centre', 'inside', 'landform'])
  })

  it('asks at the route\'s point inside the green nearest its centre, then at others along the route', () => {
    const ring: [number, number][] = [[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]
    const route: [number, number][] = [[-50, 50], [10, 50], [40, 50], [70, 50], [90, 50], [150, 50]]
    const points = pointsInside({ at: [50, 50], rings: [ring] }, route)
    expect(points[0]).toEqual([40, 50])
    expect(points.length).toBeGreaterThan(1)
    expect(points.every(([x]) => x > 0 && x < 100)).toBe(true)
  })
})
