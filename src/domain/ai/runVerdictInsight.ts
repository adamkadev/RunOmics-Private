import { DAY_MS } from '@/lib/calendarDate'
import type { Activity, ActivityType, PlannedWorkout, WorkoutStep } from '@/domain/activity/types'
import type { VerdictTone } from '@/domain/activity/runVerdict'
import { expectedRpe, runVerdictTone } from '@/domain/activity/runVerdict'
import type { LongestRun, PreviousRun, PreviousSession, RunHistory, TypeBaseline } from '@/domain/activity/runHistory'
import type { SessionIntent } from '@/domain/coaching/sessionIntent'
import { gapHalves } from '@/domain/activity/gradeAdjusted'
import { isLongSession } from '@/domain/activity/longRun'
import { raceExecution } from '@/domain/activity/raceExecution'
import { MIN_REP_SECONDS, repStats, sessionExecution, type SessionExecution } from '@/domain/activity/sessionExecution'
import { resolvePerformance, type OfficialRaceResult } from '@/domain/activity/raceResult'
import { formatClock } from '@/lib/formatters'
import { insightHash } from './insightHash'
import { avoidClause, promptVersion, systemInstruction } from './prompt'

export const RUN_VERDICT_PREFIX = 'runVerdict_'
export const RUN_VERDICT_LIMITS = { headline: 56, body: 150 }

/** Part of every verdict's hash: bump it with a prompt change, so runs inside the horizon are written again. */
export const RUN_VERDICT_PROMPT_VERSION = 5

export function runVerdictSurface(activityId: string): string {
  return `${RUN_VERDICT_PREFIX}${activityId}`
}

const VERDICT_HORIZON_DAYS = 90

const FRESH_VERDICT_DAYS = 3

function daysSince(date: string, now: Date): number {
  return (now.getTime() - new Date(date.slice(0, 10) + 'T00:00:00').getTime()) / DAY_MS
}

export function deservesVerdict(
  activity: { id: string; date: string },
  recordActivityIds: ReadonlySet<string>,
  now: Date
): boolean {
  if (recordActivityIds.has(activity.id)) return true
  return daysSince(activity.date, now) <= VERDICT_HORIZON_DAYS
}

export function isFreshRun(activity: { date: string }, now: Date): boolean {
  return daysSince(activity.date, now) <= FRESH_VERDICT_DAYS
}

const WEATHER_FACTS_FROM = '2026-05-08'

function verdictTemperature(activity: Activity): number | null {
  if (activity.date < WEATHER_FACTS_FROM || !activity.weather) return activity.avgTemperature
  return Math.round(activity.weather.apparentTempC)
}

export interface AthleteNote {
  note: string
  tags: string[]
}

export interface RunVerdictContext {
  activity: Activity
  history: RunHistory
  planned: PlannedWorkout | null
  official?: OfficialRaceResult | null
  /** Null when there is none, undefined when the notes could not be read. */
  note?: AthleteNote | null
  intent?: SessionIntent | null
}

/** Kept out of the facts hash, which the activity page rebuilds on every render and would then need a Firestore read of its own. */
export function runVerdictNoteKey(note: AthleteNote | null): string {
  if (!note || (!note.note.trim() && !note.tags.length)) return ''
  return insightHash({ note: note.note.trim(), tags: [...note.tags].sort().join(',') })
}

const NOTE_PROMPT_CHARS = 300

/** What the run is judged against: the plan's purpose when there is one, Garmin's read of the effort only when there is not. */
export type RunKind = 'easy' | 'long' | 'strides' | 'tempo' | 'threshold' | 'intervals' | 'race'

const KIND_BY_TYPE: Partial<Record<ActivityType, RunKind>> = {
  Race: 'race',
  Tempo: 'tempo',
  Threshold: 'threshold',
  VO2Max: 'intervals',
  Anaerobic: 'intervals',
  Sprint: 'intervals',
}

const KIND_LABEL: Record<RunKind, string> = {
  easy: 'an easy run',
  long: 'a long run',
  strides: 'an easy run with strides',
  tempo: 'a tempo session',
  threshold: 'a threshold session',
  intervals: 'an interval session',
  race: 'a race',
}

