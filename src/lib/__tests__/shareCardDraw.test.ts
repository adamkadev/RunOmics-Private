import { describe, expect, it, vi } from 'vitest'
import { arrangeLabels, type LabelKind, balanceLines, balanceWrap, drawShareCard, FALLBACK_FONTS, headerFoot, LABEL_PRIORITY, markerObstacles, photoScrim, shareMarkerRadius, shareCardLayout, slicePolyline, verdictHero, zoneBarLabels, zoneBlockLayout, type ShareCardScene } from '@/lib/shareCardDraw'
import { W, H, SHARE_MARKER_HEX, sharePalette } from '@/lib/shareCardPalette'
import { curatedAccent } from '@/lib/accentScale'
import { STATUS_HEX, SURFACES } from '@/lib/themeTokens'
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
    ...Object.fromEntries(['fillRect', 'fillText', 'strokeText', 'fill', 'stroke', 'arc', 'ellipse', 'drawImage', 'moveTo', 'lineTo', 'rect', 'roundRect'].map((k) => [k, log(k)])),
    beginPath() {}, clip() {}, closePath() {}, arcTo() {}, scale() {},
    createLinearGradient() { return { addColorStop() {} } },
    createRadialGradient() { const stops: [number, string][] = []; return { stops, addColorStop(at: number, colour: string) { stops.push([at, colour]) } } },
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

const REPS = { count: 3, repSeconds: 480, paceSecPerKm: 264, paces: [262, 264, 266], target: { min: 265, max: 265 }, windows: [[0.2, 0.35], [0.45, 0.6], [0.7, 0.85]] as [number, number][] }

function draw(partial: Partial<ShareCardScene> & Pick<ShareCardScene, 'design'>, mode: 'dark' | 'light' = 'dark') {
  const { ctx, ops } = recorder()
  drawShareCard(ctx, { activity: RUN, palette: sharePalette('heather', mode), fonts: FALLBACK_FONTS, place: 'Hoenheim', ...partial })
  return ops
}

function layout(activity: ShareActivity = RUN, design: ShareCardScene['design'] = 'route') {
  return shareCardLayout(recorder().ctx, activity, FALLBACK_FONTS, design)
}

const texts = (ops: Op[]) => ops.filter((o) => o.op === 'fillText').map((o) => o.args[0] as string)
const palette = sharePalette('heather', 'dark')
const acc = curatedAccent('heather').dark.acc

describe('drawShareCard', () => {
  it('glows on the dark Stats card only, in the run\'s own colour', () => {
    const radial = (ops: Op[]) => ops.filter((o) => o.op === 'fillRect' && (o.fill as unknown as { stops?: unknown }).stops) as unknown as { fill: { stops: [number, string][] } }[]
    const glows = (mode: 'dark' | 'light') => radial(draw({ design: 'stats' }, mode))
    const [glow] = glows('dark')
    const zone2 = palette.zones[1]!
    const rgb = [1, 3, 5].map((i) => Number.parseInt(zone2.slice(i, i + 2), 16)).join(', ')
    expect(glow!.fill.stops[0]![1]).toBe(`rgba(${rgb}, 0.3)`)
    expect(glows('light')).toHaveLength(0)
    expect(radial(draw({ design: 'route' }))).toHaveLength(0)
  })

  it('lays the whole card on the theme background, one solid fill', () => {
    for (const mode of ['dark', 'light'] as const) {
      const [first] = draw({ design: 'route' }, mode)
      expect(first).toMatchObject({ op: 'fillRect', args: [0, 0, W, H], fill: SURFACES[mode].background })
    }
  })

  it('draws the same header and stat row on every design', () => {
    const header = ['RunOmics', 'Strides 6 × 20s · 10.0 km']
    const stats = ['10.0', ' km', 'Distance', '57:33', 'Time', '5:44', ' /km', 'Pace', '153', ' bpm', 'Avg HR']
    for (const design of ['route', 'stats', 'photo'] as const) {
      const all = texts(draw({ design }))
      const at = all.indexOf('RunOmics')
      expect(all.slice(at, at + 2)).toEqual(header)
      expect(all[at + 2]).toMatch(/ · Hoenheim$/)
      expect(all.slice(-stats.length)).toEqual(stats)
    }
  })

  it('keeps the accent to the route and the start marker\'s fill, the logo mark in ink', () => {
    for (const activity of [RUN, { ...RUN, type: 'Threshold' as const, reps: REPS }]) {
      const ops = draw({ design: 'route', activity })
      expect(ops.filter((o) => o.op === 'fillText' && o.fill === acc)).toEqual([])
      expect(ops.filter((o) => o.op === 'fill' && o.fill === acc)).toHaveLength(1)
    }
    expect(draw({ design: 'route' }).filter((o) => o.op === 'stroke' && o.stroke === acc)).toHaveLength(1)
    const reps = draw({ design: 'route', activity: { ...RUN, type: 'Threshold' as const, reps: REPS } })
    expect(reps.filter((o) => o.op === 'stroke' && o.stroke === acc)).toHaveLength(0)
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
    expect(middleTop + middleH).toBe(statsTop - 12)
    expect(H - statsTop).toBeLessThan(60)
  })
})

