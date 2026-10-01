import { cleanStream, paddedDomain } from '@/domain/activity/cleanStream'
import { smoothStream } from '@/domain/activity/smoothStream'
import { formatClock, formatNumber } from '@/lib/formatters'
import { paceAxis } from '@/lib/chartAxis'
import { t } from '@/i18n'

/** Every lane is drawn in a 1000 x 90 box and stretched to the card (v4.17). */
export const VIEW_WIDTH = 1000
export const LANE_HEIGHT = 90
/** Elevation is only context: a 40 px strip under the three lanes. */
export const ELEVATION_HEIGHT = 40
/** The line stays this far off the lane's top and bottom edges. */
const LANE_PAD = 4
/** A zone band thinner than this has no room for its 11 px label. */
const BAND_LABEL_MIN = 12

export type LaneKey = 'hr' | 'pace' | 'cadence' | 'elevation'
export type ZoneNumber = 1 | 2 | 3 | 4 | 5

/** A zone's stretch of a lane, in the lane's own units; an open end is ±Infinity. */
export interface ZoneBand {
  zone: ZoneNumber
  from: number
  to: number
}

/**
 * The athlete's zones, as the lanes draw them behind the line: heart rate's
 * lower edge of Z1 to Z5 (the run's own, from the watch), and each pace
 * zone's fastest and slowest pace (from threshold pace).
 */
export interface ChartZones {
  hrMinBpm: number[] | null
  pace: { zone: ZoneNumber; fastest: number; slowest: number }[] | null
}

/**
 * The zones the lanes are banded with. Heart rate takes the run's own zones,
 * as the watch scored it, and the athlete's current ones when the run has
 * none; pace takes the zones built from threshold pace, the Athlete page's.
 */
export function chartZones(
  runZones: readonly { zone: number; minBpm: number }[] | null | undefined,
  athleteBounds: readonly number[] | null | undefined,
  pace: readonly { hrZone: number; paceMinSecPerKm: number; paceMaxSecPerKm: number }[] | null | undefined,
): ChartZones | null {
  const own = [...(runZones ?? [])].sort((a, b) => a.zone - b.zone).map((z) => z.minBpm)
  const hrMinBpm = own.length >= 5 && own.every((v) => v > 0) ? own.slice(0, 5) : athleteBounds && athleteBounds.length >= 5 ? [...athleteBounds].slice(0, 5) : null
  const paceZones = pace && pace.length > 0
    ? pace.map((z) => ({ zone: Math.min(5, Math.max(1, z.hrZone)) as ZoneNumber, fastest: z.paceMinSecPerKm, slowest: z.paceMaxSecPerKm }))
    : null
  return hrMinBpm || paceZones ? { hrMinBpm, pace: paceZones } : null
}

export interface Lane {
  key: LaneKey
  label: string
  /** What the lane is counted in, beside its name ("bpm", "/km · higher is faster"). */
  unit: string
  /** The unit after a reading ("142 bpm"). */
  valueUnit: string
  /** The recorded stream, cleaned of what the watch got wrong: the Raw line. */
  values: (number | null)[]
  /** The Smoothed line: a moving average, pace through a rolling median first. */
  smoothed: (number | null)[]
  domain: [number, number]
  /** Pace: the smaller number is the higher point, so faster is up. */
  reversed: boolean
  /** The lane's summary - avg, max or best - computed from the recorded samples. */
  summary: string
  average: number | null
  format: (v: number) => string
  bands: ZoneBand[]
}

export interface ChartStackInput {
  distanceKm: number
  hrSamples: number[] | null
  avgHr: number | null
  paceSamples: number[] | null
  avgPaceSecPerKm: number | null
  cadenceSamples: number[] | null
  avgCadence: number | null
  elevationProfile: number[] | null
  elevationGain: number | null
  zones?: ChartZones | null
}

function present(values: (number | null)[]): number[] {
  return values.filter((v): v is number => v !== null)
}