/** Never Garmin's training-effect label: the watch's estimate can call an easy run spent entirely in zones 1-2 "Tempo". */
function judgedType(kind: RunKind, activity: Activity): ActivityType {
  switch (kind) {
    case 'easy':
    case 'long':
    case 'strides':
      return 'Base'
    case 'tempo':
      return 'Tempo'
    case 'threshold':
      return 'Threshold'
    case 'race':
      return 'Race'
    case 'intervals':
      return activity.type === 'VO2Max' || activity.type === 'Anaerobic' || activity.type === 'Sprint' ? activity.type : 'VO2Max'
  }
}

const stepSeconds = (step: WorkoutStep) => step.seconds ?? step.minutes * 60

/** Split as the run's own reps are (see MIN_REP_SECONDS). */
function plannedReps(planned: PlannedWorkout | null): { quality: WorkoutStep[]; strides: WorkoutStep[] } {
  const efforts = planned?.steps?.filter((step) => step.kind === 'effort') ?? []
  const reps = efforts.filter((step) => step.rep !== undefined)
  const continuous = efforts.some((step) => step.rep === undefined && stepSeconds(step) >= MIN_REP_SECONDS)
  if (!continuous) return { quality: reps, strides: [] }
  return {
    quality: reps.filter((step) => stepSeconds(step) >= MIN_REP_SECONDS),
    strides: reps.filter((step) => stepSeconds(step) < MIN_REP_SECONDS),
  }
}

export function runVerdictKind({ activity, planned }: Pick<RunVerdictContext, 'activity' | 'planned'>): RunKind {
  return runKind(activity, planned, sessionExecution(activity))
}

export function runKind(activity: Activity, planned: PlannedWorkout | null, execution: SessionExecution): RunKind {
  if (activity.type === 'Race') return 'race'
  const reps = plannedReps(planned)
  const named = planned?.type ? KIND_BY_TYPE[planned.type] : undefined
  if (named) return named
  if (planned && reps.quality.length) return KIND_BY_TYPE[activity.type] ?? 'intervals'
  if (!planned && KIND_BY_TYPE[activity.type]) return KIND_BY_TYPE[activity.type]!
  if (reps.strides.length || (!planned && execution?.strides)) return 'strides'
  const description = [planned?.name, activity.description].filter(Boolean).join(' ')
  return isLongSession({ durationSeconds: activity.durationSeconds, description }) ? 'long' : 'easy'
}

/** A GPS rep reads a couple of seconds either side of its true pace. */
const REP_PACE_TOLERANCE = 2

type Band = [fast: number, slow: number]

function bandOf(steps: WorkoutStep[]): Band | null {
  const bands = steps.map((step) => step.paceSecPerKm)
  const first = bands[0]
  if (!first || bands.some((band) => !band || band[0] !== first[0] || band[1] !== first[1])) return null
  return [first[0], first[1]]
}

interface RepAdherence {
  planned: number
  done: number
  paces: number[]
  band: Band | null
  inside: number
  faster: number
  slower: number
}

function repAdherence(execution: SessionExecution, planned: WorkoutStep[]): RepAdherence | null {
  if (!planned.length) return null
  const paces = execution?.kind === 'intervals' ? execution.repPaces : []
  const band = bandOf(planned)
  const faster = band ? paces.filter((p) => p < band[0] - REP_PACE_TOLERANCE).length : 0
  const slower = band ? paces.filter((p) => p > band[1] + REP_PACE_TOLERANCE).length : 0
  return { planned: planned.length, done: paces.length, paces, band, inside: band ? paces.length - faster - slower : 0, faster, slower }
}

/**
 * Reps off target, faster included, or fewer than planned cap the tone whatever the RPE says.
 * Reps on target at a lower effort than the band are fitness showing, not a shortfall.
 */
function verdictTone(activity: Activity, kind: RunKind, reps: RepAdherence | null, repsRun: boolean): VerdictTone {
  const judged = { ...activity, type: judgedType(kind, activity) }
  const tone = runVerdictTone(judged)
  const easier = activity.rpe !== null && activity.rpe < expectedRpe(judged)[0]
  if (reps) {
    const onTarget = reps.done >= reps.planned && (reps.faster + reps.slower) * 2 <= reps.done
    if (!onTarget) return tone === 'positive' ? 'neutral' : tone
    return tone === 'neutral' && easier ? 'positive' : tone
  }
  // The athlete rates the whole session, warm-up and cool-down included, so a lower RPE is no sign the reps were run soft.
  return QUALITY_KINDS.has(kind) && repsRun && tone === 'neutral' && easier ? 'positive' : tone
}

