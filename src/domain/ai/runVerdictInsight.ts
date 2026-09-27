import { DAY_MS } from '@/lib/calendarDate'
import type { Activity, ActivityType, PlannedWorkout, WorkoutStep } from '@/domain/activity/types'
import type { VerdictTone } from '@/domain/activity/runVerdict'
import { expectedRpe, runVerdictTone } from '@/domain/activity/runVerdict'
import type { RunHistory, TypeBaseline } from '@/domain/activity/runHistory'
import { isLongSession } from '@/domain/activity/longRun'
import { raceExecution } from '@/domain/activity/raceExecution'
import { MIN_REP_SECONDS, repStats, sessionExecution, type SessionExecution } from '@/domain/activity/sessionExecution'
import { resolvePerformance, type OfficialRaceResult } from '@/domain/activity/raceResult'
import { formatClock } from '@/lib/formatters'
import { insightHash } from './insightHash'
import { avoidClause, systemInstruction } from './prompt'

export const RUN_VERDICT_PREFIX = 'runVerdict_'
export const RUN_VERDICT_LIMITS = { headline: 56, body: 150 }

/**
 * Part of every verdict's hash: bump it with a change to the prompt, and the
 * runs inside the verdict horizon are written again on the next pass instead
 * of keeping copy from the old prompt (v4.16.4).
 */
export const RUN_VERDICT_PROMPT_VERSION = 2

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

export interface RunVerdictContext {
  activity: Activity
  history: RunHistory
  planned: PlannedWorkout | null
  official?: OfficialRaceResult | null
}

// ─── What the session was for ──────────────────────────────────────────────

/**
 * What the run was for, which is what it is judged against (v4.16.4): an
 * easy run's job is to stay easy, a threshold session's to hold its reps on
 * target. The plan says what the session was for when there is one; Garmin's
 * read of the effort only when there is not.
 */
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

const stepSeconds = (step: WorkoutStep) => step.seconds ?? step.minutes * 60

/**
 * The plan's reps, split as the run's own are (see MIN_REP_SECONDS): short
 * reps beside a continuous block are strides, and with no such block they
 * are the session.
 */
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

// ─── Reps against the plan ─────────────────────────────────────────────────

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
 * The tone the numbers support. Perceived effort in its band is not the whole
 * story on a structured session: reps off the target, or fewer than planned,
 * are no "the session landed" whatever the RPE says. Reps faster than asked
 * count as off too - a threshold session run as VO2max is a harder day than
 * the plan wanted, not a better one.
 */
function verdictTone(tone: VerdictTone, reps: RepAdherence | null): VerdictTone {
  if (tone !== 'positive' || !reps) return tone
  const off = reps.faster + reps.slower
  return reps.done < reps.planned || off * 2 > reps.done ? 'neutral' : tone
}

// ─── Fact lines ────────────────────────────────────────────────────────────

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value)
}

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

function executionLine(execution: NonNullable<SessionExecution>): string {
  const drift = execution.hrDriftBpm === null ? '' : `, heart rate ${signed(execution.hrDriftBpm)} bpm`
  if (execution.kind === 'intervals') {
    return `- How the reps held: ${execution.spreadSecPerKm}s/km between the fastest and slowest, ${signed(execution.fadeSecPerKm)}s/km from first to last${drift ? `${drift} across them` : ''}`
  }
  const halves =
    Math.abs(execution.fadeSecPerKm) < PACE_NOISE_SEC_PER_KM
      ? 'the second half at the pace of the first'
      : `the second half ${Math.abs(execution.fadeSecPerKm)}s/km ${execution.fadeSecPerKm > 0 ? 'slower' : 'quicker'} than the first`
  return `- How it held: ${halves}${drift ? `${drift} from the first half to the second` : ''}, ${execution.spreadSecPerKm}s/km between the fastest and slowest kilometre`
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
  const drift = trend.hrDriftBpm === null ? '' : `, heart rate ${signed(trend.hrDriftBpm)} bpm from first to last`
  return `- Pacing: first full kilometre ${pace(trend.firstFullLapPaceSecPerKm)}, last ${pace(trend.lastFullLapPaceSecPerKm)} (${change})${drift}`
}