/**
 * The lane's scale in round steps, from its smoothed line: HR 120-170 in
 * tens, pace 4:40-7:00 in twenty seconds. The raw line shares it, so the
 * toggle never rescales the lane; a raw spike past the end is clipped there.
 */
export function niceDomain(values: (number | null)[], step: number, minSpan: number): [number, number] | null {
  const seen = present(values)
  if (seen.length === 0) return null
  const pad = step * 0.15
  let lo = Math.floor((Math.min(...seen) - pad) / step) * step
  let hi = Math.ceil((Math.max(...seen) + pad) / step) * step
  while (hi - lo < minSpan) {
    lo -= step / 2
    hi += step / 2
  }
  return [lo, hi]
}

function hrBands(minBpm: number[] | null | undefined): ZoneBand[] {
  if (!minBpm || minBpm.length < 5) return []
  return minBpm.slice(0, 5).map((from, i) => ({
    zone: (i + 1) as ZoneNumber,
    from,
    to: minBpm[i + 1] ?? Infinity,
  }))
}

/**
 * Pace zones as continuous stretches: each runs to the next one's fastest
 * pace, Z5 takes everything faster and Z1 everything slower than easy.
 */
function paceBands(zones: ChartZones['pace'] | undefined): ZoneBand[] {
  if (!zones || zones.length === 0) return []
  const sorted = [...zones].sort((a, b) => a.fastest - b.fastest)
  const bands: ZoneBand[] = sorted.map((z, i) => ({
    zone: z.zone,
    from: i === 0 ? -Infinity : z.fastest,
    to: sorted[i + 1]?.fastest ?? z.slowest + 1,
  }))
  const slowest = sorted[sorted.length - 1]!
  if (slowest.zone > 1) bands.push({ zone: 1, from: slowest.slowest + 1, to: Infinity })
  return bands
}

/**
 * The stack's lanes, cleaned, smoothed and scaled. Pure, and costly enough -
 * a cleanup and a smoothing pass over every sample of every stream - that the
 * component builds it once per activity rather than on each pointer move.
 *
 * Summaries come from the recorded samples, whichever line is drawn, except
 * HR's and pace's averages, which are the stat row's so the two can't
 * disagree. A "best" is never slower than the average beside it.
 */
