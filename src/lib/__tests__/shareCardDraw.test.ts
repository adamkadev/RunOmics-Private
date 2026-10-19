import { describe, expect, it } from 'vitest'
import { balanceLines, balanceWrap, drawShareCard, FALLBACK_FONTS, headerFoot, photoScrim, shareCardLayout, slicePolyline, verdictHero, zoneBarLabels, zoneBlockLayout, type ShareCardScene } from '@/lib/shareCardDraw'
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
    const stats = ['10.0', ' km', 'Distance', '57:33', 'Time', '5:44', ' /km', 'Pace', '153', ' bpm', 'Avg HR']
    for (const design of ['route', 'stats', 'photo'] as const) {
      const all = texts(draw({ design }))
      const at = all.indexOf('RunOmics')
      expect(all.slice(at, at + 2)).toEqual(header)
      expect(all[at + 2]).toMatch(/ · Hoenheim$/)
      expect(all.slice(-stats.length)).toEqual(stats)
    }
  })

  // Design review, Oct 2026: the accent is a point marker's, never a trace or a word.
  // 3.0.1 polish (mock 3f): the accent is the logo mark and the trace, never a word.
  it('keeps the accent to the logo mark and the route: off every word and every marker', () => {
    for (const activity of [RUN, { ...RUN, type: 'Threshold' as const, reps: REPS }]) {
      const ops = draw({ design: 'route', activity })
      expect(ops.filter((o) => o.op === 'fillText' && o.fill === acc)).toEqual([])
      expect(ops.filter((o) => o.op === 'fill' && o.fill === acc)).toEqual([])
    }
    // The mark is three accent strokes; a plain run's trace is a fourth.
    expect(draw({ design: 'route' }).filter((o) => o.op === 'stroke' && o.stroke === acc)).toHaveLength(4)
    const reps = draw({ design: 'route', activity: { ...RUN, type: 'Threshold' as const, reps: REPS } })
    expect(reps.filter((o) => o.op === 'stroke' && o.stroke === acc)).toHaveLength(3)
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

describe('the route (redesign, Oct 2026)', () => {
  const strokes = (ops: Op[]) => ops.filter((o) => o.op === 'stroke')
  /** The route's own points: every lineTo but the lockup's. */
  const trace = (ops: Op[]) => ops.filter((o) => o.op === 'lineTo' && o.stroke !== acc).map((o) => o.args as [number, number])

  // 3.0.1 polish (mock 3f): the trace is the accent, as the app draws it.
  it('draws one trace in the accent, with no legend', () => {
    for (const mode of ['dark', 'light'] as const) {
      const colours = sharePalette('violet', mode)
      const ops = draw({ design: 'route' }, mode)
      const lines = strokes(ops).map((o) => o.stroke)
      expect(lines).toContain(colours.acc)
      expect(colours.route).toBe(colours.acc)
      expect(lines.filter((c) => colours.zones.includes(c) || c === colours.mu)).toEqual([])
      expect(texts(ops)).not.toContain('Reps')
    }
    expect(SHARE_MARKER_HEX.dark).toBe('#f2f4f3')
  })

  // At the owner's request (3.0): an interval session keeps its reps marked.
  it('draws an interval session grey, its reps over it in Z4 and 1.6x as wide, under a "Reps" legend', () => {
    const run = { ...RUN, type: 'Threshold' as const, reps: REPS }
    const ops = draw({ design: 'route', activity: run })
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

  it('fits the route between the header and the stats, 16 px clear of both', () => {
    const l = layout()
    expect(l.routeFrame.top).toBe(headerFoot(l) + 16)
    expect(l.routeFrame.bottom).toBe(H - l.textBottom + 16)
    for (const [, y] of trace(draw({ design: 'route' }))) {
      expect(y).toBeGreaterThanOrEqual(l.routeFrame.top - 1e-6)
      expect(y).toBeLessThanOrEqual(H - l.routeFrame.bottom + 1e-6)
    }
  })

  it('keeps the route clear of a two-line title and of the rep pace', () => {
    const long = { ...RUN, sessionTitle: 'Threshold · 3 × 8′ @ 4:25 then six strides on the flat', type: 'Threshold' as const, reps: REPS }
    const l = layout(long)
    expect(l.routeFrame.top).toBeGreaterThan(layout().routeFrame.top)
    expect(l.routeFrame.bottom).toBeGreaterThan(layout().routeFrame.bottom)
    for (const [, y] of trace(draw({ design: 'route', activity: long }))) {
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

  // 3.0.1 polish (mock 3f): the strip is the card's own ground, ruled off edge to edge.
  it('rules the stat row off and sets it on the card colour', () => {
    const { ruleY } = layout()
    const ops = draw({ design: 'route' })
    expect(ops.some((o) => o.op === 'fillRect' && o.fill === palette.card && o.args[1] === ruleY && o.args[0] === 0 && o.args[2] === W)).toBe(true)
    expect(ops.some((o) => o.op === 'fillRect' && o.fill === palette.line && o.args[1] === ruleY && o.args[0] === 0 && o.args[2] === W && o.args[3] === 1)).toBe(true)
  })

  // The Activity map's markers (routeMarkers) at the card's 0.85: the finish's outline, the loop's, the start's dot.
  const k = 0.85
  const FINISH_OUTLINE = 9 * k + 1 * k
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

  it('draws a loop as one combined marker on the start, never two stacked', () => {
    const loop = { ...RUN, route: [...RUN.route!, RUN.route![0]!] as [number, number][] }
    const ops = draw({ design: 'route', activity: loop })
    expect(arcsOf(ops, LOOP_OUTLINE)).toHaveLength(1)
    expect(arcsOf(ops, FINISH_OUTLINE)).toEqual([])
    expect(arcsOf(ops, START_DOT)).toEqual([])
    // Its ring is the marker's own colour.
    expect(ops.filter((o) => o.op === 'fill' && o.fill === palette.marker)).toHaveLength(1)
  })
})

describe('the verdict-led Stats design (redesign, Oct 2026)', () => {
  const VERDICT = { tone: 'positive' as const, headline: 'Usual long-run pace, 7 bpm cheaper than last month.' }
  const led = { ...RUN, type: 'Base' as const, verdict: VERDICT }

  it('leads with the eyebrow in the status colour, then the verdict as a 27 px hero', () => {
    const ops = draw({ design: 'stats', activity: led })
    const eyebrow = ops.find((o) => o.op === 'fillText' && o.args[0] === 'STRONG SESSION')
    expect(eyebrow?.fill).toBe(STATUS_HEX.dark.pos)
    const hero = ops.filter((o) => o.op === 'fillText' && o.font.startsWith('700 27px'))
    expect(hero.map((o) => o.args[0]).join(' ')).toBe(VERDICT.headline)
    expect(hero.length).toBeGreaterThan(1)
    // A 1.08 line height.
    expect((hero[1]!.args[2] as number) - (hero[0]!.args[2] as number)).toBe(Math.round(27 * 1.08))
  })

  it('colours a tough session warn and a logged one muted', () => {
    const caution = draw({ design: 'stats', activity: { ...led, verdict: { ...VERDICT, tone: 'caution' } } }, 'light')
    expect(caution.find((o) => o.op === 'fillText' && o.args[0] === 'TOUGH SESSION')?.fill).toBe(STATUS_HEX.light.warn)
    const neutral = draw({ design: 'stats', activity: { ...led, verdict: { ...VERDICT, tone: 'neutral' } } })
    expect(neutral.find((o) => o.op === 'fillText' && o.args[0] === 'SESSION LOGGED')?.fill).toBe(palette.mu)
  })

  it('replaces the zones headline with a 6 px bar and its percents', () => {
    const ops = draw({ design: 'stats', activity: led })
    const all = texts(ops)
    expect(all).not.toContain('80%')
    expect(all).not.toContain('easy · Z1–Z2')
    expect(all).toEqual(expect.arrayContaining(['Z2 80%', 'Z3 20%']))
    expect(ops.filter((o) => o.op === 'roundRect' && o.args[3] === 6)).toHaveLength(2)
  })

  it('keeps the 4-stat row', () => {
    const all = texts(draw({ design: 'stats', activity: led }))
    expect(all.slice(-11)).toEqual(['10.0', ' km', 'Distance', '57:33', 'Time', '5:44', ' /km', 'Pace', '153', ' bpm', 'Avg HR'])
  })

  it('draws no bar for a run without heart rate, the verdict still leading', () => {
    const all = texts(draw({ design: 'stats', activity: { ...led, hrZones: [] } }))
    expect(all).toContain('STRONG SESSION')
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
    expect(all).toEqual(expect.arrayContaining(['80%', 'easy · Z1–Z2', 'Z2 Easy', 'Z3 Aerobic', '20%']))
    expect(all).not.toContain('Z1 Recovery')
    expect(all).not.toContain('Z5 Max')
  })

  it('draws a zone that rounds to 0% nowhere', () => {
    const ops = draw({ design: 'stats', activity: { ...RUN, hrZones: [{ zone: 2, seconds: 2400, percent: 99, minBpm: 120, maxBpm: 140 }, { zone: 4, seconds: 5, percent: 1, minBpm: 155, maxBpm: 170 }] } })
    expect(ops.some((o) => o.op === 'fill' && o.fill === palette.zones[3])).toBe(false)
    expect(texts(ops)).not.toContain('Z4 Threshold')
  })

  // Design review, Oct 2026: one bar and a two-column legend, not a bar and then a bar per zone.
  it('draws one bar of edge-to-edge segments and a legend, no bar per zone', () => {
    const ops = draw({ design: 'stats' }).filter((o) => o.ty === layout(RUN, 'stats').middleTop)
    const segments = ops.filter((o) => o.op === 'fillRect' && (o.fill === palette.zones[1] || o.fill === palette.zones[2]))
    expect(segments).toHaveLength(2)
    const [z2, z3] = segments.map((o) => o.args as number[])
    expect(z2![0]! + z2![2]!).toBeCloseTo(z3![0]!, 6)
    expect(z2![2]! / (z2![2]! + z3![2]!)).toBeCloseTo(0.8, 6)
    expect(ops.filter((o) => o.op === 'roundRect')).toHaveLength(1)
  })

  // Design review, Oct 2026: one 4:5 box on every tab, the stat row ruled off but under a photo.
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

  // Round 2: the block sat small in the middle, ~150 px empty above it.
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

describe('the Photo design (design review, Oct 2026)', () => {
  it('asks for a photo until there is one', () => {
    expect(texts(draw({ design: 'photo' }))).toEqual(expect.arrayContaining(['Choose photo', 'This frame is the exact crop']))
  })

  it('fills the whole card with the photo, the words over it in white', () => {
    const photo = { width: 1000, height: 800 } as HTMLImageElement
    const ops = draw({ design: 'photo', photo })
    expect(ops.find((o) => o.op === 'drawImage')?.args.slice(5)).toEqual([0, 0, W, H])
    expect(ops.find((o) => o.op === 'fillText' && o.args[0] === 'Strides 6 × 20s')?.fill).toBe('#ffffff')
    expect(ops.find((o) => o.op === 'fillText' && o.args[0] === '10.0')?.fill).toBe('#ffffff')
  })

  // Round 2: the title and date sat on a bright sky with no scrim behind them.
  it('darkens the top enough for the date line to read 4.5:1 on a white photo, then clears', () => {
    const linear = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    const contrast = (a: number, b: number) => (Math.max(linear(a), linear(b)) + 0.05) / (Math.min(linear(a), linear(b)) + 0.05)
    const alphaAt = (stops: [number, number][], at: number) => {
      const i = stops.findIndex(([offset]) => offset >= at)
      if (i <= 0) return stops[Math.max(i, 0)]![1]
      const [[o0, a0], [o1, a1]] = [stops[i - 1]!, stops[i]!]
      return a0 + ((a1 - a0) * (at - o0)) / (o1 - o0)
    }
    const long = { ...RUN, description: 'Threshold 3 × 8 min at 4:25 with 2 min jog recoveries between' }
    for (const activity of [RUN, long]) {
      const foot = headerFoot(layout(activity))
      const stops = photoScrim(foot)
      // White under the scrim, and the date's 85% white over that.
      const under = 255 * (1 - alphaAt(stops, (foot - 3) / H))
      expect(contrast(0.85 * 255 + 0.15 * under, under)).toBeGreaterThanOrEqual(4.5)
      expect(alphaAt(stops, 0.45)).toBe(0)
      expect(stops.at(-1)).toEqual([1, 0.78])
    }
  })
})
