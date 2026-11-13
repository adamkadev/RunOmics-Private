import { describe, expect, it } from 'vitest'
import { routeStartState, startLineOf } from '../routeStart'

const HOME: [number, number] = [7.75, 48.62]

describe('startLineOf', () => {
  it('names the district and its distance from home in District mode', () => {
    expect(startLineOf(routeStartState('quartier', null), { name: 'Hoenheim', distanceKm: 0.9 }, null, HOME)).toBe('Start: Hoenheim · 0.9 km from home')
    expect(startLineOf(routeStartState('quartier', null), { name: 'Hoenheim', distanceKm: null }, null, HOME)).toBe('Start: Hoenheim')
    expect(startLineOf(routeStartState('quartier', null), null, null, HOME)).toBeNull()
  })

  it('says nothing until a point is tapped, then names its street, else the mode', () => {
    expect(startLineOf(routeStartState('pick', null), { name: 'Hoenheim' }, null, HOME)).toBeNull()
    const tapped = routeStartState('pick', [7.75, 48.629])
    expect(startLineOf(tapped, null, 'Rue de la Paix', HOME)).toBe('Start: Rue de la Paix · 1.0 km from home')
    expect(startLineOf(tapped, null, null, null)).toBe('Start: Map point')
  })
})
