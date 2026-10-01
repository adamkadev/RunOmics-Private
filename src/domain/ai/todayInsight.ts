import type { TrainingStatus } from '@/domain/training/status'
import type { ActivityType, PlannedWorkout, WorkoutStep } from '@/domain/activity/types'
import type { ReadinessTone } from '@/domain/training/readiness'
import type { RecentTraining } from '@/domain/training/recentTraining'
import { MIN_REP_SECONDS } from '@/domain/activity/sessionExecution'
import { t } from '@/i18n'
import { insightHash } from './insightHash'
import { avoidClause, CARD_PROMPT_VERSION, promptVersion, systemInstruction } from './prompt'

export const TODAY_SURFACE = 'todayHero'
export const TODAY_LIMITS = { headline: 52, body: 140 }

export interface TodayContext {
  status: TrainingStatus
  tone: ReadinessTone
  plannedWorkout: PlannedWorkout | null
  recent: RecentTraining
}

export type SessionKind = 'rest' | 'easy' | 'quality' | 'race'

const QUALITY_TYPES: ReadonlySet<ActivityType> = new Set(['Tempo', 'Threshold', 'VO2Max', 'Anaerobic', 'Sprint'])

/**
 * What kind of day today is, which the tone rules turn on (v4.16.4): "stay
 * moderate" is no advice for a rest day, and "ease off" none for a race.
 * A Garmin calendar entry the coaching plan did not push is typed from its
 * name, and falls back to Base for a name the sync cannot read, so a plan's
 * reps decide when its type says Base.
 */
export function sessionKind(planned: PlannedWorkout | null): SessionKind {
  if (!planned) return 'rest'
  if (planned.type === 'Race') return 'race'
  if (planned.type && QUALITY_TYPES.has(planned.type)) return 'quality'
  // Short reps beside a continuous block of running are strides on an easy
  // day; with no such block they are the session - sprints.
  const seconds = (step: WorkoutStep) => step.seconds ?? step.minutes * 60
  const efforts = planned.steps?.filter((step) => step.kind === 'effort') ?? []
  const reps = efforts.filter((step) => step.rep !== undefined)
  const continuous = efforts.some((step) => step.rep === undefined && seconds(step) >= MIN_REP_SECONDS)
  return reps.some((step) => seconds(step) >= MIN_REP_SECONDS) || (reps.length > 0 && !continuous) ? 'quality' : 'easy'
}

function ranToday(recent: RecentTraining): boolean {
  return recent.lastRun?.daysAgo === 0
}

function facts({ status, tone, plannedWorkout, recent }: TodayContext) {
  const kind = sessionKind(plannedWorkout)
  return {
    promptVersion: promptVersion(CARD_PROMPT_VERSION),
    tone,
    kind,
    status: status.status,
    loadTrend: status.loadTrend,
    risk: status.risk,
    form: Math.round(status.tsbNow),
    fitnessTrend: Math.round(status.ctlDelta),
    fatigueTrend: Math.round(status.atlDelta),
    planned: plannedWorkout ? (plannedWorkout.name ?? plannedWorkout.type) : 'rest',
    plannedType: plannedWorkout?.type ?? null,
    plannedMinutes: plannedWorkout?.durationSecs ? Math.round(plannedWorkout.durationSecs / 60) : null,
    completedToday: kind !== 'rest' && ranToday(recent),
    weekRuns: recent.weekRuns,
    weekKm: recent.weekKm,
    lastRunType: recent.lastRun?.type ?? null,
    lastRunDaysAgo: recent.lastRun?.daysAgo ?? null,
    lastRunKm: recent.lastRun?.distanceKm ?? null,
  }
}

export function todayInsightHash(context: TodayContext): string {
  return insightHash(facts(context))
}

/**
 * What a stale card must share with today's to be served while the new one is
 * written. The kind of day is part of it, or a card written for a rest day
 * reads on a race day; a run logged today is too, or "rest is what the body
 * needs" reads over the run.
 */
export function todayInsightGuard(context: TodayContext): string {
  const { tone, kind } = facts(context)
  return insightHash({ tone, kind, ranToday: ranToday(context.recent) })
}

const TONE_RULES: Record<ReadinessTone, Record<SessionKind, string>> = {
  go: {
    rest: 'The athlete is fresh and recovered, and today is a rest day. Say what that freshness is being saved for.',
    easy: 'The athlete is fresh and recovered. Encourage the easy run, and keep it easy: fresh legs are no reason to push an easy day.',
    quality: "The athlete is fresh and recovered. Encourage today's session: this is the day to run its paces with confidence.",
    race: 'The athlete is fresh and recovered, and today is race day. Back them to race it.',
  },
  caution: {
    rest: 'The athlete is neither fresh nor cooked, and today is a rest day. Say the rest is well placed and what it lets settle.',
    easy: 'The athlete is neither fresh nor cooked. Advise keeping the easy run honestly easy.',
    quality: "The athlete is neither fresh nor cooked. Advise running today's session at its prescribed paces and no faster, and cutting it short if the reps stop feeling controlled.",
    race: 'The athlete is neither fresh nor cooked, and today is race day. Never tell them to hold back from racing: advise a controlled start and letting the effort build.',
  },
  hold: {
    rest: 'Fatigue is elevated, and today is a rest day. Say rest is exactly what the body needs now.',
    easy: 'Fatigue is elevated. Advise keeping the run very easy, or shortening it.',
    quality: "Fatigue is elevated. Advise running today's session easy instead of hard, or resting.",
    race: 'Fatigue is elevated, and today is race day. Never tell the athlete to skip the race or ease off it: advise a conservative start and pacing by feel.',
  },
}

