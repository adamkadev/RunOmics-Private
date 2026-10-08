import { describe, expect, it } from 'vitest'
import { balanceLines, drawShareCard, FALLBACK_FONTS, shareCardLayout, slicePolyline, type ShareCardScene } from '@/lib/shareCardDraw'
import { W, H, sharePalette } from '@/lib/shareCardPalette'
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
    createLinearGradient() { return { addColorStop() {} } },
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
  hrZones: [
    { zone: 2, seconds: 2400, percent: 80, minBpm: 120, maxBpm: 140 },
    { zone: 3, seconds: 600, percent: 20, minBpm: 140, maxBpm: 155 },
  ],
}

const REPS = { count: 3, repSeconds: 480, paceSecPerKm: 264, target: { min: 265, max: 265 }, windows: [[0.2, 0.35], [0.45, 0.6], [0.7, 0.85]] as [number, number][] }

function draw(partial: Partial<ShareCardScene> & Pick<ShareCardScene, 'design'>, mode: 'dark' | 'light' = 'dark') {
  const { ctx, ops } = recorder()
  drawShareCard(ctx, { activity: RUN, palette: sharePalette('violet', mode), fonts: FALLBACK_FONTS, place: 'Hoenheim', ...partial })
  return ops
}

function layout(activity: ShareActivity = RUN, design: ShareCardScene['design'] = 'route') {
  return shareCardLayout(recorder().ctx, activity, FALLBACK_FONTS, design)
}

const texts = (ops: Op[]) => ops.filter((o) => o.op === 'fillText').map((o) => o.args[0] as string)
const palette = sharePalette('violet', 'dark')
const acc = curatedAccent('violet').dark.acc

describe('drawShareCard', () => {
  it('lays the whole card on the theme background, one solid fill', () => {
    for (const mode of ['dark', 'light'] as const) {
      const [first] = draw({ design: 'route' }, mode)
      expect(first).toMatchObject({ op: 'fillRect', args: [0, 0, W, H], fill: SURFACES[mode].background })
    }
  })

  it('draws the same header and stat row on every design', () => {
    const header = ['RunOmics', 'Strides 6 × 20s']
    const stats = ['10.0', ' km', 'Distance', '5:44', ' /km', 'Pace', '153', ' bpm', 'Avg HR', '57:33', 'Time']
    for (const design of ['route', 'stats', 'photo'] as const) {
      const all = texts(draw({ design }))
      const at = all.indexOf('RunOmics')
      expect(all.slice(at, at + 2)).toEqual(header)
      expect(all[at + 2]).toMatch(/ · Hoenheim$/)
      expect(all.slice(-stats.length)).toEqual(stats)
    }
  })

  // Design review, Oct 2026: the accent is a point marker's, never a trace or a word.
  it('keeps the accent to the logo mark and the start marker: off the route and every word', () => {
    for (const activity of [RUN, { ...RUN, type: 'Threshold' as const, reps: REPS }]) {
      const ops = draw({ design: 'route', activity })
      expect(ops.filter((o) => o.op === 'fillText' && o.fill === acc)).toEqual([])
      expect(ops.filter((o) => o.op === 'fill' && o.fill === acc)).toHaveLength(1)
      // The mark is three accent strokes; the route takes none.
      expect(ops.filter((o) => o.op === 'stroke' && o.stroke === acc)).toHaveLength(3)
    }
  })

  it('heads the card with the v5.2 lockup: three arcs of the small mark, then "RunOmics"', () => {
    const ops = draw({ design: 'stats' })
    expect(ops.filter((o) => o.op === 'ellipse')).toHaveLength(3)
    expect(texts(ops)).toContain('RunOmics')
  })
})

describe('the title (design review, Oct 2026)', () => {
  const measure = recorder().ctx

  it('wraps to two balanced lines instead of cutting, keeping "3 × 8′ @ 4:25" whole', () => {
    expect(balanceLines(measure, 'Threshold · 3 × 8′ @ 4:25', 120)).toEqual(['Threshold ·', '3 × 8′ @ 4:25'])
    expect(balanceLines(measure, 'Easy run', 120)).toEqual(['Easy run'])
  })

  it('grows the header by a line and gives the middle less, never the stats', () => {
    const long = { ...RUN, sessionTitle: 'Threshold · 3 × 8′ @ 4:25 then six strides on the flat' }
    const one = layout()
    const two = layout(long)
    expect(two.title.lines).toHaveLength(2)
    expect(two.middleTop - one.middleTop).toBe(two.title.lineHeight)
    expect(two.statsTop).toBe(one.statsTop)
    expect(texts(draw({ design: 'stats', activity: long }))).toEqual(expect.arrayContaining(two.title.lines))
    expect(texts(draw({ design: 'stats', activity: long })).some((s) => s.endsWith('…'))).toBe(false)
  })

  it('fills the card: the middle runs down to the stats, no band left under them', () => {
    const { middleTop, middleH, statsTop } = layout()
    expect(middleTop + middleH).toBe(statsTop - 16)
    expect(H - statsTop).toBeLessThan(80)
  })
})

