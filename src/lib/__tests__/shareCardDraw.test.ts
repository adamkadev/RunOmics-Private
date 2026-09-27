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

  it('keeps the accent to the logo mark and the finish marker, off every unit and label', () => {
    const acc = curatedAccent('lavender').dark.acc
    const ops = draw({ design: 'route' })
    expect(ops.filter((o) => o.op === 'fillText' && o.fill === acc)).toEqual([])
    // The finish is the one accent fill; the mark is three accent strokes.
    expect(ops.filter((o) => o.op === 'fill' && o.fill === acc)).toHaveLength(1)
    expect(ops.filter((o) => o.op === 'stroke' && o.stroke === acc)).toHaveLength(3)
  })

  it('heads the card with the v5.2 lockup: three arcs of the small mark, then "RunOmics"', () => {
    const ops = draw({ design: 'stats' })
    expect(ops.filter((o) => o.op === 'ellipse')).toHaveLength(3)
    expect(texts(ops)[0]).toBe('RunOmics')
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

  it('leads Stats with the main zone as the number, then every zone (R3)', () => {
    const all = texts(draw({ design: 'stats' }))
    expect(all).toEqual(expect.arrayContaining(['80%', 'in Z2', 'Z1', 'Z5', '40 min', '10 min', '0 min']))
  })

  it('draws an empty track, no coloured dot, for a zone under a minute (v5.5 #12)', () => {
    const palette = sharePalette('lavender', 'dark')
    const ops = draw({ design: 'stats', activity: { ...RUN, hrZones: [{ zone: 2, seconds: 2400, percent: 99, minBpm: 120, maxBpm: 140 }, { zone: 4, seconds: 20, percent: 1, minBpm: 155, maxBpm: 170 }] } })
    expect(ops.some((o) => o.op === 'fill' && o.fill === palette.zones[3])).toBe(false)
    const zero = ops.filter((o) => o.op === 'fillText' && o.args[0] === '0 min')
    expect(zero.length).toBe(4)
    expect(zero.every((o) => o.fill === palette.mu)).toBe(true)
  })

  it('says so on Stats when the run has no heart rate', () => {
    const all = texts(draw({ design: 'stats', activity: { ...RUN, hrZones: [] } }))
    expect(all).toContain('No heart-rate zones for this run')
  })

  it('draws the VO₂max grade badge only when asked, in ink on the segmented grey (v5.3)', () => {
    expect(texts(draw({ design: 'stats' }))).not.toContain('VO₂max A')
    const ops = draw({ design: 'stats', gradeBadge: 'VO₂max A' })
    const badge = ops.find((o) => o.op === 'fillText' && o.args[0] === 'VO₂max A')!
    expect(badge.fill).toBe(sharePalette('lavender', 'dark').tx)
    expect(ops.some((o) => o.op === 'fill' && o.fill === sharePalette('lavender', 'dark').seg)).toBe(true)
  })

  it('asks for a photo in the frame until there is one, in English', () => {
    expect(texts(draw({ design: 'photo' }))).toContain('Your photo fills this frame')
    const photo = { width: 1000, height: 800 } as HTMLImageElement
    const ops = draw({ design: 'photo', photo })
    expect(ops.find((o) => o.op === 'drawImage')?.args.slice(5)).toEqual([0, 0, W, MIDDLE_H])
  })
})