const EASY_KINDS: ReadonlySet<RunKind> = new Set(['easy', 'long', 'strides'])

function zoneMinutes(activity: Activity, zones: (zone: number) => boolean): number | null {
  if (!activity.hrZones.length) return null
  return Math.round(activity.hrZones.filter((z) => zones(z.zone)).reduce((sum, z) => sum + z.seconds, 0) / 60)
}

function zonesLine(kind: RunKind, activity: Activity, hardMinutes: number | null): string | null {
  if (hardMinutes === null) return null
  const grey = zoneMinutes(activity, (zone) => zone === 3)
  return EASY_KINDS.has(kind) && grey !== null
    ? `- Time in zone 3: ${grey} min; in zone 4 or 5: ${hardMinutes} min`
    : `- Time in zone 4 or 5: ${hardMinutes} min`
}

/**
 * The Conditions row of the verdict card prints the air temperature and the
 * wind (runConditions.ts); the rest of the weather is only here, as a cause.
 * The watch's own sensor, for runs without weather, reads the body's heat.
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

function plannedLine(planned: PlannedWorkout): string {
  const minutes = planned.durationSecs ? `~${Math.round(planned.durationSecs / 60)} min` : null

  if (!planned.name || planned.name === planned.type) {
    const shape = [planned.type ? `a ${planned.type}` : 'a session', minutes ? `of ${minutes}` : null]
      .filter((part) => part !== null)
      .join(' ')
    return `- The plan asked for ${shape} that day`
  }

  const detail = [planned.type, minutes].filter((part) => part !== null).join(', ')
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

function cadenceLine(runs: number, daysSinceLastRun: number): string {
  const gap =
    daysSinceLastRun === 0
      ? 'a second run on the same day'
      : `${daysSinceLastRun} day${daysSinceLastRun === 1 ? '' : 's'} after the previous one`
  return `- ${runs} run${runs === 1 ? '' : 's'} in the 7 days up to it, ${gap}`
}

// ─── Facts, hash and prompt ────────────────────────────────────────────────

function facts({ activity, history, planned, official }: RunVerdictContext) {
  const execution = sessionExecution(activity)
  const kind = runKind(activity, planned, execution)
  const plan = plannedReps(planned)
  const reps = kind === 'strides' ? null : repAdherence(execution, plan.quality)
  const performance = resolvePerformance(activity, official ?? null)
  const certified = performance.source === 'official'
  const recentWeather = activity.date >= WEATHER_FACTS_FROM ? activity.weather : null

  return {
    promptVersion: RUN_VERDICT_PROMPT_VERSION,
    tone: verdictTone(runVerdictTone(activity), reps),
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
    execution: execution ? executionLine(execution) : null,
    reps: reps ? repsLine(reps) : null,
    strides: kind === 'strides' ? stridesLine(execution, plan.strides) : null,
    pacing: kind === 'race' ? pacingLine(activity) : null,
    zones: zonesLine(kind, activity, history.hardMinutes),
    planned: planned?.name ?? null,
    plannedType: planned?.type ?? null,
    plannedMinutes: planned?.durationSecs ? Math.round(planned.durationSecs / 60) : null,
    baseline: history.baseline ? baselineLine(kind, activity.type, history.baseline, activity) : null,
    standing: history.standing?.label ?? null,
    standingDays: history.standing?.daysSinceBetter ?? null,
    runsInPast7Days: history.runsInPast7Days,
    daysSinceLastRun: history.daysSinceLastRun,
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

export function repeatsEarlierVerdict(
  candidate: Pick<WrittenVerdict, 'headline'>,
  written: Pick<WrittenVerdict, 'headline'>[]
): boolean {
  const key = headlineKey(candidate.headline)
  return written.some((earlier) => headlineKey(earlier.headline) === key)
}

const TONE_RULES: Record<VerdictTone, string> = {
  positive: 'The run did what this session is for. Say so on the strongest fact that shows it.',
  neutral:
    'The run drifted from what this session is for - off its target, short of the plan, or harder or easier than asked - without doing harm. Say how, plainly, without forced praise.',
  caution: 'The effort overshot what this session is for. Name what it cost.',
}

export const RUN_VERDICT_SYSTEM_INSTRUCTION = [
  systemInstruction(
    'You are a running coach writing the verdict card for a single run an athlete just finished.',
    'two or three measured facts behind the headline, in plain words',
    RUN_VERDICT_LIMITS
  ),
  'Never contradict the tone you are given: it is the judgement the numbers support.',
  'Judge whether this run did its job. The days around it are context for judging it, never the subject, and never advise what to do next.',
  // v4.16.4: RPE and the conditions sit in the same card, right under the text.
  "The card already prints the distance, duration, average pace, average heart rate, perceived effort (RPE) and the conditions: never state those numbers. A difference against earlier runs or against the plan's target is fine (\"8s/km quicker\", \"inside the 4:22-4:28 target\"); repeating this run's own printed numbers is not.",
  'What the job is depends on the session.',
  "An easy run's job is to stay easy: little or no time above zone 3, a steady heart rate. Pace is never the achievement on an easy day, and quicker is only good news when the heart rate did not rise with it. With strides, the easy running is what you judge; the strides only count as done.",
  "A long run's job is time on feet at an easy effort: judge how the second half held, its heart rate drift and fade. Kilometre-to-kilometre pace spread is terrain, not execution.",
  'A tempo or threshold session is judged on rep pace against its target, evenness across the reps and heart rate drift. Reps faster than the target are not a bonus: that is a harder session than asked.',
  'An interval session is judged on the reps completed and held at the target, and the fade from first to last.',
  'A race is judged on its pacing - an even or negative split is the skill - its result against earlier bests, and its placing.',
  'Lead with what this run makes the most of; never default to the comparison with earlier runs because it is there.',
  'When the effort sits outside the expected band, look for a cause in the other facts - heat, humidity, wind, elevation - and name it rather than assuming the athlete misjudged the session. Name the cause, never its number.',
  'When a planned session is given, judge what was run against what was asked, and say so plainly if they differ.',
  // v5.5 #22, v5.6 #9: the body read "a textbook run locked in pure aerobic gains".
  'Write the body as two or three measured facts, comma-separated or as two short sentences, like "3 reps within 1 s/km of each other, all inside the target, 4 bpm drift." or "Kept out of zone 4-5 the whole run, heart rate steady to the end." No praise words (textbook, rock-solid, locked in, on full display) and no claims about what the run builds.',
].join(' ')

export function runVerdictInsightPrompt(context: RunVerdictContext, recentVerdicts: string[]): string {
  const { activity, history, planned } = context
  const f = facts(context)

  const past = [
    f.baseline,
    history.standing ? standingLine(history.standing.label, history.standing.daysSinceBetter) : null,
    history.daysSinceLastRun !== null ? cadenceLine(f.runsInPast7Days, history.daysSinceLastRun) : null,
  ].filter((line) => line !== null)

  return [
    `Tone: ${f.tone}. ${TONE_RULES[f.tone]}`,
    '',
    'Facts:',
    `- Session: ${KIND_LABEL[f.kind]} (Garmin's training effect: ${f.type})`,
    context.official
      ? `- Official result over the certified course: ${f.distanceKm} km in ${f.minutes} min (chip time)`
      : `- Distance: ${f.distanceKm} km in ${f.minutes} min`,
    f.pace ? `- Pace: ${formatClock(f.pace)} /km` : null,
    placingLine(context.official),
    f.avgHr ? `- Average heart rate: ${f.avgHr} bpm` : null,
    f.rpe !== null
      ? `- Perceived effort (RPE 1-10): ${f.rpe}, against ${expectedRpe(activity).join(' to ')} expected for a ${f.type} of this length`
      : null,
    f.aerTrainingEffect !== null ? `- Aerobic training effect (0-5): ${f.aerTrainingEffect}` : null,
    f.elevationGain ? `- Elevation gain: ${f.elevationGain} m` : null,
    conditionsLine(activity),
    f.zones,
    f.reps,
    f.strides,
    f.execution,
    f.pacing,
    planned ? plannedLine(planned) : null,
    ...(past.length ? ['', 'What came before it:', ...past] : []),
    avoidClause(recentVerdicts, 'otherRuns'),
  ]
    .filter((line) => line !== null)
    .join('\n')
}