describe('an interval session (design review, Oct 2026)', () => {
  const session = { ...RUN, type: 'Threshold' as const, reps: REPS }

  it('leads with the rep pace in the session\'s zone, then Distance, Time and Avg HR', () => {
    const ops = draw({ design: 'route', activity: session })
    const all = texts(ops)
    expect(all).toEqual(expect.arrayContaining(['REP PACE · 3 × 8′', '4:24', '/km · target 4:25']))
    expect(ops.find((o) => o.op === 'fillText' && o.args[0] === 'REP PACE · 3 × 8′')?.fill).toBe(palette.zones[3])
    expect(all.slice(-8)).toEqual(['10.0', ' km', 'Distance', '57:33', 'Time', '153', ' bpm', 'Avg HR'])
  })

  it('gives the rep pace its room out of the middle', () => {
    expect(layout(session).middleH).toBeLessThan(layout().middleH)
    expect(layout(session).statsTop).toBe(layout().statsTop)
  })
})

describe('the route (design review, Oct 2026)', () => {
  const middle = (ops: Op[], activity: ShareActivity = RUN) => ops.filter((o) => o.ty === layout(activity).middleTop)
  const strokes = (ops: Op[]) => ops.filter((o) => o.op === 'stroke')

  it('draws an easy run as one trace in the text colour, with no legend', () => {
    const ops = draw({ design: 'route' })
    const lines = strokes(middle(ops)).map((o) => o.stroke)
    expect(lines).toContain(palette.tx)
    expect(lines.filter((c) => palette.zones.includes(c))).toEqual([])
    expect(texts(ops)).not.toContain('Reps')
  })

  it('draws an interval session grey, its reps over it in Z4 and 1.6x as wide, under a "Reps" legend', () => {
    const run = { ...RUN, type: 'Threshold' as const, reps: REPS }
    const ops = middle(draw({ design: 'route', activity: run }), run)
    const lines = strokes(ops)
    const grey = lines.findIndex((o) => o.stroke === palette.mu)
    const reps = lines.filter((o) => o.stroke === palette.zones[3])
    expect(reps).toHaveLength(3)
    // Grey first, so a rep down the warm-up's road stays on top.
    expect(lines.indexOf(reps[0]!)).toBeGreaterThan(grey)
    expect(texts(ops)).toContain('Reps')
  })

  it('cuts a rep where it starts, not at the nearest point of the route', () => {
    const line: [number, number][] = [[0, 0], [100, 0]]
    expect(slicePolyline(line, 0.25, 0.5)).toEqual([[25, 0], [50, 0]])
    expect(slicePolyline([[0, 0], [10, 0], [10, 10]], 0.25, 0.75)).toEqual([[5, 0], [10, 0], [10, 5]])
  })

  // The Activity map's markers (routeMarkers): radius 10 is the finish's outline, 12.5 the loop's, 5.5 the start's dot.
  const arcsOf = (ops: Op[], radius: number) => ops.filter((o) => o.op === 'arc' && o.args[2] === radius).map((o) => o.args.slice(0, 2))

  it('puts the checkered finish on the trace\'s own last point, the accent start over it', () => {
    const ops = middle(draw({ design: 'route' }))
    const trace = ops.filter((o) => o.op === 'lineTo')
    const last = trace[trace.length - 1]!.args
    expect(arcsOf(ops, 10)).toEqual([last])
    expect(arcsOf(ops, 5.5)).toHaveLength(1)
    expect(ops.some((o) => o.op === 'fillRect' && o.fill === '#0c0d0d')).toBe(true)
    const fills = ops.filter((o) => o.op === 'fill').map((o) => o.fill)
    expect(fills.lastIndexOf(acc)).toBeGreaterThan(fills.indexOf('#ffffff'))
  })

  it('draws a loop as one combined marker on the start, never two stacked', () => {
    const loop = { ...RUN, route: [...RUN.route!, RUN.route![0]!] as [number, number][] }
    const ops = middle(draw({ design: 'route', activity: loop }), loop)
    expect(arcsOf(ops, 12.5)).toHaveLength(1)
    expect(arcsOf(ops, 10)).toEqual([])
    expect(arcsOf(ops, 5.5)).toEqual([])
    // Its ring is the accent.
    expect(ops.filter((o) => o.op === 'fill' && o.fill === acc)).toHaveLength(1)
  })

  it('paints the basemap over the whole middle', () => {
    const map = {} as HTMLCanvasElement
    const ops = draw({ design: 'route', mapImage: map, mapPoints: [[40, 60], [200, 300], [350, 120]] })
    const { middleTop, middleH } = layout()
    expect(ops.find((o) => o.op === 'drawImage')).toMatchObject({ args: [map, 0, 0, W, middleH], ty: middleTop })
  })

  it('centres a basemap drawn for another height, the route moved with it', () => {
    const { middleH } = layout()
    const map = { width: W * 3, height: (middleH - 40) * 3 } as HTMLCanvasElement
    const ops = draw({ design: 'route', mapImage: map, mapPoints: [[40, 60], [200, 300], [350, 120]] })
    expect(ops.find((o) => o.op === 'drawImage')?.args).toEqual([map, 0, 20, W, middleH - 40])
    expect(ops.find((o) => o.op === 'moveTo')?.args).toEqual([40, 80])
  })
})

