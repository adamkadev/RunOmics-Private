import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import type { PlannedWorkout } from '@/domain/activity/types'
import type { ReadinessTone } from '@/domain/training/readiness'
import type { RecentTraining } from '@/domain/training/recentTraining'
import { HERO_POOL } from './budget'
import { insightHash } from './insightHash'
import { avoidClause, systemInstruction } from './prompt'

export const TODAY_SURFACE = 'todayHero'
export const TODAY_LIMITS = { headline: 52, body: 140 }

// The hero is the one line the athlete reads every morning, and it costs one
// call a day, so it gets the strongest model the free tier offers.
export const TODAY_POOL = HERO_POOL

export interface TodayContext {
  status: TrainingStatus
  tone: ReadinessTone
  plannedWorkout: PlannedWorkout | null
  /** The seven days behind the verdict - what makes it specific to this athlete. */
  recent: RecentTraining
}

function facts({ status, tone, plannedWorkout, recent }: TodayContext) {
  return {
    tone,
    status: status.status,
    loadTrend: status.loadTrend,
    risk: status.risk,
    form: Math.round(status.tsbNow),
    fitnessTrend: Math.round(status.ctlDelta),
    fatigueTrend: Math.round(status.atlDelta),
    planned: plannedWorkout ? (plannedWorkout.name ?? plannedWorkout.type) : 'rest',
    plannedType: plannedWorkout?.type ?? null,
    plannedMinutes: plannedWorkout?.durationSecs ? Math.round(plannedWorkout.durationSecs / 60) : null,
    weekRuns: recent.runs,
    weekKm: recent.km,
    lastRunType: recent.lastRun?.type ?? null,
    lastRunDaysAgo: recent.lastRun?.daysAgo ?? null,
    lastRunKm: recent.lastRun?.distanceKm ?? null,
  }
}

export function todayInsightHash(context: TodayContext): string {
  return insightHash(facts(context))
}

const TONE_RULES: Record<ReadinessTone, string> = {
  go: 'The athlete is fresh and recovered. Encourage the session planned today, or say what that freshness is being saved for when the day is a rest day.',
  caution: 'The athlete is neither fresh nor cooked. Advise staying honest and moderate.',
  hold: 'Fatigue is elevated. Advise easing off, going easy or resting.',
}

export const TODAY_SYSTEM_INSTRUCTION = [
  systemInstruction(
    'You are a running coach writing the one-line verdict at the top of an athlete dashboard.',
    'one supporting sentence on why, in what the athlete feels rather than the numbers behind it',
    TODAY_LIMITS
  ),
  'Never contradict the tone you are given - it is already shown as a colored badge next to your text.',
  // Form, fitness and fatigue are printed as their own cards under the hero, and
  // "form at 9, fatigue at -5" means nothing to the legs it is describing.
  'Turn the form, fitness and fatigue numbers into plain language - fresh legs, fatigue letting go, the week still in the body - and never state their values.',
  'The only numbers worth writing here are the ones the athlete would say out loud: the minutes or kilometres of the session planned today, the days since the last run, the week kilometres.',
  // "You are fresh" is a gauge reading; "you are fresh because you have not run
  // since Thursday" is a coach who watched the week.
  'Ground the verdict in what the last 7 days actually held - the session yesterday, the days off, what is waiting today - rather than in the state alone.',
].join(' ')

function lastRunLine(lastRun: NonNullable<RecentTraining['lastRun']>): string {
  const when =
    lastRun.daysAgo === 0
      ? 'earlier today'
      : lastRun.daysAgo === 1
        ? 'yesterday'
        : `${lastRun.daysAgo} days ago`
  return `- Last run: ${lastRun.distanceKm} km ${lastRun.type}, ${when}`
}

export function todayInsightPrompt(context: TodayContext, recentHeadlines: string[]): string {
  const f = facts(context)

  return [
    `Tone: ${f.tone}. ${TONE_RULES[context.tone]}`,
    '',
    'Facts:',
    `- Form (TSB, positive = fresh): ${f.form}`,
    `- Fitness trend over 2 weeks (CTL delta): ${f.fitnessTrend}`,
    `- Fatigue trend over 7 days (ATL delta): ${f.fatigueTrend}`,
    `- Training status: ${f.status}`,
    `- Load trend: ${f.loadTrend}`,
    `- Injury risk: ${f.risk}`,
    `- Last 7 days: ${f.weekRuns} run${f.weekRuns === 1 ? '' : 's'}, ${f.weekKm} km`,
    context.recent.lastRun ? lastRunLine(context.recent.lastRun) : '- No run logged yet',
    `- Planned today: ${f.planned}${f.plannedType && f.plannedType !== f.planned ? ` (${f.plannedType})` : ''}${f.plannedMinutes ? `, ~${f.plannedMinutes} min` : ''}`,
    avoidClause(recentHeadlines),
  ].join('\n')
}
