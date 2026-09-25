import { describe, it, expect } from 'vitest'
import { ACTIVITY_TYPES } from '@/domain/activity/types'
import { ACTIVITY_TYPE_STYLE, activityTypeStyle } from '../activityTypeStyle'

describe('ACTIVITY_TYPE_STYLE', () => {
  it('styles every activity type once, in ACTIVITY_TYPES order', () => {
    expect(Object.keys(ACTIVITY_TYPE_STYLE)).toEqual([...ACTIVITY_TYPES])
  })

  it('gives each type a distinct hex chart colour and an icon', () => {
    const colors = ACTIVITY_TYPES.map((type) => ACTIVITY_TYPE_STYLE[type].chartColor)
    for (const color of colors) expect(color).toMatch(/^#[0-9a-f]{6}$/i)
    expect(new Set(colors).size).toBe(ACTIVITY_TYPES.length)
    for (const type of ACTIVITY_TYPES) expect(ACTIVITY_TYPE_STYLE[type].icon, type).toBeTruthy()
  })
})

describe('activityTypeStyle', () => {
  it("returns a known type's own style", () => {
    for (const type of ACTIVITY_TYPES) expect(activityTypeStyle(type)).toBe(ACTIVITY_TYPE_STYLE[type])
  })

  // Activity JSON is cast, not parsed: a type the Python classifier adds
  // before this app knows it must draw, not throw.
  it('draws a type it does not know as Base', () => {
    for (const value of ['HillRepeats', '', null, undefined]) {
      expect(activityTypeStyle(value), String(value)).toBe(ACTIVITY_TYPE_STYLE.Base)
    }
  })
})
