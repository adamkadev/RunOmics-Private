import { describe, expect, it } from 'vitest'
import { drawShareCard, FALLBACK_FONTS, type ShareCardScene } from '@/lib/shareCardDraw'
import { HEADER_H, MIDDLE_H, W, H, sharePalette } from '@/lib/shareCardPalette'
import { PACE_ROUTE_COLORS } from '@/lib/colors'
import { curatedAccent } from '@/lib/accentScale'
import { SURFACES } from '@/lib/themeTokens'
import type { ShareActivity } from '@/lib/shareCardStats'

interface Op { op: string; args: unknown[]; fill: string; stroke: string; font: string; ty: number }

/** A 2D context that keeps what was drawn, in what colour and font, and how far down. */
function recorder() {
  const ops: Op[] = []
  let ty = 0
  const state = { fillStyle: '', strokeStyle: '', font: '', lineWidth: 1, globalAlpha: 1, textAlign: 'left', textBaseline: 'alphabetic', lineJoin: 'miter', lineCap: 'butt', letterSpacing: '0px' }
  const stack: { ty: number; state: typeof state }[] = []
  const log = (op: string) => (...args: unknown[]) => { ops.push({ op, args, fill: state.fillStyle, stroke: state.strokeStyle, font: state.font, ty }) }
  const ctx = {
    ...Object.fromEntries(['fillRect', 'fillText', 'fill', 'stroke', 'arc', 'ellipse', 'drawImage', 'moveTo', 'lineTo', 'rect', 'roundRect'].map((k) => [k, log(k)])),
    beginPath() {}, clip() {}, closePath() {}, arcTo() {}, scale() {},
    save() { stack.push({ ty, state: { ...state } }) },
    restore() { const s = stack.pop()!; ty = s.ty; Object.assign(state, s.state) },
    translate(_x: number, y: number) { ty += y },
    measureText(text: string) { return { width: text.length * 7 } },
  }
  const proxy = new Proxy(ctx, {
    get: (target, key) => (key in state ? state[key as keyof typeof state] : target[key as keyof typeof target]),
    set: (_t, key, value) => { (state as Record<string, unknown>)[key as string] = value; return true },
    has: (target, key) => key in state || key in target,
  })
  return { ctx: proxy as unknown as CanvasRenderingContext2D, ops }
}

const RUN: ShareActivity = {
  id: '1', date: '2026-09-26', dayOfWeek: 'Saturday', description: 'Strides 6 × 20s',
  distanceKm: 10, durationSeconds: 3453, paceSecPerKm: 344, avgHeartRate: 153, elevationGain: 40,
  route: [[7.70, 48.60], [7.71, 48.61], [7.72, 48.60], [7.73, 48.62]],
  paceSamples: [420, 380, 300, 250],
  hrZones: [
    { zone: 2, seconds: 2400, percent: 80, minBpm: 120, maxBpm: 140 },
    { zone: 3, seconds: 600, percent: 20, minBpm: 140, maxBpm: 155 },
  ],
}

function draw(partial: Partial<ShareCardScene> & Pick<ShareCardScene, 'design'>, mode: 'dark' | 'light' = 'dark') {
  const { ctx, ops } = recorder()
  drawShareCard(ctx, { activity: RUN, palette: sharePalette('lavender', mode), fonts: FALLBACK_FONTS, place: 'Hoenheim', ...partial })
  return ops
}

const texts = (ops: Op[]) => ops.filter((o) => o.op === 'fillText').map((o) => o.args[0] as string)

describe('drawShareCard', () => {
  it('lays the whole card on the theme background, one solid fill', () => {
    for (const mode of ['dark', 'light'] as const) {
      const [first] = draw({ design: 'stats' }, mode)
      expect(first).toMatchObject({ op: 'fillRect', args: [0, 0, W, H], fill: SURFACES[mode].background })
    }
  })

  it('draws the same header and stat row on every design', () => {
    const header = ['RunOmics', 'Strides 6 × 20s']
    const stats = ['10.0', ' km', 'Distance', '5:44', ' /km', 'Pace', '153', ' bpm', 'Avg HR', '57:33', 'Time']
    for (const design of ['route', 'stats', 'photo'] as const) {
      const all = texts(draw({ design }))
      expect(all.slice(0, 2)).toEqual(header)
      expect(all[2]).toMatch(/ · Hoenheim$/)
      expect(all.slice(-stats.length)).toEqual(stats)
    }
  })

  it('keeps the accent to the eyebrow dot and the finish marker, off every unit and label', () => {
    const acc = curatedAccent('lavender').dark.acc
    const ops = draw({ design: 'route' })
    expect(ops.filter((o) => o.op === 'fillText' && o.fill === acc)).toEqual([])
    const accentFills = ops.filter((o) => o.op === 'fill' && o.fill === acc)
    expect(accentFills).toHaveLength(2)
  })

  it('starts white with a dark outline and finishes in the accent, as on the Activity map (v4.10)', () => {
    const ops = draw({ design: 'route' })
    const markers = ops.filter((o) => o.op === 'fill' && o.ty === HEADER_H)
    const palette = sharePalette('lavender', 'dark')
    expect(markers.map((m) => m.fill)).toEqual([palette.ring, curatedAccent('lavender').dark.acc])
    expect(markers.map((m) => m.fill)).not.toContain(PACE_ROUTE_COLORS.fast)
    const lines = ops.filter((o) => o.op === 'stroke' && o.ty === HEADER_H).map((o) => o.stroke)
    expect(new Set(lines.slice(1, -2)).size).toBeGreaterThan(1)
  })

  it('paints the basemap in the middle only', () => {
    const map = {} as HTMLCanvasElement
    const ops = draw({ design: 'route', mapImage: map, mapPoints: [[40, 60], [200, 300], [350, 120]] })
    expect(ops.find((o) => o.op === 'drawImage')).toMatchObject({ args: [map, 0, 0, W, MIDDLE_H], ty: HEADER_H })
  })

  it('shows time in zones on Stats, with the main zone and its share', () => {
    const all = texts(draw({ design: 'stats' }))
    expect(all).toEqual(expect.arrayContaining(['Time in zones', 'mostly Z2 · 80%', 'Z1', 'Z5', '40 min', '10 min', '0 min']))
  })

  it('says so on Stats when the run has no heart rate', () => {
    const all = texts(draw({ design: 'stats', activity: { ...RUN, hrZones: [] } }))
    expect(all).toContain('No heart-rate zones for this run')
  })

  it('asks for a photo in the frame until there is one, in English', () => {
    expect(texts(draw({ design: 'photo' }))).toContain('Your photo fills this frame')
    const photo = { width: 1000, height: 800 } as HTMLImageElement
    const ops = draw({ design: 'photo', photo })
    expect(ops.find((o) => o.op === 'drawImage')?.args.slice(5)).toEqual([0, 0, W, MIDDLE_H])
  })
})
