import { describe, expect, it } from 'vitest'
import { EXPORT_FRAMES, exportFrameAt, repPhase, VIDEO_CUES, VIDEO_FPS, VIDEO_SECONDS, videoFrameAt, videoMotion } from '@/lib/shareCardTimeline'

describe('videoFrameAt', () => {
  it('runs 12.2 s at 30 fps', () => {
    expect(VIDEO_SECONDS).toBe(12.2)
    expect(Math.round(VIDEO_SECONDS * VIDEO_FPS)).toBe(366)
  })

  it('holds the route back through the intro, draws it over the run, and holds it whole after', () => {
    expect(videoFrameAt(0).progress).toBe(0)
    expect(videoFrameAt(VIDEO_CUES.run).progress).toBe(0)
    expect(videoFrameAt((VIDEO_CUES.run + VIDEO_CUES.finish) / 2).progress).toBeCloseTo(0.5, 6)
    expect(videoFrameAt(VIDEO_CUES.finish).progress).toBe(1)
    expect(videoFrameAt(VIDEO_CUES.hold).progress).toBe(1)
    expect(videoFrameAt(VIDEO_SECONDS).progress).toBe(1)
  })

  it('carries the clip time', () => {
    expect(videoFrameAt(3.4).clipTime).toBe(3.4)
  })
})

describe('videoMotion', () => {
  it('zooms the map in over the first second and pops the start in from 0.4 s', () => {
    expect(videoMotion(0)).toMatchObject({ intro: 0, startPop: 0 })
    expect(videoMotion(0.4).startPop).toBe(0)
    expect(videoMotion(1)).toMatchObject({ intro: 1, startPop: 1 })
  })

  it('pops the finish in around the finish cue and fades the pace in over 0.8 s', () => {
    expect(videoMotion(VIDEO_CUES.finish - 0.05).finishPop).toBe(0)
    expect(videoMotion(VIDEO_CUES.finish + 0.45).finishPop).toBe(1)
    expect(videoMotion(VIDEO_CUES.finish).finish).toBe(0)
    expect(videoMotion(VIDEO_CUES.finish + 0.8).finish).toBe(1)
  })

  it('fades the route out over the last 0.4 s of a loop only', () => {
    expect(videoMotion(VIDEO_SECONDS - 0.4, true).route).toBe(1)
    expect(videoMotion(VIDEO_SECONDS, true).route).toBe(0)
    expect(videoMotion(VIDEO_SECONDS).route).toBe(1)
  })
})

describe('repPhase', () => {
  const windows: [number, number][] = [[0.2, 0.35], [0.45, 0.6]]

  it('reads the warm-up, each rep, the recovery after it and the cool-down', () => {
    expect(repPhase(windows, 0.19)).toEqual({ kind: 'warmUp' })
    expect(repPhase(windows, 0.2)).toEqual({ kind: 'rep', n: 1, count: 2 })
    expect(repPhase(windows, 0.35)).toEqual({ kind: 'rep', n: 1, count: 2 })
    expect(repPhase(windows, 0.36)).toEqual({ kind: 'recovery' })
    expect(repPhase(windows, 0.44)).toEqual({ kind: 'recovery' })
    expect(repPhase(windows, 0.45)).toEqual({ kind: 'rep', n: 2, count: 2 })
    expect(repPhase(windows, 0.6)).toEqual({ kind: 'rep', n: 2, count: 2 })
    expect(repPhase(windows, 0.61)).toEqual({ kind: 'coolDown' })
    expect(repPhase([], 0.5)).toEqual({ kind: 'none' })
  })
})

describe('the exported file\'s frames', () => {
  it('opens on one frame of the still card, then cuts to the intro', () => {
    expect(EXPORT_FRAMES).toBe(367)
    expect(exportFrameAt(0)).toBeNull()
    expect(exportFrameAt(1)).toEqual({ progress: 0, clipTime: 0 })
    expect(exportFrameAt(EXPORT_FRAMES - 1)!.clipTime).toBeCloseTo((EXPORT_FRAMES - 2) / VIDEO_FPS, 9)
  })
})