describe('an interval session (design review, Oct 2026)', () => {
  const session = { ...RUN, type: 'Threshold' as const, reps: REPS }

  it('leads the Route card\'s stat row with the rep pace, its label in the session\'s zone, then Distance, Time and Avg HR', () => {
    const ops = draw({ design: 'route', activity: session })
    const all = texts(ops)
    expect(all.slice(-11)).toEqual(['4:24', ' /km', 'Rep pace', '10.0', ' km', 'Distance', '57:33', 'Time', '153', ' bpm', 'Avg HR'])
    const label = ops.find((o) => o.op === 'fillText' && o.args[0] === 'Rep pace')!
    expect(label.fill).toBe(palette.zones[3])
    expect(label.font).toMatch(/^600 /)
    expect(all).not.toContain('REP PACE')
  })

  it('spreads the rep chips across the card in one row', () => {
    const chips = draw({ design: 'stats', activity: session }).filter((o) => o.op === 'roundRect' && o.args[3] === 22).map((o) => o.args as number[])
    expect(chips).toHaveLength(3)
    expect(chips[0]![0]).toBe(16)
    expect(chips[2]![0]! + chips[2]![2]!).toBeCloseTo(W - 16, 6)
    expect(new Set(chips.map((c) => c[1])).size).toBe(1)
  })

  it('leads the Stats card with the rep pace, the zones dropped to a thin bar', () => {
    const ops = draw({ design: 'stats', activity: session })
    const all = texts(ops)
    const pace = ops.find((o) => o.op === 'fillText' && o.args[0] === '4:24')!
    expect(pace.font).toMatch(/^700 64px/)
    expect(all).toEqual(expect.arrayContaining(['/km', 'Reps · target 4:25', 'Z1–Z2 80%', 'Z3 20%']))
    expect(all).not.toContain('80%')
    expect(all.some((text) => text.startsWith('in Z'))).toBe(false)
    expect(all).not.toContain('REP PACE')
    expect(ops.filter((o) => o.op === 'roundRect' && o.args[3] === 6)).toHaveLength(2)
    expect(all.slice(-8)).toEqual(['10.0', ' km', 'Distance', '57:33', 'Time', '153', ' bpm', 'Avg HR'])
    expect(texts(draw({ design: 'stats' }))).toEqual(expect.arrayContaining(['80%', 'in Z1–Z2']))
  })

  it('titles the card by its set, the type leading the line under it, and the rep chips on the Stats card only', () => {
    const route = texts(draw({ design: 'route', activity: session }))
    expect(route).toContain('3 × 8′ · 10.0 km')
    expect(route.find((text) => text.endsWith(' · Hoenheim'))).toMatch(/^Threshold · /)
    expect(route).not.toContain('Threshold')
    expect(route).not.toContain('Rep 1')
    expect(texts(draw({ design: 'stats', activity: session }))).toEqual(expect.arrayContaining(['Rep 1', '4:22', 'Rep 3', '4:26']))
  })

  it('puts the reps\' result in ink under the header on Route and Stats, never on Photo or a plain run', () => {
    for (const design of ['route', 'stats'] as const) {
      const ops = draw({ design, activity: session })
      const line = ops.find((o) => o.op === 'fillText' && o.args[0] === 'Reps 1 s/km faster than target')!
      expect(line.fill).not.toBe(STATUS_HEX.dark.pos)
      expect(line.font).toMatch(/^600 16px/)
      const subtitle = ops.find((o) => o.op === 'fillText' && (o.args[0] as string).endsWith(' · Hoenheim'))!
      expect(line.args[2] as number).toBeGreaterThan(subtitle.args[2] as number)
      expect(line.args[2] as number).toBeLessThan(layout(session, design).textTop)
    }
    expect(texts(draw({ design: 'route', activity: { ...session, reps: { ...REPS, target: { min: 260, max: 270 } } } }))).toContain('On target')
    expect(texts(draw({ design: 'photo', activity: session }))).not.toContain('Reps 1 s/km faster than target')
    expect(draw({ design: 'stats' }).filter((o) => o.op === 'fillText' && o.fill === acc)).toEqual([])
  })

  // A tempo session is Z3's violet, not the threshold magenta.
  it('draws the reps in the session\'s type, on the route, the legend and the bars', () => {
    const tempo = { ...RUN, type: 'Tempo' as const, reps: { ...REPS, count: 5, paces: [260, 265, 270, 262, 268] } }
    const ops = draw({ design: 'route', activity: tempo })
    const strokes = ops.filter((o) => o.op === 'stroke').map((o) => o.stroke)
    expect(strokes).toContain(palette.zones[2])
    expect(strokes).not.toContain(palette.zones[3])
    const fills = ops.filter((o) => o.op === 'fill' || o.op === 'fillRect').map((o) => o.fill)
    expect(fills).toContain(palette.zones[2])
    expect(ops.find((o) => o.op === 'fillText' && o.args[0] === 'Rep pace')?.fill).toBe(palette.zones[2])
  })

  it('keeps the Reps legend at the map\'s top right, on the card\'s own margin', () => {
    const ops = draw({ design: 'route', activity: session })
    const legend = ops.find((o) => o.op === 'fillText' && o.args[0] === 'Reps')!
    expect(legend.args[2] as number).toBeLessThan(layout(session).textTop + 40)
    // Its pill ends where the words do, 16 px off the card's edge.
    const at = ops.indexOf(legend)
    const pill = ops.filter((o, i) => o.op === 'roundRect' && i < at).at(-2)!
    const [x, , width] = pill.args as [number, number, number, number, number]
    expect(x + width).toBeCloseTo(W - 16, 6)
  })

  it('keys the reps\' colour in the legend, the result left to the line under the header', () => {
    const all = texts(draw({ design: 'route', activity: session }))
    expect(all.filter((text) => text.includes('target'))).toEqual(['Reps 1 s/km faster than target'])
  })

  it('keeps the Route card\'s stat row in place, and the Photo card\'s rep-pace hero', () => {
    expect(layout(session).routeFrame.bottom).toBe(layout().routeFrame.bottom)
    expect(layout(session).ruleY).toBe(H - 16 - 32 - 12)
    expect(layout(session, 'stats').hero).toBeNull()
    expect(layout(session, 'photo').hero?.pace).toBe('4:24')
  })
})

