import type { CycleCheckpoint, DatedValue, Pair } from '@/application/usecases/GetCycleCheckpoint'
import type { NumberRange } from '@/domain/coaching/types'
import { daysBetween, shiftDays } from '@/domain/training/cycleCheckpoint'
import { deltaTone, type DeltaContext, type DeltaMetric, type DeltaTone } from '@/lib/deltaTone'
import { MINUS, PLUS_MINUS, formatClock, formatDate, formatDateRange, formatDecimal, formatDelta, formatDeltaFixed, formatDuration } from '@/lib/formatters'
import { t } from '@/i18n'

export interface CompareRow {
  key: string
  label: string
  /** Null when this cycle has no reading yet. */
  current: string | null
  unit: string | null
  previous: string | null
  delta: string | null
  direction: 'up' | 'down' | null
  tone: DeltaTone
  /** Scored rows make the better / worse / level count; threshold HR has no better direction. */
  scored: boolean
  note: string | null
  /** What stands in for the delta when one side is missing. */
  missing: string | null
  /** Said on its own in place of the value, the comparison and the delta when this cycle has no reading. */
  absent: string | null
}

export interface CompareSection {
  key: 'volume' | 'threshold' | 'efficiency' | 'markers' | 'recovery'
  title: string
  about: string
  caption: string | null
  rows: CompareRow[]
}

export interface CheckpointPageView {
  /** Null under a race plan; general preparation adds the block's name on the device, as Plan does. */
  eyebrow: string | null
  generalPreparation: boolean
  /** The cycle compared with; the current cycle's dates are on the status card. */
  range: string | null
  status: {
    title: string
    detail: string | null
    week: number
    /** Null for rolling windows, which have no week to mark. */
    segments: number | null
    note: string | null
  }
  summary: Record<DeltaTone, number> | null
  sections: CompareSection[]
}

const s = () => t.checkpoint

const bare = (iso: string) => formatDate(iso, { style: 'bare' })

function signedSeconds(seconds: number): string {
  const rounded = Math.round(seconds)
  const abs = Math.abs(rounded)
  return `${rounded < 0 ? MINUS : rounded > 0 ? '+' : PLUS_MINUS}${abs < 60 ? `${abs} s` : formatClock(abs)}`
}

interface RowSpec<T> {
  key: string
  label: string
  pair: Pair<T>
  value: (v: T) => number
  format: (v: T) => string
  unit?: string | null
  delta: (d: number) => string
  metric: DeltaMetric | null
  context?: DeltaContext
  note?: (pair: Pair<T>) => string | null
  /** Said in place of the whole row when this cycle has no reading. */
  absent?: (pair: Pair<T>) => string
}

function row<T>(spec: RowSpec<T>): CompareRow {
  const { pair } = spec
  const current = pair.current === null ? null : spec.value(pair.current)
  // A zero before is no baseline: "40 min vs 0" would count as better.
  const baseline = pair.previous === null || spec.value(pair.previous) === 0 ? null : pair.previous
  const previous = baseline === null ? null : spec.value(baseline)
  const change = current !== null && previous !== null ? current - previous : null
  const absent = current === null && spec.absent ? spec.absent(pair) : null
  const missing = absent !== null ? null : current === null ? s().notEnough : previous === null ? s().nothingBefore : null
  return {
    key: spec.key,
    label: spec.label,
    current: pair.current === null ? null : spec.format(pair.current),
    unit: spec.unit ?? null,
    previous: baseline === null ? null : spec.format(baseline),
    delta: change === null ? null : spec.delta(change),
    direction: change === null || change === 0 ? null : change > 0 ? 'up' : 'down',
    tone: spec.metric && change !== null ? deltaTone(spec.metric, change, { value: current!, ...spec.context }) : 'flat',
    scored: spec.metric !== null,
    note: spec.note?.(pair) ?? null,
    missing,
    absent,
  }
}

const number = (v: number) => v

/** A reading from before the cycle began is Garmin's last word, not a new one: it says so. */
function staleNote(start: string) {
  return (pair: Pair<DatedValue>) => (pair.current && pair.current.date < start ? s().lastReading(bare(pair.current.date)) : null)
}

const guideText = (range: NumberRange) => `${formatClock(range.min)}–${formatClock(range.max)}`
const guideMiddle = (range: NumberRange) => (range.min + range.max) / 2

