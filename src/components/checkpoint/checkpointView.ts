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
}

export interface CompareSection {
  key: 'volume' | 'threshold' | 'efficiency' | 'markers' | 'recovery'
  title: string
  about: string
  caption: string | null
  rows: CompareRow[]
}

export interface CheckpointPageView {
  eyebrow: string
  range: string
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
  /** Said when this cycle has no reading, in place of the generic "not enough data". */
  none?: string
}

function row<T>(spec: RowSpec<T>): CompareRow {
  const { pair } = spec
  const current = pair.current === null ? null : spec.value(pair.current)
  const previous = pair.previous === null ? null : spec.value(pair.previous)
  const change = current !== null && previous !== null ? current - previous : null
  const missing = current === null ? (spec.none ?? s().notEnough) : previous === null ? s().nothingBefore : null
  return {
    key: spec.key,
    label: spec.label,
    current: pair.current === null ? null : spec.format(pair.current),
    unit: spec.unit ?? null,
    previous: pair.previous === null ? null : spec.format(pair.previous),
    delta: change === null ? null : spec.delta(change),
    direction: change === null || change === 0 ? null : change > 0 ? 'up' : 'down',
    tone: spec.metric && change !== null ? deltaTone(spec.metric, change, { value: current!, ...spec.context }) : 'flat',
    scored: spec.metric !== null,
    note: spec.note?.(pair) ?? null,
    missing,
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
      none: s().noCheck,
      note: (pair) => (pair.current ? `${s().vdot(formatDecimal(pair.current.vdot, 1))} · ${bare(pair.current.date)}` : pair.previous ? `${s().vdot(formatDecimal(pair.previous.vdot, 1))} · ${bare(pair.previous.date)}` : null),
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
    recoveryRows.push(row({ key: 'restingHr', label: m.restingHr, pair: data.restingHr, value: number, format: (v) => formatDecimal(v, 1), unit: t.units.bpm, delta: (d) => formatDeltaFixed(d, 1, t.units.bpm), metric: 'heartRate', context: { flatBelow: 1 } }))
  }
  if (data.ctl) {
    recoveryRows.push(row({ key: 'ctl', label: cycle.complete ? m.fitnessEnd : m.fitnessToday, pair: data.ctl, value: Math.round, format: (v) => formatDecimal(v, 0), delta: (d) => formatDelta(d), metric: 'fitness' }))
  }
  if (recoveryRows.length > 0) out.push({ key: 'recovery', ...sec.recovery, caption: null, rows: recoveryRows })

  return out
}

export function checkpointView(data: CycleCheckpoint, today: string): CheckpointPageView {
  const { cycle } = data
  const general = t.plan.weekPurpose.generalPreparation
  const eyebrow = cycle.mode === 'rolling'
    ? s().lastWeeks
    : data.generalPreparation ? `${general} · ${s().cycle(cycle.number!)}` : s().cycle(cycle.number!)

  const status: CheckpointPageView['status'] = cycle.mode === 'rolling'
    ? { title: s().lastWeeks, detail: null, week: cycle.week, segments: null, note: s().rolling }
    : cycle.complete
      ? {
          title: s().complete(cycle.number!),
          detail: s().reached(formatDate(cycle.current.end)),
          week: cycle.week,
          segments: 12,
          note: s().nextBegan(cycle.number! + 1, formatDate(shiftDays(cycle.current.end, 1))),
        }
      : {
          title: s().weekOf(cycle.week),
          detail: s().dueIn(formatDate(cycle.current.end), daysBetween(today, cycle.current.end)),
          week: cycle.week,
          segments: 12,
          note: cycle.completeWeeks === 0 ? s().tooEarly : null,
        }

  const built = sections(data)
  const scored = built.flatMap((section) => section.rows).filter((r) => r.scored && r.delta !== null)
  const summary = scored.length > 0
    ? { good: scored.filter((r) => r.tone === 'good').length, worse: scored.filter((r) => r.tone === 'worse').length, flat: scored.filter((r) => r.tone === 'flat').length }
    : null

  return {
    eyebrow,
    range: s().against(formatDateRange(cycle.current.start, cycle.current.end), formatDateRange(cycle.previous.start, cycle.previous.end)),
    status,
    summary,
    sections: built,
  }
}

export interface CheckpointTileView {
  line: string
  summary: Record<DeltaTone, number> | null
}

export function checkpointTileView(data: CycleCheckpoint, today: string): CheckpointTileView {
  const { cycle } = data
  const tile = s().tile
  const line = cycle.mode === 'rolling'
    ? tile.rolling
    : cycle.complete ? tile.complete(cycle.number!) : tile.inProgress(cycle.week, formatDate(cycle.current.end, { style: 'bare' }))
  return { line, summary: checkpointView(data, today).summary }
}