const QUALITY_KINDS: ReadonlySet<RunKind> = new Set(['tempo', 'threshold', 'intervals'])

const pace = (secPerKm: number) => formatClock(secPerKm)
const bandText = ([fast, slow]: Band) => `${pace(fast)}-${pace(slow)} /km`

function repsLine(reps: RepAdherence): string {
  if (reps.done === 0) return `- Reps: none recorded against ${reps.planned} planned - it was run as one continuous effort`
  const count = `${reps.done} of ${reps.planned} planned, at ${reps.paces.map(pace).join(', ')} /km`
  if (!reps.band) return `- Reps: ${count}`
  const verdict =
    reps.inside === reps.done
      ? `all ${reps.done === 1 ? '' : `${reps.done} `}inside it`
      : [reps.inside && `${reps.inside} inside`, reps.faster && `${reps.faster} faster`, reps.slower && `${reps.slower} slower`]
          .filter(Boolean)
          .join(', ')
  return `- Reps: ${count} against a ${bandText(reps.band)} target: ${verdict}`
}

const PACE_NOISE_SEC_PER_KM = 3
const HR_NOISE_BPM = 3

/** In words, never a sign: the model reads "-12s/km from first to last" as a fade. */
function paceChange(secPerKm: number, than: string): string {
  return Math.abs(secPerKm) < PACE_NOISE_SEC_PER_KM
    ? `at the pace of ${than}`
    : `${Math.abs(secPerKm)}s/km ${secPerKm > 0 ? 'slower' : 'quicker'} than ${than}`
}

function heartChange(bpm: number | null, when: string): string {
  if (bpm === null) return ''
  return Math.abs(bpm) < HR_NOISE_BPM ? `, heart rate level ${when}` : `, heart rate ${Math.abs(bpm)} bpm ${bpm > 0 ? 'higher' : 'lower'} ${when}`
}

function executionLine(execution: NonNullable<SessionExecution>, kind: RunKind, activity: Activity): string {
  if (execution.kind === 'intervals') {
    return `- How the reps held: ${execution.spreadSecPerKm}s/km between the fastest and slowest, the last rep ${paceChange(execution.fadeSecPerKm, 'the first')}${heartChange(execution.hrDriftBpm, 'by the last rep')}`
  }
  const drift = heartChange(execution.hrDriftBpm, 'in the second half')
  // On a hilly run raw pace splits measure where the climbs fell, not how the athlete held.
  const gap = gapHalves(activity)
  const halves = gap
    ? `by grade-adjusted pace (the run climbed ${gap.climbMPerKm} m a km), the second half ${paceChange(gap.fadeSecPerKm, 'the first')}`
    : `the second half ${paceChange(execution.fadeSecPerKm, 'the first')}`
  // Spread on an easy day is terrain and traffic, not execution; given as a fact, the model reports it as one.
  const spread = EASY_KINDS.has(kind) ? '' : `, ${execution.spreadSecPerKm}s/km between the fastest and slowest kilometre`
  return `- How it held: ${halves}${drift}${spread}`
}

function stridesLine(execution: SessionExecution, planned: WorkoutStep[]): string | null {
  const strides = execution?.strides
  if (!strides) return planned.length ? `- Strides: none recorded against ${planned.length} planned` : null
  const count = planned.length ? `${strides.count} of ${planned.length} planned` : String(strides.count)
  const band = bandOf(planned)
  return `- Strides: ${count}, between ${pace(strides.fastestSecPerKm)} and ${pace(strides.slowestSecPerKm)} /km${band ? ` against a ${bandText(band)} target` : ''}`
}

function pacingLine(activity: Activity): string | null {
  const trend = raceExecution(activity)?.trend
  if (!trend) return null
  const split = trend.positiveSplitSecPerKm
  const change = Math.abs(split) < PACE_NOISE_SEC_PER_KM ? 'the same pace' : `${Math.abs(split)}s/km ${split > 0 ? 'slower' : 'quicker'}`
  return `- Pacing: first full kilometre ${pace(trend.firstFullLapPaceSecPerKm)}, last ${pace(trend.lastFullLapPaceSecPerKm)} (${change})${heartChange(trend.hrDriftBpm, 'by the last kilometre')}`
}