describe('the route (redesign, Oct 2026)', () => {
  const strokes = (ops: Op[]) => ops.filter((o) => o.op === 'stroke')
  /** The route's own points: every lineTo but the lockup's. */
  const trace = (ops: Op[]) => ops.filter((o) => o.op === 'lineTo' && o.stroke !== acc).map((o) => o.args as [number, number])

  it('draws one trace in the accent, with no legend', () => {
    for (const mode of ['dark', 'light'] as const) {
      const colours = sharePalette('heather', mode)
      const ops = draw({ design: 'route' }, mode)
      const lines = strokes(ops).map((o) => o.stroke)
      expect(lines).toContain(colours.acc)
      expect(colours.route).toBe(colours.acc)
      expect(lines.filter((c) => colours.zones.includes(c) || c === colours.mu)).toEqual([])
      expect(texts(ops)).not.toContain('Reps')
    }
    expect(SHARE_MARKER_HEX.dark.ring).toBe('#f2f4f3')
  })

  it('draws an interval session grey, its reps over it in Z4 and 1.6x as wide, under a "Reps" legend', () => {
    const run = { ...RUN, type: 'Threshold' as const, reps: REPS }
    const ops = draw({ design: 'route', activity: run })
    const lines = strokes(ops)
    const grey = lines.findIndex((o) => o.stroke === palette.trace)
    expect(grey).toBeGreaterThanOrEqual(0)
    const reps = lines.filter((o) => o.stroke === palette.zones[3])
    expect(reps).toHaveLength(3)
    // Grey first, so a rep down the warm-up's road stays on top.
    expect(lines.indexOf(reps[0]!)).toBeGreaterThan(grey)
    expect(texts(ops)).toContain('Reps')
  })

  // The rest of the route is a muted grey, so the reps are what the eye finds:
  // on dark it sits under the ink the names take, never beside it.
  it('keeps the non-rep route muted, a step under the names, on both themes', () => {
    expect(sharePalette('heather', 'dark').trace).toBe('#6b7270')
    expect(sharePalette('heather', 'light').trace).toBe('#8a8a8a')
    const run = { ...RUN, type: 'Threshold' as const, reps: REPS }
    for (const mode of ['dark', 'light'] as const) {
      const colours = sharePalette('heather', mode)
      expect(strokes(draw({ design: 'route', activity: run }, mode)).map((o) => o.stroke)).toContain(colours.trace)
    }
  })

  it('cuts a rep where it starts, not at the nearest point of the route', () => {
    const line: [number, number][] = [[0, 0], [100, 0]]
    expect(slicePolyline(line, 0.25, 0.5)).toEqual([[25, 0], [50, 0]])
    expect(slicePolyline([[0, 0], [10, 0], [10, 10]], 0.25, 0.75)).toEqual([[5, 0], [10, 0], [10, 5]])
  })

  it('fits the route between the header and the stats, 16 px clear of both', () => {
    const l = layout()
    expect(l.routeFrame.top).toBe(headerFoot(l) + 16)
    expect(l.routeFrame.bottom).toBe(H - l.textBottom + 16)
    for (const [, y] of trace(draw({ design: 'route' }))) {
      expect(y).toBeGreaterThanOrEqual(l.routeFrame.top - 1e-6)
      expect(y).toBeLessThanOrEqual(H - l.routeFrame.bottom + 1e-6)
    }
  })

  it('keeps the route clear of a two-line title, and gives a rep session the plain run\'s room', () => {
    const long = { ...RUN, sessionTitle: 'Broschtkriibslaf an der Stad Lëtzebuerg, mat de Kollegen' }
    expect(layout(long).routeFrame.top).toBeGreaterThan(layout().routeFrame.top)
    const l = layout({ ...RUN, type: 'Threshold' as const, reps: REPS })
    expect(l.routeFrame.bottom).toBe(layout().routeFrame.bottom)
    for (const [, y] of trace(draw({ design: 'route', activity: { ...RUN, type: 'Threshold' as const, reps: REPS } }))) {
      expect(y).toBeGreaterThanOrEqual(l.routeFrame.top - 1e-6)
      expect(y).toBeLessThanOrEqual(l.textBottom - 16 + 1e-6)
    }
  })

  it('paints the basemap over the whole card, the header and stats on bands of the background over it', () => {
    const map = {} as HTMLCanvasElement
    const ops = draw({ design: 'route', mapImage: map, mapPoints: [[40, 100], [200, 250], [260, 120]] })
    const image = ops.findIndex((o) => o.op === 'drawImage')
    expect(ops[image]).toMatchObject({ args: [map, 0, 0, W, H], ty: 0 })
    const { textTop, textBottom } = layout()
    const bands = ops.filter((o) => o.op === 'fillRect' && o.fill === palette.bg).map((o) => o.args)
    expect(bands).toEqual(expect.arrayContaining([[0, 0, W, textTop], [0, textBottom, W, H - textBottom]]))
    // Over the map and the route, under the words.
    const band = ops.findIndex((o, i) => i > image && o.op === 'fillRect' && o.fill === palette.bg)
    const header = ops.findIndex((o) => o.op === 'fillText' && o.args[0] === 'RunOmics')
    expect(ops.slice(image, band).some((o) => o.op === 'stroke')).toBe(true)
    expect(header).toBeGreaterThan(band)
  })

  it('rules the stat row off and sets it on the card colour', () => {
    const { ruleY } = layout()
    const ops = draw({ design: 'route' })
    expect(ops.some((o) => o.op === 'fillRect' && o.fill === palette.card && o.args[1] === ruleY && o.args[0] === 0 && o.args[2] === W)).toBe(true)
    expect(ops.some((o) => o.op === 'fillRect' && o.fill === palette.line && o.args[1] === ruleY && o.args[0] === 0 && o.args[2] === W && o.args[3] === 1)).toBe(true)
  })

  // The Activity map's markers (routeMarkers) at the card's 0.85: the finish's outline, the start's outline and dot.
  const k = 0.85
  const FINISH_OUTLINE = 9 * k + 1 * k
  const START_OUTLINE = 8 * k + 1 * k
  const LOOP_OUTLINE = 11 * k + 1.5 * k
  const START_DOT = 8 * k - 2.5 * k
  const arcsOf = (ops: Op[], radius: number) => ops.filter((o) => o.op === 'arc' && o.args[2] === radius).map((o) => o.args.slice(0, 2))

  it('puts the checkered finish on the trace\'s own last point, the white start over it', () => {
    const ops = draw({ design: 'route' })
    const points = trace(ops)
    expect(arcsOf(ops, FINISH_OUTLINE)).toEqual([points[points.length - 1]])
    expect(arcsOf(ops, START_DOT)).toHaveLength(1)
    expect(ops.some((o) => o.op === 'fillRect' && o.fill === '#0c0d0d')).toBe(true)
    const fills = ops.filter((o) => o.op === 'fill').map((o) => o.fill)
    expect(fills.lastIndexOf(palette.marker)).toBeGreaterThan(fills.indexOf('#ffffff'))
  })

  it('draws a loop as one start marker, no chequered disc', () => {
    const loop = { ...RUN, route: [...RUN.route!, RUN.route![0]!] as [number, number][] }
    const ops = draw({ design: 'route', activity: loop })
    expect(arcsOf(ops, START_DOT)).toHaveLength(1)
    expect(arcsOf(ops, LOOP_OUTLINE)).toEqual([])
    expect(arcsOf(ops, FINISH_OUTLINE)).toEqual([])
    expect(ops.some((o) => o.op === 'fillRect' && o.fill === '#0c0d0d')).toBe(false)
  })

  it('rings the start in white on light with no outline, and in #f2f4f3 on dark, outlined; the accent inside', () => {
    const loop = { ...RUN, route: [...RUN.route!, RUN.route![0]!] as [number, number][] }
    const startFills = (mode: 'light' | 'dark') => {
      const ops = draw({ design: 'route', activity: loop }, mode)
      const at = ops.findIndex((o) => o.op === 'arc' && (o.args[2] === START_OUTLINE || o.args[2] === 8 * k))
      return { ops, fills: ops.slice(at).filter((o) => o.op === 'fill').map((o) => o.fill) }
    }
    const light = startFills('light')
    expect(light.fills).toEqual(['#ffffff', curatedAccent('heather').light.acc])
    expect(light.ops.some((o) => o.op === 'arc' && o.args[2] === START_OUTLINE)).toBe(false)
    expect(startFills('dark').fills).toEqual(['#0c0d0d', '#f2f4f3', curatedAccent('heather').dark.acc])
    expect(SHARE_MARKER_HEX.light.outline).toBeNull()
  })

  it('keeps the finish\'s thin dark outline on light', () => {
    const ops = draw({ design: 'route' }, 'light')
    const at = ops.findIndex((o) => o.op === 'arc' && o.args[2] === FINISH_OUTLINE)
    expect(ops.slice(at).find((o) => o.op === 'fill')!.fill).toBe('rgba(12, 13, 13, 0.6)')
  })

  it('sets two stats side by side, not at the card\'s two edges', () => {
    const ops = draw({ design: 'route', activity: { ...RUN, paceSecPerKm: null, avgHeartRate: null } })
    const at = (text: string) => ops.find((o) => o.op === 'fillText' && o.args[0] === text)!.args[1] as number
    expect(at('10.0')).toBe(16)
    const distanceEnd = 16 + Math.max('10.0'.length * 7 + ' km'.length * 7, 'Distance'.length * 7)
    expect(at('57:33') - distanceEnd).toBe(28)
    expect(at('57:33')).toBeLessThan(W / 2)
  })

  it('draws the markers over the place names', () => {
    const l = layout()
    const ops = draw({ design: 'route', mapLabels: [{ text: 'Les Prés', x: 150, y: (l.textTop + l.textBottom) / 2, size: 10, color: '#8d9391', opacity: 1 }] })
    const name = ops.findIndex((o) => o.op === 'fillText' && o.args[0] === 'Les Prés')
    const start = ops.findIndex((o) => o.op === 'arc' && o.args[2] === START_DOT)
    expect(start).toBeGreaterThan(name)
  })
})