function sections(data: CycleCheckpoint): CompareSection[] {
  const m = s().metrics
  const sec = s().sections
  const { cycle } = data
  const out: CompareSection[] = []

  if (data.volume) {
    out.push({
      key: 'volume',
      ...sec.volume,
      caption: cycle.complete ? s().perWeek : s().perWeekSoFar(cycle.completeWeeks),
      rows: [
        row({ key: 'distance', label: m.distance, pair: data.volume.kmPerWeek, value: number, format: (v) => formatDecimal(v, 1), unit: t.units.km, delta: (d) => formatDeltaFixed(d, 1, t.units.km), metric: 'distance' }),
        row({ key: 'runs', label: m.runs, pair: data.volume.runsPerWeek, value: number, format: (v) => formatDecimal(v, 1), unit: s().units.runs, delta: (d) => formatDeltaFixed(d, 1), metric: 'distance' }),
      ],
    })
  }

  if (data.threshold) {
    out.push({
      key: 'threshold',
      ...sec.threshold,
      caption: null,
      rows: [
        row({
          key: 'thresholdTime',
          label: m.thresholdTime,
          pair: data.threshold.minutesPerWeek,
          value: number,
          format: String,
          unit: t.units.min,
          delta: (d) => formatDelta(d, t.units.min),
          metric: 'distance',
          note: () => (data.threshold?.soFar?.sessions ? s().soFar(data.threshold.soFar.minutes, data.threshold.soFar.sessions) : null),
        }),
        ...data.threshold.guides.map((guide) =>
          row({ key: `guide-${guide.repClass}`, label: m.guide[guide.repClass], pair: guide, value: guideMiddle, format: guideText, unit: t.units.perKm, delta: signedSeconds, metric: 'pace' })),
      ],
    })
  }

  const efficiencyRows: CompareRow[] = []
  if (data.efficiency) {
    efficiencyRows.push(row({ key: 'efficiency', label: m.efficiency, pair: data.efficiency, value: number, format: (v) => formatDecimal(v, 2), unit: s().units.perBeat, delta: (d) => formatDeltaFixed(d, 2), metric: 'efficiency' }))
  }
  if (data.easyHr) {
    const pace = data.easyHr.paceSecPerKm
    efficiencyRows.push(row({ key: 'easyHr', label: pace === null ? m.easyHrNoPace : m.easyHr(formatClock(pace)), pair: data.easyHr, value: number, format: String, unit: t.units.bpm, delta: (d) => formatDelta(d, t.units.bpm), metric: 'heartRate' }))
  }
  if (efficiencyRows.length > 0) out.push({ key: 'efficiency', ...sec.efficiency, caption: null, rows: efficiencyRows })

  const markerRows: CompareRow[] = []
  if (data.fiveK) {
    markerRows.push(row({
      key: 'fiveK',
      label: m.fiveK,
      pair: data.fiveK,
      value: (check) => check.seconds,
      format: (check) => formatDuration(check.seconds),
      delta: signedSeconds,
      metric: 'race',
      absent: (pair) => (pair.previous ? `${s().noCheck} · ${s().lastCheck(bare(pair.previous.date), formatDuration(pair.previous.seconds))}` : s().noCheck),
      note: (pair) => (pair.current ? bare(pair.current.date) : null),
    }))
  }
  if (data.vo2max) {
    markerRows.push(row({ key: 'vo2max', label: m.vo2max, pair: data.vo2max, value: (r) => r.value, format: (r) => formatDecimal(r.value, 1), delta: (d) => formatDeltaFixed(d, 1), metric: 'vo2max', note: staleNote(cycle.current.start) }))
  }
  if (data.thresholdPace) {
    markerRows.push(row({ key: 'thresholdPace', label: m.thresholdPace, pair: data.thresholdPace, value: (r) => r.value, format: (r) => formatClock(r.value), unit: t.units.perKm, delta: signedSeconds, metric: 'pace', note: staleNote(cycle.current.start) }))
  }
  if (data.lthr) {
    markerRows.push(row({ key: 'lthr', label: m.lthr, pair: data.lthr, value: (r) => r.value, format: (r) => String(r.value), unit: t.units.bpm, delta: (d) => formatDelta(d, t.units.bpm), metric: null, note: staleNote(cycle.current.start) }))
  }
  if (markerRows.length > 0) out.push({ key: 'markers', ...sec.markers, caption: null, rows: markerRows })

  const recoveryRows: CompareRow[] = []
  if (data.restingHr) {
    recoveryRows.push(row({ key: 'restingHr', label: m.restingHr, pair: data.restingHr, value: Math.round, format: (v) => String(Math.round(v)), unit: t.units.bpm, delta: (d) => formatDelta(d, t.units.bpm), metric: 'heartRate', context: { flatBelow: 1 } }))
  }
  if (data.ctl) {
    const fitness = row({ key: 'ctl', label: cycle.complete ? m.fitnessEnd : m.fitnessToday, pair: data.ctl, value: Math.round, format: (v) => formatDecimal(v, 0), delta: (d) => formatDelta(d), metric: 'fitness' })
    // A fitness score means nothing on its own scale: it shows only against the cycle before.
    if (fitness.previous !== null) recoveryRows.push(fitness)
  }
  if (recoveryRows.length > 0) out.push({ key: 'recovery', ...sec.recovery, caption: null, rows: recoveryRows })

  // The outcome first, then what went into it.
  return [...out.filter((section) => section.key === 'markers'), ...out.filter((section) => section.key !== 'markers')]
}