const EASY_KINDS: ReadonlySet<RunKind> = new Set(['easy', 'long', 'strides'])

function zoneMinutes(activity: Activity, zones: (zone: number) => boolean): number | null {
  if (!activity.hrZones.length) return null
  return Math.round(activity.hrZones.filter((z) => zones(z.zone)).reduce((sum, z) => sum + z.seconds, 0) / 60)
}

/**
 * Zone 3 is the grey zone an easy run drifts into.
 * Zones that held are labelled the default, or the model makes them every easy verdict's headline.
 */
const GREY_SHARE_ALLOWED = 0.1
function zonesLine(kind: RunKind, activity: Activity, hardMinutes: number | null, reps: RepAdherence | null): string | null {
  // Reps against their target say how hard a structured session was better than zone time does.
  if (hardMinutes === null || (reps && reps.done > 0)) return null
  const easy = zoneMinutes(activity, (zone) => zone <= 2)
  const grey = zoneMinutes(activity, (zone) => zone === 3)
  // On LTHR zones, tempo effort sits in zone 3 (about 89-94% of LTHR): for a
  // tempo session that is the work, not the grey zone.
  if (kind === 'tempo' && grey !== null) return `- Time in zone 3: ${grey} min; zones 4-5: ${hardMinutes} min`
  if (!EASY_KINDS.has(kind) || easy === null || grey === null) return `- Time in zones 4-5: ${hardMinutes} min`
  const total = easy + grey + hardMinutes
  if (total === 0) return null
  const share = Math.round((easy / total) * 100)
  return grey <= total * GREY_SHARE_ALLOWED && hardMinutes <= 1
    ? `- Zones: ${share}% in zones 1-2, as an easy run should be - the default, not news`
    : `- Zones: ${share}% in zones 1-2, ${grey} min in zone 3, ${hardMinutes} min in zones 4-5 - more than an easy day should hold`
}

/**
 * The card prints the air temperature and the wind (runConditions.ts); the rest of the weather is only here, as a cause.
 * The watch's own sensor reads the body's heat.
 */
function conditionsLine(activity: Activity): string | null {
  const w = activity.weather
  if (w) {
    return `- Conditions, printed on the card: ${Math.round(w.tempC)}°C, wind ${Math.round(w.windKph)} km/h. Not printed: feels like ${Math.round(w.apparentTempC)}°C, humidity ${Math.round(w.humidityPct)}%`
  }
  return activity.avgTemperature !== null ? `- Temperature from the watch's sensor: ${activity.avgTemperature}°C` : null
}

function baselineLine(kind: RunKind, type: string, baseline: TypeBaseline, activity: Activity): string | null {
  const current =
    baseline.measure === 'reps'
      ? repStats(activity)
      : activity.paceSecPerKm !== null
        ? { paceSecPerKm: activity.paceSecPerKm, avgHr: activity.avgHeartRate }
        : null
  if (!current) return null

  const paceDelta = Math.round(baseline.paceSecPerKm - current.paceSecPerKm)
  const hrDelta = baseline.avgHr !== null && current.avgHr !== null ? baseline.avgHr - current.avgHr : null
  const peers =
    baseline.measure === 'reps'
      ? `the reps of your last ${baseline.runs} ${type} sessions`
      : `your last ${baseline.runs} ${kind === 'long' ? 'long' : EASY_KINDS.has(kind) ? 'easy' : type} runs`
  const reference = `${peers} (${pace(baseline.paceSecPerKm)} /km${baseline.avgHr ? ` at ${baseline.avgHr} bpm` : ''})`
  const paceText =
    Math.abs(paceDelta) < PACE_NOISE_SEC_PER_KM ? 'the same pace' : `${Math.abs(paceDelta)}s/km ${paceDelta > 0 ? 'quicker' : 'slower'}`
  const heart =
    hrDelta === null
      ? null
      : Math.abs(hrDelta) < HR_NOISE_BPM
        ? 'the same heart rate'
        : `${Math.abs(hrDelta)} bpm ${hrDelta > 0 ? 'lower' : 'higher'}`

  return `- ${baseline.measure === 'reps' ? 'Rep pace against' : 'Against'} ${reference}: ${[paceText, heart].filter((part) => part !== null).join(', ')}`
}