describe('the Stats design (design review, Oct 2026)', () => {
  it('heads with the share the run is judged on, then a row for each zone it used', () => {
    const all = texts(draw({ design: 'stats', activity: { ...RUN, type: 'Base' } }))
    expect(all).toEqual(expect.arrayContaining(['80%', 'easy · Z1–Z2', '· 50 min', 'Z2 Easy', 'Z3 Aerobic', '20%']))
    expect(all).not.toContain('Z1 Recovery')
    expect(all).not.toContain('Z5 Max')
  })

  it('draws a zone of under a minute nowhere, not as an empty track', () => {
    const ops = draw({ design: 'stats', activity: { ...RUN, hrZones: [{ zone: 2, seconds: 2400, percent: 99, minBpm: 120, maxBpm: 140 }, { zone: 4, seconds: 20, percent: 1, minBpm: 155, maxBpm: 170 }] } })
    expect(ops.some((o) => o.op === 'fill' && o.fill === palette.zones[3])).toBe(false)
    expect(texts(ops)).not.toContain('Z4 Threshold')
  })

  // Handoff 4: the card fits its content, the stats under a rule, no spacer.
  it('is as tall as its zones, the stats under a rule', () => {
    const stats = layout(RUN, 'stats')
    expect(stats.height).toBeLessThan(H)
    expect(stats.ruleY).toBe(stats.middleTop + stats.middleH + 31)
    expect(layout(RUN, 'route').ruleY).toBeNull()
    const ops = draw({ design: 'stats' })
    expect(ops[0]).toMatchObject({ op: 'fillRect', args: [0, 0, W, stats.height] })
    expect(ops.some((o) => o.op === 'fillRect' && o.fill === palette.line && o.args[1] === stats.ruleY)).toBe(true)
  })

  it('grows with each zone the run used', () => {
    const one = { ...RUN, hrZones: [RUN.hrZones[0]!] }
    expect(layout(RUN, 'stats').height - layout(one, 'stats').height).toBe(36)
  })

  it('says so when the run has no heart rate', () => {
    const all = texts(draw({ design: 'stats', activity: { ...RUN, hrZones: [] } }))
    expect(all).toContain('No heart-rate zones for this run')
  })
})

describe('the Photo design (design review, Oct 2026)', () => {
  it('asks for a photo until there is one', () => {
    expect(texts(draw({ design: 'photo' }))).toEqual(expect.arrayContaining(['Choose photo', 'Fills the whole card']))
  })

  it('fills the whole card with the photo, the words over it in white', () => {
    const photo = { width: 1000, height: 800 } as HTMLImageElement
    const ops = draw({ design: 'photo', photo })
    expect(ops.find((o) => o.op === 'drawImage')?.args.slice(5)).toEqual([0, 0, W, H])
    expect(ops.find((o) => o.op === 'fillText' && o.args[0] === 'Strides 6 × 20s')?.fill).toBe('#ffffff')
    expect(ops.find((o) => o.op === 'fillText' && o.args[0] === '10.0')?.fill).toBe('#ffffff')
  })
})
