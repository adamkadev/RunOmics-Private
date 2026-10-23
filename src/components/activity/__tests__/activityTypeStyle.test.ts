import { describe, it, expect } from 'vitest'
import { ACTIVITY_TYPES } from '@/domain/activity/types'
import { sessionZone, zoneColor } from '@/lib/colors'
import { ACTIVITY_TYPE_STYLE, activityTypeStyle } from '../activityTypeStyle'

describe('ACTIVITY_TYPE_STYLE', () => {
  it('styles every activity type once, in ACTIVITY_TYPES order', () => {
    expect(Object.keys(ACTIVITY_TYPE_STYLE)).toEqual([...ACTIVITY_TYPES])
  })

  it("colours each type with its session zone's token, and gives it an icon", () => {
    for (const type of ACTIVITY_TYPES) {
      expect(ACTIVITY_TYPE_STYLE[type].chartColor, type).toBe(zoneColor(sessionZone({ type })))
      expect(ACTIVITY_TYPE_STYLE[type].icon, type).toBeTruthy()
    }
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
