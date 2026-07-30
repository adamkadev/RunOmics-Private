import type { CurrentWeekPurpose } from '@/application/usecases/GetCurrentWeekPurpose'
import { SUPPORTING_POOL } from './budget'
import { insightHash } from './insightHash'
import { avoidClause, systemInstruction } from './prompt'

export const WEEK_PURPOSE_SURFACE = 'weekPurpose'
export const WEEK_PURPOSE_LIMITS = { headline: 40, body: 120 }

// Supporting copy on a page the athlete opens to plan, not to be told how they
// are doing - the dashboard already answers that. Lite model, and the banner
// keeps its rules-based title either way.
export const WEEK_PURPOSE_POOL = SUPPORTING_POOL

function facts(week: CurrentWeekPurpose) {
  return {
    weekStart: week.weekStart,
    phase: week.planPhase,
    plannedTotal: week.planned?.total ?? 0,
    plannedKey: week.planned?.key ?? 0,
    done: week.adherence?.done ?? 0,
    due: week.adherence?.planned ?? 0,
    km: week.distanceKm,
    sessions: week.sessions,
    loadPercent: week.comparison?.percent ?? null,
  }
}

export function weekPurposeInsightHash(week: CurrentWeekPurpose): string {
  return insightHash(facts(week))
}

export const WEEK_PURPOSE_SYSTEM_INSTRUCTION = [
  systemInstruction(
    'You are a running coach naming what the current training week is for, in the banner at the top of an athlete weekly planner.',
    'one sentence on how to run the rest of the week',
    WEEK_PURPOSE_LIMITS
  ),
  // The banner already carries the phase name and the adherence percentage in
  // bold, so the generated line has to add intent, not repeat the header.
  'The week phase name and the completed/planned count are already printed on the banner: never restate them.',
  'Talk about the days left in this week only. Never invent a session that is not in the facts.',
].join(' ')

export function weekPurposeInsightPrompt(week: CurrentWeekPurpose, recentHeadlines: string[]): string {
  const f = facts(week)

  return [
    'Facts about the week in progress:',
    f.phase ? `- Plan phase: ${f.phase}` : null,
    f.plannedTotal ? `- Planned: ${f.plannedTotal} sessions, ${f.plannedKey} of them key` : '- Nothing planned this week',
    f.due ? `- Done so far: ${f.done} of the ${f.due} planned days` : null,
    `- Run so far: ${f.km} km over ${f.sessions} session${f.sessions === 1 ? '' : 's'}`,
    f.loadPercent !== null ? `- Load against a typical week: ${f.loadPercent}%` : null,
    avoidClause(recentHeadlines),
  ]
    .filter((line) => line !== null)
    .join('\n')
}
