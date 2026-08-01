import type { Activity, PlannedWorkout } from '@/domain/activity/types'
import type { VerdictTone } from '@/domain/activity/runVerdict'
import { expectedRpe, runVerdictTone } from '@/domain/activity/runVerdict'
import type { RunHistory, TypeBaseline } from '@/domain/activity/runHistory'
import { sessionExecution, type SessionExecution } from '@/domain/activity/sessionExecution'
import { formatClock } from '@/lib/formatters'
import { insightHash } from './insightHash'
import { avoidClause, systemInstruction } from './prompt'

export const RUN_VERDICT_PREFIX = 'runVerdict_'
export const RUN_VERDICT_LIMITS = { headline: 56, body: 150 }

export function runVerdictSurface(activityId: string): string {
  return `${RUN_VERDICT_PREFIX}${activityId}`
}

// How far back a run is still likely to be opened. Past a training block, a run
// is only reached through the records list, so that is the other way in.
const VERDICT_HORIZON_DAYS = 90

// A run this recent is the one the athlete just finished and is about to open,
// so its verdict is generated ahead of the rest of the copy rather than behind
// it. Wider than a day because a sync can land days late, and because the
// verdict for a run only becomes reachable once the deployment carrying it is
// live - which is the run after the one that synced it.
const FRESH_VERDICT_DAYS = 3

function daysSince(date: string, now: Date): number {
  return (now.getTime() - new Date(date.slice(0, 10) + 'T00:00:00').getTime()) / 86_400_000
}

/**
 * Whether a run is worth a verdict at all. Generating one for every run ever
 * synced spends the day's quota on pages nobody opens; a run that already has a
 * cached verdict keeps it either way, this only gates writing new ones.
 */
export function deservesVerdict(
  activity: { id: string; date: string },
  recordActivityIds: ReadonlySet<string>,
  now: Date
): boolean {
  if (recordActivityIds.has(activity.id)) return true
  return daysSince(activity.date, now) <= VERDICT_HORIZON_DAYS
}

/** Whether this run is recent enough to be generated before the other surfaces. */
export function isFreshRun(activity: { date: string }, now: Date): boolean {
  return daysSince(activity.date, now) <= FRESH_VERDICT_DAYS
}

// The watch's own sensor rides on the wrist and reads ~6°C above the air it is
// meant to describe (+8.8°C near freezing, +2.3°C in the high twenties), so the
// conditions now come from the weather - apparent rather than air temperature,
// because it already folds in the wind and humidity the effort actually paid for.
//
// Runs before this date deliberately keep the old sensor reading: a verdict is
// served only while its cached hash still matches these facts, so moving them
// over would strip the copy they already have rather than improve it. A run
// still waiting on its conditions holds its reading too, so it migrates once
// when the weather lands instead of regenerating on the way there.
const WEATHER_FACTS_FROM = '2026-05-08'

function verdictTemperature(activity: Activity): number | null {
  if (activity.date < WEATHER_FACTS_FROM || !activity.weather) return activity.avgTemperature
  return Math.round(activity.weather.apparentTempC)
}

export interface RunVerdictContext {
  activity: Activity
  /** How this run stands against the ones that came before it. */
  history: RunHistory
  /** What the plan asked for that day, when Garmin held a session for it. */
  planned: PlannedWorkout | null
}

