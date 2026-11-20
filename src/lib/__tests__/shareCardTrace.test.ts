import { describe, expect, it } from 'vitest'
import { shareTrace, STRIDE_TAG, TRACE_POINTS } from '@/lib/shareCardTrace'
import type { ShareActivity } from '@/lib/shareCardStats'

const ZONES: ShareActivity['hrZones'] = [
  { zone: 1, seconds: 600, percent: 20, minBpm: 119, maxBpm: null },
  { zone: 2, seconds: 2100, percent: 70, minBpm: 146, maxBpm: null },
  { zone: 3, seconds: 300, percent: 10, minBpm: 163, maxBpm: null },
  { zone: 4, seconds: 0, percent: 0, minBpm: 174, maxBpm: null },
  { zone: 5, seconds: 0, percent: 0, minBpm: 183, maxBpm: null },
]

const RUN: ShareActivity = {
  id: '1',
  date: '2026-11-13',
  dayOfWeek: 'Friday',
  description: 'Easy run + 6 strides',
  distanceKm: 7.5,
  durationSeconds: 2538,
  paceSecPerKm: 340,
  avgHeartRate: 146,
  elevationGain: 20,
  route: null,
  hrZones: ZONES,
}

const easyHr = Array.from({ length: 150 }, (_, i) => (i >= 130 && i % 3 === 0 ? 166 : 140 + (i % 5)))

describe('shareTrace', () => {
  it('is null without samples', () => {
    expect(shareTrace(RUN)).toBeNull()
  })

  it('is null with too few samples to draw', () => {
    expect(shareTrace({ ...RUN, hrSamples: [140, 141, 142] })).toBeNull()
  })

  it('draws an easy run by heart rate, its points across the width and inside the plot', () => {
    const trace = shareTrace({ ...RUN, hrSamples: easyHr, paceSamples: easyHr.map(() => 340) })!
    expect(trace.kind).toBe('hr')
    expect(trace.avgHr).toBe(146)
    expect(trace.points.length).toBeLessThanOrEqual(TRACE_POINTS)
    expect(trace.points[0]!.x).toBe(0)
    expect(trace.points.at(-1)!.x).toBe(1)
    expect(trace.points.every((p) => p.y >= 0 && p.y <= 1)).toBe(true)
  })

  it('tags a stride by the zone its peak reached, though the zones carry no ceiling', () => {
    const tags = shareTrace({ ...RUN, hrSamples: easyHr })!.points.map((p) => p.tag)
    expect(tags.slice(0, 60).every((tag) => tag === 2)).toBe(true)
    expect(tags.slice(-10)).toContain(3)
  })

  it('marks the strides from their windows, at their peak', () => {
    const strides = { count: 6, windows: [[130 / 150, 1]] as [number, number][] }
    const plain = shareTrace({ ...RUN, hrSamples: easyHr, paceSamples: easyHr.map(() => 340) })!
    const marked = shareTrace({ ...RUN, hrSamples: easyHr, paceSamples: easyHr.map(() => 340), strides })!
    expect(marked.points.slice(0, 60).some((p) => p.tag === STRIDE_TAG)).toBe(false)
    expect(marked.points.slice(-10).every((p) => p.tag === STRIDE_TAG)).toBe(true)
    const meanY = (points: { y: number }[]) => points.reduce((a, p) => a + p.y, 0) / points.length
    expect(meanY(marked.points.slice(-10))).toBeLessThan(meanY(plain.points.slice(-10)))
  })

  it('shades nothing on a run without reps', () => {
    expect(shareTrace({ ...RUN, hrSamples: easyHr })!.shade).toEqual([])
  })

  it('draws Z1 as Z2, the zone bar joining them', () => {
    const trace = shareTrace({ ...RUN, hrSamples: Array.from({ length: 60 }, () => 125) })!
    expect(new Set(trace.points.map((p) => p.tag))).toEqual(new Set([2]))
  })

  it('falls back to pace without heart rate', () => {
    const trace = shareTrace({ ...RUN, paceSamples: Array.from({ length: 60 }, (_, i) => 330 + (i % 7)) })!
    expect(trace.kind).toBe('pace')
    expect(trace.band).toBeNull()
    expect(trace.points.every((p) => p.tag === 0)).toBe(true)
  })

  describe('an interval session', () => {
    const paces = Array.from({ length: 150 }, (_, i) => (i >= 50 && i < 100 ? 270 : 360))
    const session: ShareActivity = {
      ...RUN,
      type: 'Threshold',
      hrSamples: easyHr,
      paceSamples: paces,
      reps: { count: 1, repSeconds: 900, paceSecPerKm: 270, paces: [270], target: { min: 272, max: 280 }, windows: [[0.4, 0.6]] },
    }

    it('draws pace over heart rate, faster higher up', () => {
      const trace = shareTrace(session)!
      expect(trace.kind).toBe('pace')
      const rep = trace.points.find((p) => p.tag === 1)!
      const easy = trace.points.find((p) => p.tag === 0)!
      expect(rep.y).toBeLessThan(easy.y)
    })

    it('marks the points inside its rep windows', () => {
      const trace = shareTrace(session)!
      const inRep = trace.points.filter((p) => p.tag === 1)
      expect(inRep.length).toBeGreaterThan(0)
      expect(inRep.every((p) => p.x > 0.25 && p.x < 0.75)).toBe(true)
    })

    it('sets the target band on the same scale, the faster bound higher', () => {
      const [fast, slow] = shareTrace(session)!.band!
      expect(fast).toBeLessThan(slow)
      expect(fast).toBeGreaterThan(0)
    })

    it('draws its heart rate when the reps are hidden', () => {
      expect(shareTrace({ ...session, reps: null })!.kind).toBe('hr')
    })

    it('shades the hidden reps on the heart rate, where they ran', () => {
      const trace = shareTrace({ ...session, reps: null, repWindows: session.reps!.windows })!
      expect(trace.shade).toHaveLength(1)
      const [from, to] = trace.shade[0]!
      expect(from).toBeGreaterThan(0.25)
      expect(to).toBeLessThan(0.75)
      expect(to).toBeGreaterThan(from)
    })

    it('shades nothing on its pace trace, the reps already in their colour', () => {
      expect(shareTrace(session)!.shade).toEqual([])
    })

    it('leaves strides unmarked when the reps are shown', () => {
      const trace = shareTrace({ ...session, paceSamples: null, strides: { count: 2, windows: [[0.9, 1]] } })!
      expect(trace.points.some((p) => p.tag === STRIDE_TAG)).toBe(false)
    })
  })
})