function noteLine(note: AthleteNote | null | undefined): string | null {
  const text = note?.note.trim().slice(0, NOTE_PROMPT_CHARS) ?? ''
  const tags = note?.tags.length ? note.tags.join(', ') : ''
  if (!text && !tags) return null
  return text
    ? `- The athlete's own note on this run, printed on the card: "${text}"${tags ? ` (tags: ${tags})` : ''}`
    : `- The athlete's tags on this run, printed on the card: ${tags}`
}

const INTENT_PROMPT_CHARS = 400

/** Without the coach's words, every session of a kind is judged on the same things and reads the same. */
function intentLines(intent: SessionIntent): string[] {
  const clip = (text: string) => text.trim().slice(0, INTENT_PROMPT_CHARS)
  return [
    `- What the coach wrote for this session: "${clip(intent.description)}"`,
    intent.weekFocus.trim() ? `- What the plan's week is for: "${clip(intent.weekFocus)}"` : null,
  ].filter((line) => line !== null)
}

const SESSION_WORD: Partial<Record<ActivityType, string>> = {
  Tempo: 'tempo',
  Threshold: 'threshold',
  VO2Max: 'VO2max',
  Anaerobic: 'anaerobic',
  Sprint: 'sprint',
}

const REP_LENGTH_NOISE_SECONDS = 5

const daysBefore = (days: number) => (days === 0 ? 'earlier the same day' : `${days} day${days === 1 ? '' : 's'} before`)

function previousSessionLine(activity: Activity, last: PreviousSession): string | null {
  const now = repStats(activity)
  const word = SESSION_WORD[activity.type]
  if (!now || !word) return null
  const repDelta = now.reps - last.reps
  const lengthDelta = now.secondsPerRep - last.secondsPerRep
  const paceDelta = last.paceSecPerKm - now.paceSecPerKm
  const hrDelta = now.avgHr !== null && last.avgHr !== null ? now.avgHr - last.avgHr : null
  const length = Math.abs(lengthDelta) < 60 ? `${Math.abs(lengthDelta)} s` : `${formatClock(Math.abs(lengthDelta))} min`
  const changes = [
    repDelta === 0 ? 'as many reps' : `${Math.abs(repDelta)} ${repDelta > 0 ? 'more' : 'fewer'} rep${Math.abs(repDelta) === 1 ? '' : 's'}`,
    Math.abs(lengthDelta) < REP_LENGTH_NOISE_SECONDS ? 'reps as long' : `reps ${length} ${lengthDelta > 0 ? 'longer' : 'shorter'}`,
    Math.abs(paceDelta) < PACE_NOISE_SEC_PER_KM ? 'the same rep pace' : `${Math.abs(paceDelta)}s/km ${paceDelta > 0 ? 'quicker' : 'slower'}`,
    hrDelta === null ? null : Math.abs(hrDelta) < HR_NOISE_BPM ? 'the same heart rate' : `${Math.abs(hrDelta)} bpm ${hrDelta > 0 ? 'higher' : 'lower'}`,
  ].filter((part) => part !== null)
  const then = `${last.reps} reps of ${formatClock(last.secondsPerRep)} at ${pace(last.paceSecPerKm)} /km${last.avgHr ? `, ${last.avgHr} bpm` : ''}`
  return `- Against your last ${word} session, ${daysBefore(last.daysAgo)} (${then}): ${changes.join(', ')}`
}

/** Under half a kilometre past the longest run is the same distance, not a new longest. */
const LONGER_BY_KM = 0.5

function longestLine(activity: Activity, longest: LongestRun): string {
  if (activity.distanceKm - longest.km >= LONGER_BY_KM) {
    return longest.daysSinceAsLong === null
      ? '- Longer than any earlier run on record'
      : `- Your longest run in ${Math.round(longest.daysSinceAsLong / DAYS_PER_MONTH)} months`
  }
  const short = Math.round(longest.km - activity.distanceKm)
  return short < 1
    ? `- As long as your longest run of the last 3 months, ${daysBefore(longest.daysAgo)}`
    : `- ${short} km short of your longest run of the last 3 months, ${daysBefore(longest.daysAgo)}`
}