function facts({ activity, history, planned }: RunVerdictContext) {
  const execution = sessionExecution(activity)

  return {
    tone: runVerdictTone(activity),
    type: activity.type,
    distanceKm: activity.distanceKm,
    minutes: Math.round(activity.durationSeconds / 60),
    pace: activity.paceSecPerKm,
    avgHr: activity.avgHeartRate,
    rpe: activity.rpe,
    aerTrainingEffect: activity.aerTrainingEffect,
    elevationGain: activity.elevationGain,
    temperature: verdictTemperature(activity),
    execution: execution ? executionLine(execution) : null,
    planned: planned?.name ?? null,
    plannedType: planned?.type ?? null,
    plannedMinutes: planned?.durationSecs ? Math.round(planned.durationSecs / 60) : null,
    baselineRuns: history.baseline?.runs ?? null,
    baselinePace: history.baseline?.paceSecPerKm ?? null,
    baselineHr: history.baseline?.avgHr ?? null,
    standing: history.standing?.label ?? null,
    standingDays: history.standing?.daysSinceBetter ?? null,
    hardMinutes: history.hardMinutes,
    runsInPast7Days: history.runsInPast7Days,
    daysSinceLastRun: history.daysSinceLastRun,
  }
}

// The shape of the session in one line, because it is the only material the
// model has that the stat grid under the card does not already show.
function executionLine(execution: NonNullable<SessionExecution>): string {
  const drift = execution.hrDriftBpm === null ? '' : `, heart rate ${signed(execution.hrDriftBpm)} bpm across it`
  if (execution.kind === 'steady') {
    return `${execution.spreadSecPerKm}s/km between the fastest and slowest kilometre${drift}`
  }
  return `${execution.reps} reps, ${signed(execution.fadeSecPerKm)}s/km from first to last, ${execution.spreadSecPerKm}s/km between the fastest and slowest${drift}`
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value)
}

export function runVerdictInsightHash(context: RunVerdictContext): string {
  return insightHash(facts(context))
}

// Every tone is stated relative to what the session type called for, because
// that is what the tone now measures: RPE 8 is the point of a threshold session
// and a red flag on an easy day.
const TONE_RULES: Record<VerdictTone, string> = {
  positive: 'The effort landed where this session type calls for. Say what that earned.',
  neutral: 'The effort drifted from what this session type calls for, without doing harm. Describe it plainly, without forced praise.',
  caution: 'The effort overshot what this session type calls for. Flag the cost and the recovery it needs.',
}

export const RUN_VERDICT_SYSTEM_INSTRUCTION = [
  systemInstruction(
    'You are a running coach writing the verdict card for a single run an athlete just finished.',
    // The stat grid sits directly under this card, so reciting distance, time
    // and pace back would add nothing the athlete cannot already see.
    'one sentence on how the session held together and what it earned',
    RUN_VERDICT_LIMITS
  ),
  'Never contradict the tone you are given - it drives the color of the card.',
  // The days around the run explain it (a fifth run in a week reads differently
  // from a first one back), but the card is not the place to plan the next one.
  'Judge this run. The days around it are context for judging it, never the subject, and never advise what to do next.',
  // Without this the model writes "you held 5:35/km over 7.03 km at 151 bpm",
  // which is the three numbers printed immediately below the card.
  'The distance, duration, average pace and average heart rate are already printed under your text: never state them. Build the sentence on how the effort held up instead - the fade between reps, the spread between kilometres, the heart rate drift.',
  'When no execution detail is given, say what the effort produced rather than describing the run back.',
  // Heat and hills make a run feel harder than its type intends; without this
  // the model reads any gap as a discipline problem, which is often unfair.
  'When the effort sits outside the expected band, look for a cause in the other facts (heat, elevation) and name it rather than assuming the athlete misjudged the session.',
  // The one thing a coach has that a stat grid does not: everything the athlete
  // ran before this. Same pace at a lower heart rate is the whole point.
  'The comparison against what the athlete ran before is the most useful thing you can write: prefer it to any other angle when it is given.',
  'You may state a difference against those past runs ("8s/km quicker", "5 bpm lower", "your best 10K in 6 months"); what is banned is repeating the numbers of this run back.',
  'When a planned session is given, judge what was run against what was asked, and say so plainly if they differ.',
].join(' ')

// Under these, a difference is day-to-day noise, and handing it to the model as
// a number is how "1 bpm lower" ends up sold as progress.
const PACE_NOISE_SEC_PER_KM = 3
const HR_NOISE_BPM = 3

