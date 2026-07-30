import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import type { PlannedWorkout } from '@/domain/activity/types'
import type { ReadinessTone } from '@/domain/training/readiness'
import { HERO_MODEL } from './budget'
import { insightHash } from './insightHash'
import { avoidClause, systemInstruction } from './prompt'

export const TODAY_SURFACE = 'todayHero'
export const TODAY_LIMITS = { headline: 52, body: 140 }

// The hero is the one line the athlete reads every morning, and it costs one
// call a day, so it gets the strongest model the free tier offers.
export const TODAY_MODEL = HERO_MODEL

interface TodayContext {
  status: TrainingStatus
  tone: ReadinessTone
  plannedWorkout: PlannedWorkout | null
}

function facts({ status, tone, plannedWorkout }: TodayContext) {
  return {
    tone,
    status: status.status,
    loadTrend: status.loadTrend,
    risk: status.risk,
    form: Math.round(status.tsbNow),
    fitnessTrend: Math.round(status.ctlDelta),
    fatigueTrend: Math.round(status.atlDelta),
    planned: plannedWorkout ? (plannedWorkout.type ?? plannedWorkout.name) : 'rest',
    plannedMinutes: plannedWorkout?.durationSecs ? Math.round(plannedWorkout.durationSecs / 60) : null,
  }
}

export function todayInsightHash(context: TodayContext): string {
  return insightHash(facts(context))
}

const TONE_RULES: Record<ReadinessTone, string> = {
  go: 'The athlete is fresh and recovered. Encourage the planned quality session.',
  caution: 'The athlete is neither fresh nor cooked. Advise staying honest and moderate.',
  hold: 'Fatigue is elevated. Advise easing off, going easy or resting.',
}

export const TODAY_SYSTEM_INSTRUCTION = [
  systemInstruction(
    'You are a running coach writing the one-line verdict at the top of an athlete dashboard.',
    'one supporting sentence naming the numbers that justify it',
    TODAY_LIMITS
  ),
  'Never contradict the tone you are given - it is already shown as a colored badge next to your text.',
].join(' ')

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
    `- Planned today: ${f.planned}${f.plannedMinutes ? ` (~${f.plannedMinutes} min)` : ''}`,
    avoidClause(recentHeadlines),
  ].join('\n')
}