const COMPLETED_TONE_RULES: Record<ReadinessTone, string> = {
  go: 'The athlete was fresh and already ran today. Affirm that was the window to use it.',
  caution: 'The athlete had little room to spare and already ran today. Say how carrying that landed, not what to watch going in.',
  hold: 'Fatigue was elevated and the athlete already ran today anyway. Acknowledge it is done and turn to what recovering from it now looks like.',
}

const COMPLETED_RACE_RULE = "Today's race is done. Acknowledge the effort and turn to recovering from it; never second-guess the decision to race."

const RAN_ON_REST_DAY_RULES: Record<ReadinessTone, string> = {
  go: 'Today was a rest day on the plan, and the athlete ran anyway while fresh. Say it is done and that the rest of the day is for recovering.',
  caution: 'Today was a rest day on the plan, and the athlete ran anyway with little room to spare. Say it is done and what it now asks of recovery.',
  hold: 'Fatigue is elevated, today was a rest day on the plan, and the athlete ran anyway. Acknowledge it is done and turn to what recovering from it now looks like.',
}

function toneRule(tone: ReadinessTone, kind: SessionKind, ran: boolean): string {
  if (!ran) return TONE_RULES[tone][kind]
  if (kind === 'rest') return RAN_ON_REST_DAY_RULES[tone]
  return kind === 'race' ? COMPLETED_RACE_RULE : COMPLETED_TONE_RULES[tone]
}

const KIND_LABEL: Record<SessionKind, string> = {
  rest: 'a rest day',
  easy: 'an easy day',
  quality: 'a quality session',
  race: 'race day',
}

export const TODAY_SYSTEM_INSTRUCTION = [
  systemInstruction(
    'You are a running coach writing the one-line verdict at the top of an athlete dashboard.',
    'one supporting sentence on why, in what the athlete feels rather than the numbers behind it',
    TODAY_LIMITS
  ),
  // v4.16.4: the badge's own words, so the headline never echoes them.
  'Never contradict the tone you are given: it is already shown above your headline as a colored badge, whose words are given with the tone. Never reuse that phrase.',
  'Turn the form, fitness and fatigue numbers into plain language - fresh legs, fatigue letting go, the week still in the body - and never state their values.',
  // v4.16.4: the session card and the weekly card print these right below.
  "The session card under your text already prints today's session - its name, distance, duration and paces, or what was run once it is done - and the weekly card below it prints this week's kilometres and sessions. Never state those numbers: say what they mean instead. The one number worth writing is the days since the last run, when that gap matters.",
  'Ground the verdict in what this week actually held - the session yesterday, the days off, what is waiting today - rather than in the state alone.',
  "When the facts show today's planned session as already completed, write about it in the past tense - what it earned or cost - never as instructions for approaching it.",
  // v5.5 #19: "Dial back the effort on today's long run" over a Z2 run.
  "A session that is already easy (an easy run, a recovery run, a long run at easy pace) cannot be dialled back: never tell the athlete to reduce its effort or intensity. Tell them to keep it easy, or to shorten it if fatigue calls for less.",
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
  const badge = t.dashboard.todayHero.eyebrowByTone[context.tone]

  return [
    `Tone: ${f.tone}, shown in the badge above your headline as "${badge}". ${toneRule(context.tone, f.kind, ranToday(context.recent))}`,
    '',
    'Facts:',
    `- Form (TSB, positive = fresh): ${f.form}`,
    `- Fitness trend over 2 weeks (CTL delta): ${f.fitnessTrend}`,
    `- Fatigue trend over 7 days (ATL delta): ${f.fatigueTrend}`,
    `- Training status: ${f.status}`,
    `- Load trend: ${f.loadTrend}`,
    `- Injury risk: ${f.risk}`,
    `- This week so far (Monday to today), in the weekly card: ${f.weekRuns} run${f.weekRuns === 1 ? '' : 's'}, ${f.weekKm} km`,
    context.recent.lastRun ? lastRunLine(context.recent.lastRun) : '- No run logged yet',
    `- Today is ${KIND_LABEL[f.kind]}`,
    f.kind === 'rest'
      ? null
      : `- Planned today, in the session card: ${f.planned}${f.plannedType && f.plannedType !== f.planned ? ` (${f.plannedType})` : ''}${f.plannedMinutes ? `, ~${f.plannedMinutes} min` : ''}`,
    f.completedToday ? '- This session has already been completed today' : null,
    avoidClause(recentHeadlines, 'thisCard'),
  ]
    .filter((line) => line !== null)
    .join('\n')
}