// Deltas are computed here rather than left to the model: a coach who gets the
// arithmetic wrong is worse than one who says nothing.
function baselineLine(type: string, baseline: TypeBaseline, activity: Activity): string {
  const paceDelta = activity.paceSecPerKm !== null ? Math.round(baseline.paceSecPerKm - activity.paceSecPerKm) : null
  const hrDelta = baseline.avgHr !== null && activity.avgHeartRate !== null ? baseline.avgHr - activity.avgHeartRate : null

  const reference = `your last ${baseline.runs} ${type} runs (${formatClock(baseline.paceSecPerKm)} /km${baseline.avgHr ? ` at ${baseline.avgHr} bpm` : ''})`
  const pace =
    paceDelta === null || Math.abs(paceDelta) < PACE_NOISE_SEC_PER_KM
      ? 'the same pace'
      : `${Math.abs(paceDelta)}s/km ${paceDelta > 0 ? 'quicker' : 'slower'}`
  const heart =
    hrDelta === null
      ? null
      : Math.abs(hrDelta) < HR_NOISE_BPM
        ? 'the same heart rate'
        : `${Math.abs(hrDelta)} bpm ${hrDelta > 0 ? 'lower' : 'higher'}`

  return `- Against ${reference}: ${[pace, heart].filter((part) => part !== null).join(', ')}`
}

function plannedLine(planned: PlannedWorkout): string {
  const minutes = planned.durationSecs ? `~${Math.round(planned.durationSecs / 60)} min` : null

  // Garmin names a session after its own type when the plan holds no structure,
  // and "the plan asked for a Base (Base)" reads like a bug.
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

function cadenceLine(runs: number, daysSinceLastRun: number): string {
  const gap =
    daysSinceLastRun === 0
      ? 'a second run on the same day'
      : `${daysSinceLastRun} day${daysSinceLastRun === 1 ? '' : 's'} after the previous one`
  return `- ${runs} run${runs === 1 ? '' : 's'} in the 7 days up to it, ${gap}`
}

export function runVerdictInsightPrompt(context: RunVerdictContext, recentHeadlines: string[]): string {
  const { activity, history, planned } = context
  const f = facts(context)

  const past = [
    history.baseline ? baselineLine(f.type, history.baseline, activity) : null,
    history.standing ? standingLine(history.standing.label, history.standing.daysSinceBetter) : null,
    history.daysSinceLastRun !== null ? cadenceLine(f.runsInPast7Days, history.daysSinceLastRun) : null,
  ].filter((line) => line !== null)

  return [
    `Tone: ${f.tone}. ${TONE_RULES[f.tone]}`,
    '',
    'Facts:',
    `- Session type: ${f.type}`,
    `- Distance: ${f.distanceKm} km in ${f.minutes} min`,
    f.pace ? `- Pace: ${formatClock(f.pace)} /km` : null,
    f.avgHr ? `- Average heart rate: ${f.avgHr} bpm` : null,
    f.rpe !== null
      ? `- Perceived effort (RPE 1-10): ${f.rpe}, against ${expectedRpe(activity).join(' to ')} expected for a ${f.type} of this length`
      : null,
    f.aerTrainingEffect !== null ? `- Aerobic training effect (0-5): ${f.aerTrainingEffect}` : null,
    f.elevationGain ? `- Elevation gain: ${f.elevationGain} m` : null,
    f.temperature !== null ? `- Temperature it felt like: ${f.temperature}°C` : null,
    f.hardMinutes !== null ? `- Time spent in zone 4 or 5: ${f.hardMinutes} min` : null,
    f.execution ? `- How it was held together: ${f.execution}` : null,
    planned ? plannedLine(planned) : null,
    ...(past.length ? ['', 'What came before it:', ...past] : []),
    avoidClause(recentHeadlines),
  ]
    .filter((line) => line !== null)
    .join('\n')
}