describe('the verdict-led Stats design (redesign, Oct 2026)', () => {
  const VERDICT = { tone: 'positive' as const, headline: 'Usual long-run pace, 7 bpm cheaper than last month.' }
  const led = { ...RUN, type: 'Base' as const, verdict: VERDICT }

  it('leads with the eyebrow in the status colour, then the verdict as a 27 px hero', () => {
    const ops = draw({ design: 'stats', activity: led })
    const eyebrow = ops.find((o) => o.op === 'fillText' && o.args[0] === 'SOLID BASE')
    expect(eyebrow?.fill).toBe(STATUS_HEX.dark.pos)
    const hero = ops.filter((o) => o.op === 'fillText' && o.font.startsWith('700 27px'))
    expect(hero.map((o) => o.args[0]).join(' ')).toBe(VERDICT.headline)
    expect(hero.length).toBeGreaterThan(1)
    expect((hero[1]!.args[2] as number) - (hero[0]!.args[2] as number)).toBe(Math.round(27 * 1.08))
  })

  it('colours a tough session warn and a logged one muted', () => {
    const caution = draw({ design: 'stats', activity: { ...led, verdict: { ...VERDICT, tone: 'caution' } } }, 'light')
    expect(caution.find((o) => o.op === 'fillText' && o.args[0] === 'TOUGH BASE')?.fill).toBe(STATUS_HEX.light.warn)
    const neutral = draw({ design: 'stats', activity: { ...led, verdict: { ...VERDICT, tone: 'neutral' } } })
    expect(neutral.find((o) => o.op === 'fillText' && o.args[0] === 'BASE LOGGED')?.fill).toBe(palette.mu)
  })

  it('replaces the zones headline with a 6 px bar and its percents', () => {
    const ops = draw({ design: 'stats', activity: led })
    const all = texts(ops)
    expect(all).not.toContain('80%')
    expect(all).not.toContain('easy · Z1–Z2')
    expect(all).toEqual(expect.arrayContaining(['Z1–Z2 80%', 'Z3 20%']))
    expect(ops.filter((o) => o.op === 'roundRect' && o.args[3] === 6)).toHaveLength(2)
  })

  it('keeps the 4-stat row', () => {
    const all = texts(draw({ design: 'stats', activity: led }))
    expect(all.slice(-11)).toEqual(['10.0', ' km', 'Distance', '57:33', 'Time', '5:44', ' /km', 'Pace', '153', ' bpm', 'Avg HR'])
  })

  it('draws no bar for a run without heart rate, the verdict still leading', () => {
    const all = texts(draw({ design: 'stats', activity: { ...led, hrZones: [] } }))
    expect(all).toContain('SOLID BASE')
    expect(all).not.toContain('No heart-rate zones for this run')
  })

  it('balances the hero over the lines it needs, never past three', () => {
    const measure = recorder().ctx
    // 7 px a character.
    expect(balanceWrap(measure, 'Usual long-run pace, 7 bpm cheaper.', 200)).toEqual(['Usual long-run pace,', '7 bpm cheaper.'])
    expect(balanceWrap(measure, 'one two three four five six', 1000)).toEqual(['one two three four five six'])
    const long = verdictHero(measure, 'A very long verdict that the coach wrote about this run and about how the legs felt all the way to the end of it today', FALLBACK_FONTS)
    expect(long.lines.length).toBeLessThanOrEqual(3)
  })

  it('labels the bar\'s first zone at its start and the last at its end, dropping one that would touch', () => {
    const w = (text: string) => text.length * 5
    expect(zoneBarLabels([{ zone: 1, percent: 24 }, { zone: 2, percent: 76 }], 16, 268, w)).toEqual([
      { zone: 1, text: 'Z1 24%', x: 16, align: 'left' },
      { zone: 2, text: 'Z2 76%', x: 284, align: 'right' },
    ])
    const crowded = zoneBarLabels([{ zone: 1, percent: 3 }, { zone: 2, percent: 90 }, { zone: 3, percent: 4 }, { zone: 4, percent: 3 }], 16, 268, w)
    // Z3 and Z4 would touch at the end: Z3's 4% keeps its label.
    expect(crowded.map((l) => l.zone)).toEqual([1, 2, 3])
  })
})