function plannedLine(planned: PlannedWorkout): string {
  const minutes = planned.durationSecs ? `~${Math.round(planned.durationSecs / 60)} min` : null

  if (!planned.name || planned.name === planned.type) {
    const shape = [planned.type ? `a ${planned.type}` : 'a session', minutes ? `of ${minutes}` : null]
      .filter((part) => part !== null)
      .join(' ')
    return `- The plan asked for ${shape} that day`
  }

  // "Base" is Garmin's word for an easy session; the model echoes it as jargon.
  const type = planned.type && planned.type !== 'Base' ? planned.type : null
  const detail = [type, minutes].filter((part) => part !== null).join(', ')
  return `- The plan asked for "${planned.name}" that day${detail ? ` (${detail})` : ''}`
}

const DAYS_PER_MONTH = 30.44

function standingLine(label: string, daysSinceBetter: number | null): string {
  if (daysSinceBetter === null) return `- No earlier run of yours went faster over ${label}`
  return `- No run in the last ${Math.round(daysSinceBetter / DAYS_PER_MONTH)} months went faster over ${label}`
}

function placingLine(official: OfficialRaceResult | null | undefined): string | null {
  if (!official?.overallPlace) return null
  const field = official.finisherCount ? ` of ${official.finisherCount}` : ''
  return `- Finished ${official.overallPlace}${field}`
}

const COACH_TYPE_WORDS = /^(base|endurance|footing|r[ée]cup[ée]ration|recovery|tempo|seuil|threshold|vma|vo2 ?max|ana[ée]robique|anaerobic|sprint|vitesse)$/i

const TYPE_LABEL: Record<ActivityType, string> = {
  Base: 'an easy run',
  Tempo: 'a tempo session',
  Threshold: 'a threshold session',
  VO2Max: 'an interval session',
  Anaerobic: 'an interval session',
  Sprint: 'a sprint session',
  Race: 'a race',
}

function cadenceLine(runs: number, previous: PreviousRun): string {
  const when =
    previous.daysAgo === 0 ? 'earlier the same day' : `${previous.daysAgo} day${previous.daysAgo === 1 ? '' : 's'} before`
  // Garmin Coach names a session by its type word alone: "was "Base"" is jargon.
  const what = previous.description && !COACH_TYPE_WORDS.test(previous.description.trim()) ? `"${previous.description}"` : TYPE_LABEL[previous.type]
  return `- ${runs} run${runs === 1 ? '' : 's'} in the 7 days up to it; the previous one, ${when}, was ${what}`
}

function facts({ activity, history, planned, official, intent }: RunVerdictContext) {
  const execution = sessionExecution(activity)
  const kind = runKind(activity, planned, execution)
  const plan = plannedReps(planned)
  const reps = kind === 'strides' ? null : repAdherence(execution, plan.quality)
  const performance = resolvePerformance(activity, official ?? null)
  const certified = performance.source === 'official'
  const recentWeather = activity.date >= WEATHER_FACTS_FROM ? activity.weather : null

  return {
    promptVersion: promptVersion(RUN_VERDICT_PROMPT_VERSION),
    tone: verdictTone(activity, kind, reps, execution?.kind === 'intervals'),
    kind,
    type: activity.type,
    distanceKm: Math.round(performance.distanceKm * 100) / 100,
    minutes: Math.round(performance.durationSeconds / 60),
    pace: performance.paceSecPerKm,
    ...(certified
      ? {
          performanceSource: performance.source,
          chipTimeSeconds: performance.durationSeconds,
          overallPlace: performance.overallPlace ?? null,
          finisherCount: performance.finisherCount ?? null,
        }
      : {}),
    avgHr: activity.avgHeartRate,
    rpe: activity.rpe,
    aerTrainingEffect: activity.aerTrainingEffect,
    elevationGain: activity.elevationGain,
    temperature: verdictTemperature(activity),
    airTemperature: recentWeather ? Math.round(recentWeather.tempC) : null,
    windKph: recentWeather ? Math.round(recentWeather.windKph) : null,
    humidityPct: recentWeather ? Math.round(recentWeather.humidityPct) : null,
    execution: execution ? executionLine(execution, kind, activity) : null,
    reps: reps ? repsLine(reps) : execution?.kind === 'intervals' && QUALITY_KINDS.has(kind) ? `- Reps: ${execution.reps}, at ${execution.repPaces.map(pace).join(', ')} /km` : null,
    strides: kind === 'strides' ? stridesLine(execution, plan.strides) : null,
    pacing: kind === 'race' ? pacingLine(activity) : null,
    zones: zonesLine(kind, activity, history.hardMinutes, reps),
    planned: planned?.name ?? null,
    plannedType: planned?.type ?? null,
    plannedMinutes: planned?.durationSecs ? Math.round(planned.durationSecs / 60) : null,
    // The same Garmin type is only like for like when it is what the run was for: an easy run Garmin called "Tempo" is no tempo peer.
    baseline:
      history.baseline && judgedType(kind, activity) === activity.type ? baselineLine(kind, activity.type, history.baseline, activity) : null,
    standing: history.standing?.label ?? null,
    standingDays: history.standing?.daysSinceBetter ?? null,
    runsInPast7Days: history.runsInPast7Days,
    daysSinceLastRun: history.daysSinceLastRun,
    previous: history.previous ? `${history.previous.daysAgo}:${history.previous.description || history.previous.type}` : null,
    previousSession:
      history.previousSession && judgedType(kind, activity) === activity.type ? previousSessionLine(activity, history.previousSession) : null,
    longest: kind === 'long' && history.longest ? longestLine(activity, history.longest) : null,
    intent: intent ? intentLines(intent).join('\n') : null,
  }
}

