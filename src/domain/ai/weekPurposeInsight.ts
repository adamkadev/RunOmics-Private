import type { CurrentWeekPurpose } from '@/application/usecases/GetCurrentWeekPurpose'
import { insightHash } from './insightHash'
import { avoidClause, systemInstruction } from './prompt'

export const WEEK_PURPOSE_SURFACE = 'weekPurpose'
export const WEEK_PURPOSE_LIMITS = { headline: 40, body: 120 }

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
    remaining: week.remaining.map((session) => `${session.date}:${session.name}`).join(', '),
  }
}

function remainingLine(week: CurrentWeekPurpose): string {
  const sessions = week.remaining.map((session) => {
    const weekday = new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })
    // Garmin names a plain session after its own type, and "Base (Base)" reads
    // like a bug rather than a plan.
    const what = session.name === session.type ? session.name : `"${session.name}"${session.type ? ` (${session.type})` : ''}`
    return `${weekday} ${what}`
  })
  return `- Still to run: ${sessions.join(', ')}`
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
  // The banner is read on the planner, in front of the sessions themselves:
  // naming the one that matters is what makes the line worth its space.
  'When sessions are still to run, name the one that gives the rest of the week its shape and say how to approach it.',
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
    week.remaining.length ? remainingLine(week) : '- Nothing left on the plan this week',
    avoidClause(recentHeadlines),
  ]
    .filter((line) => line !== null)
    .join('\n')
}
