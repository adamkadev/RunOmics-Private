import type { Activity } from '@/domain/activity/types'
import type { VerdictTone } from '@/domain/activity/runVerdict'
import { runVerdictTone } from '@/domain/activity/runVerdict'
import { formatClock } from '@/lib/formatters'
import { insightHash } from './insightHash'
import { avoidClause, systemInstruction } from './prompt'

export const RUN_VERDICT_PREFIX = 'runVerdict_'
export const RUN_VERDICT_LIMITS = { headline: 56, body: 150 }

// One verdict per activity means hundreds of calls to backfill, so this surface
// takes the lite model instead: 15 RPM and 500/day on the free tier, against
// 5 and 20 for the flash the other two use. Quotas are counted per model, so
// the bulk work here never eats into the hero's budget.
export const RUN_VERDICT_MODEL = 'gemini-3.5-flash-lite'

export function runVerdictSurface(activityId: string): string {
  return `${RUN_VERDICT_PREFIX}${activityId}`
}

function facts(activity: Activity) {
  return {
    tone: runVerdictTone(activity.rpe, activity.aerTrainingEffect),
    type: activity.type,
    distanceKm: activity.distanceKm,
    minutes: Math.round(activity.durationSeconds / 60),
    pace: activity.paceSecPerKm,
    avgHr: activity.avgHeartRate,
    rpe: activity.rpe,
    aerTrainingEffect: activity.aerTrainingEffect,
    elevationGain: activity.elevationGain,
    temperature: activity.avgTemperature,
  }
}

export function runVerdictInsightHash(activity: Activity): string {
  return insightHash(facts(activity))
}

const TONE_RULES: Record<VerdictTone, string> = {
  positive: 'This run went well. Say what worked.',
  neutral: 'This run was unremarkable. Describe it plainly, without forced praise.',
  caution: 'This run was hard on the body. Flag the cost and the recovery it needs.',
}

export const RUN_VERDICT_SYSTEM_INSTRUCTION = [
  systemInstruction(
    'You are a running coach writing the verdict card for a single run an athlete just finished.',
    // The stat grid sits directly under this card, so reciting distance, time
    // and pace back would add nothing the athlete cannot already see.
    'one sentence on what the effort cost or produced, never a restatement of the distance, time and pace already shown beneath it',
    RUN_VERDICT_LIMITS
  ),
  'Never contradict the tone you are given - it drives the color of the card.',
  'Talk about this run only, never about the training week or what to do next.',
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
    f.rpe !== null ? `- Perceived effort (RPE 1-10): ${f.rpe}` : null,
    f.aerTrainingEffect !== null ? `- Aerobic training effect (0-5): ${f.aerTrainingEffect}` : null,
    f.elevationGain ? `- Elevation gain: ${f.elevationGain} m` : null,
    f.temperature !== null ? `- Temperature: ${f.temperature}C` : null,
    avoidClause(recentHeadlines),
  ]
    .filter((line) => line !== null)
    .join('\n')
}