describe('the Stats design without a written verdict (design review, Oct 2026)', () => {
  it('heads with the share the run is judged on, then a row for each zone it used', () => {
    const all = texts(draw({ design: 'stats', activity: { ...RUN, type: 'Base' } }))
    expect(all).toEqual(expect.arrayContaining(['80%', 'easy · Z1–Z2', 'Z1–Z2 Easy', 'Z3 Moderate', '20%']))
    expect(all).not.toContain('Z1 Recovery')
    expect(all).not.toContain('Z5 Max')
  })

  it('draws a zone that rounds to 0% nowhere', () => {
    const ops = draw({ design: 'stats', activity: { ...RUN, hrZones: [{ zone: 2, seconds: 2400, percent: 99, minBpm: 120, maxBpm: 140 }, { zone: 4, seconds: 5, percent: 1, minBpm: 155, maxBpm: 170 }] } })
    expect(ops.some((o) => o.op === 'fill' && o.fill === palette.zones[3])).toBe(false)
    expect(texts(ops)).not.toContain('Z4 Threshold')
  })

  it('lays the legend on one row, dropping the zone names before it would wrap', () => {
    const four = { ...RUN, hrZones: [2, 3, 4, 5].map((zone) => ({ zone, seconds: 600, percent: 25, minBpm: 100, maxBpm: 200 })) }
    const legend = draw({ design: 'stats', activity: four }).filter((o) => o.op === 'fillText' && /^Z\d/.test(o.args[0] as string))
    expect(legend.map((o) => o.args[0])).toEqual(['Z1–Z2', 'Z3', 'Z4', 'Z5'])
    expect(new Set(legend.map((o) => o.args[2])).size).toBe(1)
    const two = draw({ design: 'stats' }).filter((o) => o.op === 'fillText' && /^Z\d/.test(o.args[0] as string))
    expect(two.map((o) => o.args[0])).toEqual(['Z1–Z2 Easy', 'Z3 Moderate'])
    expect(new Set(two.map((o) => o.args[2])).size).toBe(1)
  })

  it('draws the date line a step above the muted ink', () => {
    const subtitle = draw({ design: 'stats' }).find((o) => o.op === 'fillText' && (o.args[0] as string).includes('Hoenheim'))!
    expect(subtitle.fill).toBe(palette.tx)
  })

  it('draws one bar of edge-to-edge segments and a legend, no bar per zone', () => {
    const ops = draw({ design: 'stats' }).filter((o) => o.ty === layout(RUN, 'stats').middleTop)
    const segments = ops.filter((o) => o.op === 'fillRect' && (o.fill === palette.hrZones[1] || o.fill === palette.hrZones[2]))
    expect(segments).toHaveLength(2)
    const [z2, z3] = segments.map((o) => o.args as number[])
    expect(z2![0]! + z2![2]!).toBeCloseTo(z3![0]!, 6)
    expect(z2![2]! / (z2![2]! + z3![2]!)).toBeCloseTo(0.8, 6)
    expect(ops.filter((o) => o.op === 'roundRect')).toHaveLength(1)
  })

  it('is the same 4:5 card as every design, the stat row ruled off', () => {
    const stats = layout(RUN, 'stats')
    const route = layout(RUN, 'route')
    expect(W / H).toBe(4 / 5)
    expect(stats.middleH).toBe(route.middleH)
    expect(stats.ruleY).toBe(stats.statsTop - 12)
    expect(route.ruleY).toBe(stats.ruleY)
    expect(layout(RUN, 'photo').ruleY).toBeNull()
    const ops = draw({ design: 'stats' })
    expect(ops[0]).toMatchObject({ op: 'fillRect', args: [0, 0, W, H] })
    expect(ops.some((o) => o.op === 'fillRect' && o.fill === palette.line && o.args[1] === stats.ruleY && o.args[2] === W)).toBe(true)
  })

  it('spreads a 64 px headline, a 16 px bar and the legend evenly down the middle', () => {
    const { middleH } = layout(RUN, 'stats')
    const block = zoneBlockLayout(middleH, 2)
    const gaps = [block.headlineTop, block.barTop - (block.headlineTop + 64), block.legendTop - (block.barTop + 16), middleH - (block.legendTop + block.legendH)]
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0]!, 6)
    expect(block.legendH).toBe(13 * 2 + 14)

    const ops = draw({ design: 'stats', activity: { ...RUN, type: 'Base' } })
    expect(ops.find((o) => o.op === 'fillText' && o.args[0] === '80%')?.font).toContain('64px')
    expect(ops.find((o) => o.op === 'fillText' && o.args[0] === 'easy · Z1–Z2')?.font).toContain('14px')
    expect(ops.find((o) => o.op === 'roundRect')?.args.slice(3)).toEqual([16, 8])
  })

  it('keeps room between the parts on a middle too short to spread them', () => {
    const block = zoneBlockLayout(120, 3)
    expect(block.barTop - (block.headlineTop + 64)).toBe(8)
    expect(block.legendTop - (block.barTop + 16)).toBe(8)
  })

  it('says so when the run has no heart rate', () => {
    const all = texts(draw({ design: 'stats', activity: { ...RUN, hrZones: [] } }))
    expect(all).toContain('No heart-rate zones for this run')
  })
})