export function runVerdictInsightHash(context: RunVerdictContext): string {
  return insightHash(facts(context))
}

type WrittenVerdict = { headline: string; body: string }

export function verdictLines(written: WrittenVerdict[]): string[] {
  return written.map((verdict) => `${verdict.headline} / ${verdict.body}`)
}

function headlineKey(headline: string): string {
  return headline.trim().toLowerCase().replace(/[.!?]+$/, '')
}

const opening = (headline: string) => headlineKey(headline).split(/\s+/).slice(0, 2).join(' ')

/** Also matches the first two words of a shown verdict: a lite model handed a list not to echo still echoes it. */
export function repeatsEarlierVerdict(
  candidate: Pick<WrittenVerdict, 'headline'>,
  written: Pick<WrittenVerdict, 'headline'>[],
  shown: Pick<WrittenVerdict, 'headline'>[] = []
): boolean {
  const key = headlineKey(candidate.headline)
  const start = opening(candidate.headline)
  return written.some((earlier) => headlineKey(earlier.headline) === key) || shown.some((earlier) => opening(earlier.headline) === start)
}

/** Never "the strongest fact": the model picks the same one, and the same headline, for every good session of a kind. */
const TONE_RULES: Record<VerdictTone, string> = {
  positive:
    'The run did what this session was for. Say it on what matters most about this run today, never on what is true of every good session of its kind.',
  neutral:
    'The run drifted from what this session is for - off its target, short of the plan, or harder or easier than asked - without doing harm. Say how, plainly, without forced praise.',
  caution: 'The effort overshot what this session is for. Name what it cost.',
}

