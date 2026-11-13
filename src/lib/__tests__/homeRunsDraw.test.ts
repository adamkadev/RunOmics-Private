import { describe, it, expect } from 'vitest'
import { buildReplayScene, drawReplay, formatClock, REPLAY_CUES, replaySeconds } from '../homeRunsDraw'
import { encodeIntegers, encodePolyline } from '../polyline'

const labels = { title: '', subtitle: '', running: (n: number, of: number) => `${n} of ${of} out`, finished: () => '', histogram: 'by duration', elapsed: 'elapsed' }

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

  it('labels the finish-time bars and the timer, and counts the runs still out of all of them in ink', () => {
    const scene = buildReplayScene(runs, { accent: '#ff7a1a', font: 'sans-serif', labels })
    const texts: { text: string; fill: unknown }[] = []
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (target, key) => (key === 'fillText' ? (text: string) => texts.push({ text, fill: target.fillStyle }) : key in target ? target[key as string] : () => ({ addColorStop: () => {} })),
      set: (target, key, value) => ((target[key as string] = value), true),
    }) as unknown as CanvasRenderingContext2D
    drawReplay(ctx, scene, 300, 1080, 1920)

    expect(texts.map((t) => t.text)).toEqual(expect.arrayContaining(['by duration', 'elapsed']))
    expect(texts.find((t) => t.text === '2 of 2 out')?.fill).toBe('#ffffff')
  })

  it('leaves the title to the page and puts the clock above the map on the page', () => {
    const scene = buildReplayScene(runs, { accent: '#ff7a1a', font: 'sans-serif', labels: { ...labels, title: 'Home runs' } })
    const texts: { text: string; y: number }[] = []
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (target, key) => (key === 'fillText' ? (text: string, _x: number, y: number) => texts.push({ text, y }) : key in target ? target[key as string] : () => ({ addColorStop: () => {} })),
      set: (target, key, value) => ((target[key as string] = value), true),
    }) as unknown as CanvasRenderingContext2D
    drawReplay(ctx, scene, 300, 1080, 1920, 'page')

    expect(texts.map((t) => t.text)).not.toContain('Home runs')
    expect(texts.find((t) => t.text === '2 of 2 out')!.y).toBeLessThan(400)
  })
})