describe('the 9:16 story', () => {
  it('keeps the header and the stat row, the extra height going to the middle and the map', () => {
    for (const design of ['route', 'stats', 'photo'] as const) {
      const portrait = layout(RUN, design)
      const story = shareCardLayout(recorder().ctx, RUN, FALLBACK_FONTS, design, 'story')
      expect(story.height).toBeCloseTo(W * 16 / 9, 6)
      expect(story.textTop).toBe(portrait.textTop)
      expect(story.height - story.statsTop).toBe(H - portrait.statsTop)
      expect(story.middleH - portrait.middleH).toBeCloseTo(story.height - H, 6)
      expect(story.routeFrame).toEqual(portrait.routeFrame)
    }
    const ops = draw({ design: 'route', size: 'story', mapImage: {} as HTMLCanvasElement, mapPoints: [[40, 100], [200, 400], [260, 120]] })
    expect(ops.find((o) => o.op === 'drawImage')?.args.slice(1)).toEqual([0, 0, W, W * 16 / 9])
  })
})

describe('the Photo design (design review, Oct 2026)', () => {
  it('asks for a photo until there is one', () => {
    expect(texts(draw({ design: 'photo' }))).toEqual(expect.arrayContaining(['Choose photo', 'The frame shows the final crop']))
  })

  it('fills the whole card with the photo, the words over it in white', () => {
    const photo = { width: 1000, height: 800 } as HTMLImageElement
    const ops = draw({ design: 'photo', photo })
    expect(ops.find((o) => o.op === 'drawImage')?.args.slice(5)).toEqual([0, 0, W, H])
    expect(ops.find((o) => o.op === 'fillText' && o.args[0] === 'Strides 6 × 20s · 10.0 km')?.fill).toBe('#ffffff')
    expect(ops.find((o) => o.op === 'fillText' && o.args[0] === '10.0')?.fill).toBe('#ffffff')
  })

  it('darkens the top enough for the date line to read 4.5:1 on a white photo, clears, and darkens the foot under its words', () => {
    const linear = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    const contrast = (a: number, b: number) => (Math.max(linear(a), linear(b)) + 0.05) / (Math.min(linear(a), linear(b)) + 0.05)
    const alphaAt = (stops: [number, number][], at: number) => {
      const i = stops.findIndex(([offset]) => offset >= at)
      if (i <= 0) return stops[Math.max(i, 0)]![1]
      const [[o0, a0], [o1, a1]] = [stops[i - 1]!, stops[i]!]
      return a0 + ((a1 - a0) * (at - o0)) / (o1 - o0)
    }
    const long = { ...RUN, description: 'Threshold 3 × 8 min at 4:25 with 2 min jog recoveries between' }
    for (const activity of [RUN, long, { ...RUN, type: 'Threshold' as const, reps: REPS }]) {
      const l = layout(activity, 'photo')
      const foot = headerFoot(l)
      const stops = photoScrim(foot, l.textBottom)
      // White under the scrim, and the date's 85% white over that.
      const under = 255 * (1 - alphaAt(stops, (foot - 3) / H))
      expect(contrast(0.85 * 255 + 0.15 * under, under)).toBeGreaterThanOrEqual(4.5)
      expect(alphaAt(stops, 0.45)).toBe(0)
      for (let y = l.textBottom; y <= H; y += 5) expect(alphaAt(stops, y / H)).toBeGreaterThanOrEqual(0.62)
      expect(stops.at(-1)).toEqual([1, 0.8])
      expect(stops.map(([offset]) => offset)).toEqual([...stops.map(([offset]) => offset)].sort((a, b) => a - b))
    }
  })
})

describe('the place names on the Route card', () => {
  const label = (text: string, y: number) => ({ text, x: 150, y, size: 9, color: '#8d9391', opacity: 0.8 })

  it('draws them over the route, on a halo of the ground, and none a band would cut', () => {
    const l = layout()
    const inside = (l.textTop + l.textBottom) / 2
    const ops = draw({ design: 'route', mapLabels: [label('Devant-les-Ponts', inside), { ...label('Les Prés', inside + 40), x: 80 }, label('Under the header', l.textTop + 2)] })
    const name = ops.findIndex((o) => o.op === 'fillText' && o.args[0] === 'Devant-les-Ponts')
    const lastTrace = ops.map((o) => o.op).lastIndexOf('lineTo')
    expect(name).toBeGreaterThan(lastTrace)
    expect(ops.find((o) => o.op === 'strokeText' && o.args[0] === 'Devant-les-Ponts')?.stroke).toBe(sharePalette('heather', 'dark').bg)
    expect(texts(ops)).not.toContain('Under the header')
  })

  it('slides a name that would run past a side margin back inside it, beside its point', () => {
    const l = layout()
    const y = (l.textTop + l.textBottom) / 2
    const ops = draw({
      design: 'route',
      mapLabels: [
        { ...label('Longeville-lès-Metz', y), x: 40 },
        { ...label('Bellecroix', y + 20), x: W - 20 },
        { ...label('Metz', y + 40), x: W / 2 },
      ],
    })
    const at = (text: string) => ops.find((o) => o.op === 'fillText' && o.args[0] === text)!.args[1] as number
    expect(at('Metz')).toBe(W / 2)
    expect(at('Longeville-lès-Metz') - ('Longeville-lès-Metz'.length * 7) / 2).toBeCloseTo(16, 6)
    expect(at('Bellecroix') + ('Bellecroix'.length * 7) / 2).toBeCloseTo(W - 16, 6)
  })
})