/** Under this many weeks run before, there is nothing to compare with: the page is a starting point. */
const MIN_BASELINE_WEEKS = 4

function asStartingPoint(section: CompareSection): CompareSection {
  return {
    ...section,
    rows: section.rows
      .filter((r) => r.current !== null && r.key !== 'ctl')
      .map((r) => ({ ...r, previous: null, delta: null, direction: null, tone: 'flat' as const, missing: null, absent: null })),
  }
}

export function checkpointView(data: CycleCheckpoint, today: string): CheckpointPageView {
  const { cycle } = data
  const eyebrow = cycle.mode === 'rolling' ? s().lastWeeks : data.generalPreparation ? t.plan.phase.generalShort : null

  const status: CheckpointPageView['status'] = cycle.mode === 'rolling'
    ? { title: s().lastWeeks, detail: null, week: cycle.week, segments: null, note: s().rolling }
    : cycle.complete
      ? {
          title: s().complete,
          detail: s().reached(formatDate(cycle.current.end)),
          week: cycle.week,
          segments: 12,
          note: s().nextBegan(formatDate(shiftDays(cycle.current.end, 1))),
        }
      : {
          title: s().weekOf(cycle.week),
          detail: s().dueIn(formatDate(cycle.current.end), daysBetween(today, cycle.current.end)),
          week: cycle.week,
          segments: 12,
          note: cycle.completeWeeks === 0 ? s().tooEarly : null,
        }

  const starting = data.previousRunWeeks < MIN_BASELINE_WEEKS
  const built = starting ? sections(data).map(asStartingPoint).filter((section) => section.rows.length > 0) : sections(data)
  const compared = built.some((section) => section.rows.some((r) => r.previous !== null))
  const scored = built.flatMap((section) => section.rows).filter((r) => r.scored && r.delta !== null)
  const summary = scored.length > 0
    ? { good: scored.filter((r) => r.tone === 'good').length, worse: scored.filter((r) => r.tone === 'worse').length, flat: scored.filter((r) => r.tone === 'flat').length }
    : null

  return {
    eyebrow,
    generalPreparation: cycle.mode !== 'rolling' && data.generalPreparation,
    range: compared ? s().againstBefore(formatDateRange(cycle.previous.start, cycle.previous.end, { year: 'always' })) : null,
    status: starting && cycle.mode !== 'rolling' && !cycle.complete ? { ...status, note: s().startingPoint } : status,
    summary: starting ? null : summary,
    sections: built,
  }
}

export interface CheckpointTileView {
  line: string
  /** The cycle under way: its week and the checkpoint's date. */
  inProgress: { week: number; end: string } | null
  summary: Record<DeltaTone, number> | null
}

export function checkpointTileView(data: CycleCheckpoint, today: string): CheckpointTileView {
  const { cycle } = data
  const tile = s().tile
  const line = cycle.mode === 'rolling'
    ? tile.rolling
    : cycle.complete ? tile.complete : tile.inProgress(cycle.week, formatDate(cycle.current.end, { style: 'bare', year: 'never' }))
  const inProgress = cycle.mode === 'rolling' || cycle.complete ? null : { week: cycle.week, end: cycle.current.end }
  return { line, inProgress, summary: checkpointView(data, today).summary }
}
