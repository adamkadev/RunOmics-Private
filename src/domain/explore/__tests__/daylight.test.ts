import { describe, expect, it } from 'vitest'
import { runDarkness, sunTimes } from '../daylight'

const METZ = { lat: 49.12, lon: 6.18 }
const at = (iso: string) => Date.parse(iso)

describe('sunTimes', () => {
  it('matches NOAA within two minutes', () => {
    const paris = sunTimes('2026-12-21', 48.8566, 2.3522) as { sunrise: number; sunset: number }
    const metz = sunTimes('2026-10-25', METZ.lat, METZ.lon) as { sunrise: number; sunset: number }

    expect(Math.abs(paris.sunset - at('2026-12-21T15:56:00Z'))).toBeLessThan(120_000)
    expect(Math.abs(metz.sunset - at('2026-10-25T16:27:00Z'))).toBeLessThan(120_000)
  })

  it('says when the sun never sets or never rises', () => {
    expect(sunTimes('2026-06-21', 78, 15)).toEqual({ polar: 'day' })
    expect(sunTimes('2026-12-21', 78, 15)).toEqual({ polar: 'night' })
  })
})

describe('runDarkness', () => {
  const run = (nowIso: string, minutes: number) => runDarkness({ date: '2026-10-25', ...METZ, now: at(nowIso), durationS: minutes * 60 })

  it('flags a run that ends past sunset less 15 minutes', () => {
    expect(run('2026-10-25T15:48:00Z', 85)).toEqual({ kind: 'dusk', at: expect.any(Number) })
    expect(run('2026-10-25T13:36:00Z', 85)).toBeNull()
    expect(run('2026-10-25T15:00:00Z', 15)).toBeNull()
  })

  it('flags a run that starts before sunrise', () => {
    expect(run('2026-10-25T05:30:00Z', 50)?.kind).toBe('dawn')
  })
})
