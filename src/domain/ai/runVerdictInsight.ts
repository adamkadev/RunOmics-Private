import type { Activity } from '@/domain/activity/types'
import type { VerdictTone } from '@/domain/activity/runVerdict'
import { expectedRpe, runVerdictTone } from '@/domain/activity/runVerdict'
import { sessionExecution, type SessionExecution } from '@/domain/activity/sessionExecution'
import { formatClock } from '@/lib/formatters'
import { insightHash } from './insightHash'
import { avoidClause, systemInstruction } from './prompt'

export const RUN_VERDICT_PREFIX = 'runVerdict_'
export const RUN_VERDICT_LIMITS = { headline: 56, body: 150 }

// Back on the lite model: the French accent/elision fix (2026-07-30)
// invalidated 164 verdicts at once by deleting them outright, and only the
// lite model's 500/day can absorb re-generating that many in one day. Move
// back to 'gemini-3.6-flash' once `?limit=0` reports outstanding: 0 - steady
// state is one new run a day, which fits that model's 20/day with room to
// spare.
export const RUN_VERDICT_MODEL = 'gemini-3.5-flash-lite'

export function runVerdictSurface(activityId: string): string {
  return `${RUN_VERDICT_PREFIX}${activityId}`
}

function facts(activity: Activity) {
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
    temperature: activity.avgTemperature,
    execution: execution ? executionLine(execution) : null,
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

export function runVerdictInsightHash(activity: Activity): string {
  return insightHash(facts(activity))
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
  'Talk about this run only, never about the training week or what to do next.',
  // Without this the model writes "you held 5:35/km over 7.03 km at 151 bpm",
  // which is the three numbers printed immediately below the card.
  'The distance, duration, average pace and average heart rate are already printed under your text: never state them. Build the sentence on how the effort held up instead - the fade between reps, the spread between kilometres, the heart rate drift.',
  'When no execution detail is given, say what the effort produced rather than describing the run back.',
  // Heat and hills make a run feel harder than its type intends; without this
  // the model reads any gap as a discipline problem, which is often unfair.
  'When the effort sits outside the expected band, look for a cause in the other facts (heat, elevation) and name it rather than assuming the athlete misjudged the session.',
].join(' ')

export function runVerdictInsightPrompt(activity: Activity, recentHeadlines: string[]): string {
  const f = facts(activity)

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
    f.temperature !== null ? `- Temperature: ${f.temperature}°C` : null,
    f.execution ? `- How it was held together: ${f.execution}` : null,
    avoidClause(recentHeadlines),
  ]
    .filter((line) => line !== null)
    .join('\n')
}