describe('the route video\'s frames', () => {
  const session = { ...RUN, type: 'Threshold' as const, reps: REPS }
  const k = 0.85
  const START_DOT = 8 * k - 2.5 * k
  const FINISH_OUTLINE = 9 * k + 1 * k
  const HEAD_DOT = (8 - 2.5) * (11 / 16)
  const traceOf = (ops: Op[]) => ops.filter((o) => o.op === 'lineTo' && o.stroke !== acc)
  const arcs = (ops: Op[], radius: number) => ops.filter((o) => o.op === 'arc' && Math.abs((o.args[2] as number) - radius) < 1e-9)

  it('draws only the start marker at progress 0', () => {
    const ops = draw({ design: 'route', progress: 0 })
    expect(traceOf(ops)).toEqual([])
    expect(arcs(ops, START_DOT)).toHaveLength(1)
    expect(arcs(ops, FINISH_OUTLINE)).toEqual([])
  })

  it('draws the still card at progress 1', () => {
    for (const activity of [RUN, session]) {
      expect(JSON.stringify(draw({ design: 'route', activity, progress: 1 }))).toBe(JSON.stringify(draw({ design: 'route', activity })))
    }
  })

  it('pops the finish marker in only once the route is whole', () => {
    expect(arcs(draw({ design: 'route', progress: 0.5 }), FINISH_OUTLINE)).toEqual([])
    expect(arcs(draw({ design: 'route', progress: 0.999 }), FINISH_OUTLINE)).toEqual([])
    expect(arcs(draw({ design: 'route', progress: 1 }), FINISH_OUTLINE)).toHaveLength(1)
  })

  it('rides a head dot on the tip, in the rep colour during a rep', () => {
    const fillOf = (progress: number) => {
      const ops = draw({ design: 'route', activity: session, progress })
      const at = ops.findIndex((o) => o.op === 'arc' && Math.abs((o.args[2] as number) - HEAD_DOT) < 1e-9)
      return ops.slice(at).find((o) => o.op === 'fill')!.fill
    }
    expect(fillOf(0.1)).toBe(acc)
    expect(fillOf(0.25)).toBe(palette.zones[3])
    expect(arcs(draw({ design: 'route', progress: 1 }), HEAD_DOT)).toEqual([])
  })

  it('counts distance and time up and holds the pace back', () => {
    const all = texts(draw({ design: 'route', progress: 0.5 }))
    expect(all.slice(-11)).toEqual(['5.0', ' km', 'Distance', '28:47', 'Time', '\u2013', ' /km', 'Pace', '153', ' bpm', 'Avg HR'])
  })

  it('reads the reps legend as the run\'s phase while it draws, at each window\'s edges', () => {
    const chip = (progress: number) => {
      const ops = draw({ design: 'route', activity: session, progress })
      const head = ops.findIndex((o) => o.op === 'fillText' && o.args[0] === 'RunOmics')
      const at = ops.slice(0, head).findLastIndex((o) => o.op === 'fillText')
      const text = ops[at]!
      const bar = ops.slice(0, at).filter((o) => o.op === 'fill').at(-1)!
      return [text.args[0], text.fill, text.font.split(' ')[0], bar.fill]
    }
    const grey = palette.trace
    const rep = palette.zones[3]
    expect(chip(0.19)).toEqual(['Warm-up', palette.mu, '400', grey])
    expect(chip(0.2)).toEqual(['Rep 1 of 3', palette.tx, '600', rep])
    expect(chip(0.35)).toEqual(['Rep 1 of 3', palette.tx, '600', rep])
    expect(chip(0.36)).toEqual(['Recovery', palette.mu, '400', grey])
    expect(chip(0.44)).toEqual(['Recovery', palette.mu, '400', grey])
    expect(chip(0.45)).toEqual(['Rep 2 of 3', palette.tx, '600', rep])
    expect(chip(0.85)).toEqual(['Rep 3 of 3', palette.tx, '600', rep])
    expect(chip(0.86)).toEqual(['Cool-down', palette.mu, '400', grey])
    expect(chip(1)).toEqual(['Reps', palette.mu, '400', rep])
  })

  it('draws the pending pace as one U+2013 en dash in the value\'s font, muted, the unit kept', () => {
    const ops = draw({ design: 'route', progress: 0.5 })
    const at = ops.findIndex((o) => o.op === 'fillText' && o.args[0] === '\u2013')
    const pending = ops[at]!
    expect(ops[at + 1]!.args[0]).toBe(' /km')
    const distance = ops.find((o) => o.op === 'fillText' && o.args[0] === '5.0')!
    expect(pending.font).toBe(distance.font)
    expect(pending.fill).toBe(palette.mu)
  })
})

