import { describe, expect, it } from 'vitest'
import { zoneTextClass } from '@/components/activity/ZoneBar'
import type { HrZone } from '@/domain/activity/types'

const zones: HrZone[] = [
  { zone: 1, seconds: 0, percent: 0, minBpm: 0, maxBpm: 120 },
  { zone: 2, seconds: 0, percent: 56, minBpm: 121, maxBpm: 160 },
  { zone: 3, seconds: 0, percent: 0, minBpm: 161, maxBpm: 172 },
  { zone: 4, seconds: 0, percent: 0, minBpm: 173, maxBpm: 182 },
  { zone: 5, seconds: 0, percent: 0, minBpm: 183, maxBpm: null },
]

describe('zoneTextClass', () => {
  // The header used to paint every number zone-5 red.
  it('colours an average by the zone it actually falls in', () => {
    expect(zoneTextClass(157, zones)).toBe('text-[var(--zone-2)]')
  })

  it('still reaches zone 5 when the value belongs there', () => {
    expect(zoneTextClass(190, zones)).toBe('text-[var(--zone-5)]')
  })

  it('treats the open-ended top zone as unbounded', () => {
    expect(zoneTextClass(240, zones)).toBe('text-[var(--zone-5)]')
  })

  it('falls back to plain ink rather than inventing a zone', () => {
    expect(zoneTextClass(157, [])).toBe('text-foreground')
  })
})