export function buildLanes(input: ChartStackInput): Lane[] {
  const { distanceKm, hrSamples, paceSamples, cadenceSamples, elevationProfile, elevationGain, zones } = input
  const c = t.activity.charts
  const lanes: Lane[] = []

  function push(
    lane: Omit<Lane, 'domain' | 'summary' | 'average' | 'smoothed'> & {
      despike?: boolean
      domain: (smoothed: (number | null)[]) => [number, number] | null
      summarize: (stats: { average: number; min: number; max: number }) => string
      recordedAverage?: number | null
    },
  ) {
    const { despike, domain: scale, summarize, recordedAverage = null, ...rest } = lane
    const smoothed = smoothStream(rest.values, { despike })
    const domain = scale(smoothed)
    if (!domain) return
    const seen = present(rest.values)
    const sampleAverage = seen.length > 0 ? seen.reduce((a, b) => a + b, 0) / seen.length : null
    const average = sampleAverage !== null ? (recordedAverage ?? sampleAverage) : null
    const summary = average !== null ? summarize({ average, min: Math.min(...seen), max: Math.max(...seen) }) : ''
    lanes.push({ ...rest, smoothed, domain, summary, average })
  }

  if (hrSamples) {
    push({
      key: 'hr',
      label: c.heartRate,
      unit: t.units.bpm,
      valueUnit: t.units.bpm,
      values: cleanStream(hrSamples, { min: 60, max: 230 }),
      reversed: false,
      format: (v) => `${Math.round(v)}`,
      domain: (s) => niceDomain(s, 10, 30),
      summarize: ({ average, max }) => `${c.avg} ${Math.round(average)} · ${c.max} ${Math.round(max)}`,
      // The stat row's average (G10): the downsampled stream read 113 beside
      // the row's 115 for the same run.
      recordedAverage: input.avgHr,
      bands: hrBands(zones?.hrMinBpm),
    })
  }

  if (paceSamples) {
    push({
      key: 'pace',
      label: c.pace,
      unit: c.paceUnitHint,
      valueUnit: t.units.perKm,
      values: cleanStream(paceSamples, { min: 150, max: 900, settleKm: 0.1, distanceKm, spikeFloor: 90 }),
      // Faster is up, on this chart as on every pace axis (lib/chartAxis).
      reversed: paceAxis().reversed,
      despike: true,
      format: (v) => formatClock(Math.round(v)),
      domain: (s) => niceDomain(s, 20, 60),
      // "best" is the fastest recorded sample, which the watch already
      // averages over about 30 s, so it says so (v5.6 #4). Never a "best"
      // slower than the average beside it: an even run's samples can sit
      // above its moving pace, and then it's left out.
      summarize: ({ average, min }) =>
        Math.round(min) < Math.round(average)
          ? `${c.avg} ${formatClock(Math.round(average))} · ${c.bestSmoothed} ${formatClock(Math.round(min))}`
          : `${c.avg} ${formatClock(Math.round(average))}`,
      // The Overview's moving pace (v5.5 #6): the samples' plain mean read
      // 5:38 beside the header's 5:33 for the same run.
      recordedAverage: input.avgPaceSecPerKm,
      bands: paceBands(zones?.pace),
    })
  }

  if (cadenceSamples) {
    push({
      key: 'cadence',
      label: c.cadence,
      unit: t.units.spm,
      valueUnit: t.units.spm,
      values: cleanStream(cadenceSamples, { min: 100, max: 250, spikeFloor: 25 }),
      reversed: false,
      format: (v) => `${Math.round(v)}`,
      domain: (s) => niceDomain(s, 5, 15),
      summarize: ({ average }) => `${c.avg} ${Math.round(average)}`,
      bands: [],
    })
  }

  if (elevationProfile) {
    push({
      key: 'elevation',
      label: c.elevation,
      unit: t.units.m,
      valueUnit: t.units.m,
      values: cleanStream(elevationProfile, { spikeFloor: 60 }),
      reversed: false,
      format: (v) => `${Math.round(v)}`,
      // A 5 m wobble drawn edge to edge reads as a mountain range.
      domain: (s) => paddedDomain(s, 20),
      summarize: () => (elevationGain != null ? c.elevationGain(formatNumber(Math.round(elevationGain), 0)) : ''),
      bands: [],
    })
  }

  return lanes
}

/** A lane's share of its height at a value: 0 at the top, 1 at the floor. */
function share(lane: Pick<Lane, 'domain' | 'reversed'>, value: number): number {
  const [lo, hi] = lane.domain
  const s = hi > lo ? (value - lo) / (hi - lo) : 0.5
  return lane.reversed ? s : 1 - s
}

/**
 * How far down its lane a value sits, in the lane's 90-unit box: the domain
 * spread over the plot, flipped for pace, and clipped 2 units inside the
 * edges so a raw spike past the scale still shows where it went.
 */
export function laneY(lane: Pick<Lane, 'domain' | 'reversed'>, value: number): number {
  const y = LANE_PAD + share(lane, value) * (LANE_HEIGHT - 2 * LANE_PAD)
  return Math.min(LANE_HEIGHT - 2, Math.max(2, y))
}

/** The elevation strip's height at a value: its floor is the strip's bottom. */
export function elevationY(lane: Pick<Lane, 'domain'>, value: number): number {
  const [lo, hi] = lane.domain
  const s = hi > lo ? (value - lo) / (hi - lo) : 0.5
  return ELEVATION_HEIGHT - 2 - s * (ELEVATION_HEIGHT - 6)
}

function x(i: number, n: number): string {
  return (n > 1 ? (i / (n - 1)) * VIEW_WIDTH : 0).toFixed(1)
}