describe('the intro', () => {
  const alphas = (clipTime: number) => {
    const { ctx, ops } = recorder()
    const seen: number[] = []
    const drawImage = (ctx as unknown as { drawImage: (...a: unknown[]) => void }).drawImage
    ;(ctx as unknown as { drawImage: (...a: unknown[]) => void }).drawImage = (...a: unknown[]) => { seen.push(ctx.globalAlpha); drawImage(...a) }
    drawShareCard(ctx, { activity: { ...RUN, type: 'Threshold', reps: REPS }, palette, fonts: FALLBACK_FONTS, design: 'route', mapImage: {} as HTMLCanvasElement, mapPoints: [[40, 100], [200, 250], [260, 120]], progress: 0, clipTime })
    return { seen, ops }
  }

  it('starts the map at full strength, only zoomed, and the legend with it', () => {
    const { seen, ops } = alphas(0)
    expect(seen).toEqual([1])
    expect(texts(ops)).toContain('Warm-up')
  })
})

describe('arranging the place names', () => {
  const measure = recorder().ctx
  const l = layout()
  const y = (l.textTop + l.textBottom) / 2
  const name = (text: string, x: number, kind: LabelKind, ny = y) =>
    ({ text, x, y: ny, size: 10, color: '#8d9391', opacity: 1, priority: LABEL_PRIORITY[kind], kind })
  const clear = (box: [number, number, number, number], { x, y: cy, r }: { x: number; y: number; r: number }) =>
    Math.hypot(x - Math.max(box[0], Math.min(x, box[2])), cy - Math.max(box[1], Math.min(cy, box[3]))) >= r
  const across: [number, number][] = [[20, y], [280, y]]

  it('keeps the higher priority where two names collide, and drops the lower', () => {
    const drops: string[] = []
    const placed = arrangeLabels(measure, [name('Quartier Nord', 150, 'area'), name('Les Prés', 160, 'start'), name('Parc Central', 150, 'landmark', y + 60)], null, l, FALLBACK_FONTS, [], (label, reason) => drops.push(`${label.text}: ${reason}`))
    expect(placed.map((p) => p.label.text)).toEqual(['Les Prés', 'Parc Central'])
    expect(drops).toEqual(['Quartier Nord: collision'])
  })

  it('keeps the start area\'s name where the route crosses it', () => {
    const [start] = arrangeLabels(measure, [name('Les Prés', 150, 'start')], across, l, FALLBACK_FONTS)
    expect([start!.x, start!.y]).toEqual([150, y])
  })

  it('moves the start area\'s name off its marker, never drops it', () => {
    const marker = { x: 150, y, r: 7.65 + 4 }
    const [start] = arrangeLabels(measure, [name('Les Prés', 150, 'start')], across, l, FALLBACK_FONTS, [marker])
    expect(start).toBeDefined()
    expect(clear(start!.box, marker)).toBe(true)
    expect(start!.x).toBe(150)
  })

  it('leaves another area\'s name on its point, under the route', () => {
    const placed = arrangeLabels(measure, [name('Les Prés', 60, 'start', y - 60), name('Quartier Nord', 150, 'area')], across, l, FALLBACK_FONTS)
    expect(placed.find((p) => p.label.text === 'Quartier Nord')).toMatchObject({ x: 150, y })
  })

  it('drops another area\'s name that would touch a marker, and moves a landmark clear of one', () => {
    const finish = { x: 150, y, r: 8.5 + 4 }
    const placed = arrangeLabels(measure, [name('Les Prés', 60, 'start', y - 60), name('Parc', 150, 'landmark'), name('Quartier Nord', 150, 'area', y + 2)], null, l, FALLBACK_FONTS, [finish])
    expect(placed.map((p) => p.label.text)).toEqual(['Les Prés', 'Parc'])
    expect(clear(placed[1]!.box, finish)).toBe(true)
  })

  it('moves a landmark off the route when it can, and keeps it on the route when it cannot', () => {
    const [park] = arrangeLabels(measure, [name('Parc Central', 150, 'landmark')], across, l, FALLBACK_FONTS)
    expect(park!.box[3] < y - 4 || park!.box[1] > y + 4).toBe(true)
    const grid: [number, number][] = Array.from({ length: 60 }, (_, i) => [i % 2 === 0 ? 0 : W, l.textTop + i * 5])
    expect(arrangeLabels(measure, [name('Parc Central', 150, 'landmark')], grid, l, FALLBACK_FONTS)).toHaveLength(1)
  })

  it('always shows a second name: the best one dropped is nudged where it fits', () => {
    const marker = { x: 150, y, r: 12 }
    const placed = arrangeLabels(measure, [name('Les Prés', 60, 'start', y - 60), name('Quartier Nord', 150, 'area')], null, l, FALLBACK_FONTS, [marker])
    expect(placed.map((p) => p.label.text)).toEqual(['Les Prés', 'Quartier Nord'])
    expect(clear(placed[1]!.box, marker)).toBe(true)
  })

  it('warns when the card can show only one name', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    arrangeLabels(measure, [name('Les Prés', 150, 'start')], null, l, FALLBACK_FONTS)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('1 place name'))
    warn.mockRestore()
  })

  it('draws no name over the finish marker on the card', () => {
    const pts: [number, number][] = [[60, 120], [150, 200], [220, 250]]
    const ops = draw({ design: 'route', mapImage: {} as HTMLCanvasElement, mapPoints: pts, mapLabels: [
      { text: 'Les Prés', x: 60, y: 120, size: 10, color: '#8d9391', opacity: 1, kind: 'start', priority: 1 },
      { text: 'Parc', x: 150, y: 160, size: 10, color: '#8d9391', opacity: 1, kind: 'landmark', priority: 3 },
      { text: 'Au Bout', x: 220, y: 250, size: 10, color: '#8d9391', opacity: 1 },
    ] })
    expect(texts(ops)).not.toContain('Au Bout')
    expect(shareMarkerRadius('finish', palette)).toBeCloseTo(8.5, 9)
    expect(markerObstacles(pts, palette).map((o) => o.r)).toEqual([shareMarkerRadius('start', palette) + 4, 8.5 + 4])
  })

  it('breaks a long park name over two balanced lines', () => {
    const [park] = arrangeLabels(measure, [name('Forêt de la Clairière', 150, 'landmark')], null, l, FALLBACK_FONTS)
    expect(park!.lines).toEqual(['Forêt de la', 'Clairière'])
  })
})