export const RUN_VERDICT_SYSTEM_INSTRUCTION = [
  systemInstruction(
    'You are a running coach writing the verdict card for a single run an athlete just finished: what you would tell them about it once they stop.',
    'one or two sentences on what the headline rests on, in plain words',
    RUN_VERDICT_LIMITS
  ),
  'Never contradict the tone you are given: it is the judgement the numbers support.',
  'Judge whether this run did its job. The days around it are context for judging it, never the subject, and never advise what to do next.',
  "The card already prints the distance, duration, average pace, average heart rate, perceived effort (RPE) and the conditions: never state those numbers. A difference against earlier runs or against the plan's target is fine (\"8s/km quicker\", \"inside the 4:22-4:28 target\"); repeating this run's own printed numbers is not.",
  "What the job is depends on the session. How a session is judged is not the verdict: when its job held, that is expected, and what sets this run apart is the story.",
  "An easy run's job is to stay easy: nearly all of it in zones 1-2. That is the default, not news: when it held, give it a few words at most, never the headline, and never mention an empty zone 4-5. Lead instead with what sets this run apart - its heart rate against earlier easy runs at the same pace, its drift, where it sat in the week (the day after a hard session, a second run that day), or conditions that cost something. Only when zone 3 or above crept in is the zone time the verdict. Pace is never the achievement on an easy day, and quicker is only good news when the heart rate did not rise with it. With strides, the easy running is what you judge; the strides only count as done.",
  "A long run's job is time on feet at an easy effort: judge how the second half held, its heart rate drift and fade, and how far it went against the longest run of recent months. Kilometre-to-kilometre pace spread is terrain, not execution.",
  'A tempo or threshold session is judged on rep pace against its target, evenness across the reps and heart rate drift. Reps faster than the target are not a bonus: that is a harder session than asked. Reps on target at a lower effort than expected are good news, never a shortfall. When they held, look past them: the change since the last session of its kind, the heart rate at that pace, the rep that was hardest, the place of the session in the plan.',
  'An interval session is judged on the reps completed and held at the target, and the fade from first to last; when they held, the story is elsewhere, as for a threshold session.',
  "On a structured session the athlete's RPE covers the whole run, warm-up and cool-down included: judge the reps by their pace and heart rate, never by that number, and never call a session short of its intensity because of it.",
  'A race is judged on its pacing - an even or negative split is the skill - its result against earlier bests, and its placing.',
  "When the coach's words for the session are given, they say what this particular session was for - a first measurement of a pace, easy running the day after the reps, a long run kept inside its recent maximum - and whether it did that is the verdict. Never quote them back.",
  'Lead with what this run makes the most of; never default to the comparison with earlier runs because it is there.',
  'When the effort sits outside the expected band, look for a cause in the other facts - heat, humidity, wind, elevation - and name it rather than assuming the athlete misjudged the session. Name the cause, never its number.',
  'When a planned session is given, judge what was run against what was asked, and say so plainly if they differ.',
  "The athlete's note, when there is one, is what the numbers cannot tell you: never quote it back, it is printed on the card, but judge the run in its light. A session run sick, tired or sore is never written up as if nothing happened.",
  'When the note reports a problem with the run - the terrain, the route, feeling unsafe, pain - acknowledge it plainly as what happened; never reframe it as a success or credit the athlete for coping with it.',
  'Write as a coach talks to the athlete, not as a report. The headline is a full sentence with a verb, something you would say to them once they stop - never a label of adjectives and nouns. If it would fit any other session of its kind, it is not this run\'s verdict yet.',
  'The body gives the one or two facts the headline rests on and what they mean, as one or two plain sentences - never a list of numbers.',
  'Vary the shape from one verdict to the next: a plain statement, a contrast, a comparison with last time, one moment of the run.',
  'No jargon (base, cardiac cost, aerobic engine, execution), no praise words (textbook, rock-solid, precise, disciplined, dialled in, locked in, on full display, delivered) and no claims about what the run builds.',
].join(' ')

export function runVerdictInsightPrompt(context: RunVerdictContext, recentVerdicts: string[]): string {
  const { activity, history, planned } = context
  const f = facts(context)

  const past = [
    f.previousSession,
    f.baseline,
    f.longest,
    history.standing ? standingLine(history.standing.label, history.standing.daysSinceBetter) : null,
    history.previous ? cadenceLine(f.runsInPast7Days, history.previous) : null,
  ].filter((line) => line !== null)

  return [
    `Tone: ${f.tone}. ${TONE_RULES[f.tone]}`,
    '',
    'Facts:',
    `- Session: ${KIND_LABEL[f.kind]}`,
    context.official
      ? `- Official result over the certified course: ${f.distanceKm} km in ${f.minutes} min (chip time)`
      : `- Distance: ${f.distanceKm} km in ${f.minutes} min`,
    f.pace ? `- Pace: ${formatClock(f.pace)} /km` : null,
    placingLine(context.official),
    f.avgHr ? `- Average heart rate: ${f.avgHr} bpm` : null,
    f.rpe === null
      ? null
      : QUALITY_KINDS.has(f.kind)
        ? `- Perceived effort for the whole session, warm-up and cool-down included (RPE 1-10, printed on the card): ${f.rpe}`
        : `- Perceived effort (RPE 1-10, printed on the card): ${f.rpe}, against ${expectedRpe({ ...activity, type: judgedType(f.kind, activity) }).join(' to ')} expected for this session at this length`,
    f.aerTrainingEffect !== null ? `- Aerobic training effect (0-5): ${f.aerTrainingEffect}` : null,
    f.elevationGain ? `- Elevation gain: ${f.elevationGain} m` : null,
    conditionsLine(activity),
    f.zones,
    f.reps,
    f.strides,
    f.execution,
    f.pacing,
    planned ? plannedLine(planned) : null,
    f.intent,
    noteLine(context.note),
    ...(past.length ? ['', 'What came before it:', ...past] : []),
    avoidClause(recentVerdicts, 'otherRuns'),
  ]
    .filter((line) => line !== null)
    .join('\n')
}
