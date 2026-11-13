import { describe, expect, it } from 'vitest'
import { routeStartState, startLineOf, startTitleOf } from '../routeStart'

const HOME: [number, number] = [7.75, 48.62]

describe('the start', () => {
  it('asks for a tap, then names the street and the distance from home', () => {
    const waiting = routeStartState(null)
    expect(startTitleOf(waiting, null)).toBe('Choose a start')
    expect(startLineOf(waiting, HOME)).toBeNull()

    const tapped = routeStartState([7.75, 48.629])
    expect(startTitleOf(tapped, 'Rue de la Paix')).toBe('Run from Rue de la Paix')
    expect(startTitleOf(tapped, null)).toBe('Run from the map point')
    expect(startLineOf(tapped, HOME)).toBe('1.0 km from home · tap the map to move the start')
    expect(startLineOf(tapped, null)).toBe('Tap the map to move the start')
  })
})
