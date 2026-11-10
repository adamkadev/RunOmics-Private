import { describe, it, expect } from 'vitest'
import { buildReplayScene, formatClock, REPLAY_CUES, replaySeconds } from '../homeRunsDraw'
import { encodeIntegers, encodePolyline } from '../polyline'

const labels = { title: '', subtitle: '', running: () => '', finished: () => '' }

describe('formatClock', () => {
  it('reads hours, minutes and seconds', () => {
    expect(formatClock(0)).toBe('0:00:00')
    expect(formatClock(3725.9)).toBe('1:02:05')
  })
})

describe('replaySeconds', () => {
  it('holds on zero through the opening beat and reaches the longest run when the runs end', () => {
    expect(replaySeconds(0, 3600)).toBe(0)
    expect(replaySeconds(REPLAY_CUES.start, 3600)).toBe(0)
    expect(replaySeconds(REPLAY_CUES.run, 3600)).toBeCloseTo(3600)
    expect(replaySeconds(REPLAY_CUES.end, 3600)).toBeCloseTo(3600)
  })
})

describe('buildReplayScene', () => {
  const runs = [
    { track: encodePolyline([[6.1, 49.6], [6.12, 49.61]]), times: encodeIntegers([0, 600]), durationSeconds: 600 },
    { track: encodePolyline([[6.1, 49.6], [6.11, 49.62]]), times: encodeIntegers([0, 1200]), durationSeconds: 1200 },
  ]

  it('puts the shared start inside the box and rebuilds the times from their steps', () => {
    const scene = buildReplayScene(runs, { accent: '#ff7a1a', font: 'sans-serif', labels })
    const [x, y] = scene.runs[0]!.xy

    expect(x).toBeGreaterThanOrEqual(0)
    expect(x).toBeLessThanOrEqual(1)
    expect(y).toBeGreaterThanOrEqual(0)
    expect(y).toBeLessThanOrEqual(1)
    expect(scene.runs[1]!.times).toEqual([0, 1200])
    expect(scene.maxSeconds).toBe(1200)
    expect(scene.binCount).toBe(2)
  })
})