/** The line through a series, lifted at every gap rather than drawn across it. */
export function linePath(values: (number | null)[], y: (v: number) => number): string {
  let d = ''
  let pen = false
  values.forEach((v, i) => {
    if (v == null) {
      pen = false
      return
    }
    d += `${pen ? 'L' : 'M'}${x(i, values.length)} ${y(v).toFixed(1)} `
    pen = true
  })
  return d.trim()
}

/** A filled area under each unbroken stretch of the series, down to `floor`. */
export function areaPath(values: (number | null)[], y: (v: number) => number, floor: number): string {
  const parts: string[] = []
  let run: string[] = []
  let first = 0
  const close = (last: number) => {
    if (run.length) parts.push(`M${x(first, values.length)} ${floor} L${run.join(' L')} L${x(last, values.length)} ${floor} Z`)
    run = []
  }
  values.forEach((v, i) => {
    if (v == null) {
      close(i - 1)
      return
    }
    if (run.length === 0) first = i
    run.push(`${x(i, values.length)} ${y(v).toFixed(1)}`)
  })
  close(values.length - 1)
  return parts.join(' ')
}

/** A thin vertical rule at every whole kilometre, the start and the finish left out. */
export function kmTicksPath(distanceKm: number, height = LANE_HEIGHT): string {
  if (distanceKm <= 1) return ''
  const ticks: string[] = []
  for (let km = 1; km < distanceKm - 0.05; km++) {
    const at = ((km / distanceKm) * VIEW_WIDTH).toFixed(1)
    ticks.push(`M${at} 0 L${at} ${height}`)
  }
  return ticks.join(' ')
}

/** A band's top and height in the lane's box; null when the lane never reaches it. */
export function bandRect(lane: Pick<Lane, 'domain' | 'reversed'>, band: ZoneBand): { top: number; height: number; labelled: boolean } | null {
  const edge = (v: number) => {
    if (v === Infinity) return lane.reversed ? LANE_HEIGHT : 0
    if (v === -Infinity) return lane.reversed ? 0 : LANE_HEIGHT
    return Math.min(LANE_HEIGHT, Math.max(0, LANE_PAD + share(lane, v) * (LANE_HEIGHT - 2 * LANE_PAD)))
  }
  // The same scale as the line, clipped to the lane: a zone that runs past
  // the domain fills the padding at that edge too.
  const a = edge(band.from)
  const b = edge(band.to)
  const top = Math.min(a, b)
  const height = Math.max(a, b) - top
  if (height < 0.5) return null
  return { top, height, labelled: height >= BAND_LABEL_MIN }
}

/**
 * The sample a readout refers to. The mark and the number are taken from the
 * same index here so a lane can never draw its dot at one place and report the
 * value from another.
 */
export function sampleAt(
  values: (number | null)[],
  fraction: number,
  distanceKm: number,
): { km: number; value: number | null } | null {
  const last = values.length - 1
  if (last < 0) return null
  const i = Math.min(Math.max(Math.round(fraction * last), 0), last)
  return { km: last > 0 ? (i / last) * distanceKm : 0, value: values[i] ?? null }
}

/**
 * Time into the run at a point on the stack, from the pace samples: each one
 * covers an equal share of the distance, so the time to reach a sample is the
 * sum of pace x distance before it. A gap in the stream takes the run's
 * average pace. Null without pace samples - a guess from the total duration
 * would assume an even pace the run did not have.
 */
export function elapsedAt(pace: Lane | undefined, fraction: number, distanceKm: number): number | null {
  if (!pace || pace.average === null || pace.values.length < 2) return null
  const last = pace.values.length - 1
  const upTo = Math.min(Math.max(Math.round(fraction * last), 0), last)
  const stepKm = distanceKm / last
  let seconds = 0
  for (let i = 0; i < upTo; i++) seconds += (pace.values[i] ?? pace.average) * stepKm
  return seconds
}
