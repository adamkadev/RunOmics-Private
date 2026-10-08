import type { ActivityType } from '@/domain/activity/types'
import type { CoachingWorkoutType } from '@/domain/coaching/types'
import type { ReadinessTone } from '@/domain/training/readiness'
import type { WeekDayState } from '@/domain/training/weekTarget'
import { isActivityType } from '@/domain/activity/types'
import { t } from '@/i18n'

/** What today holds, as the verdict reads it. */
export type TodayPlan = 'rest' | 'easy' | 'quality' | 'race' | 'done'

/** A session's kind in the coach's words: the plan's and a run's alike. */
export type SessionKind = CoachingWorkoutType

const KIND_OF_TYPE: Record<ActivityType, SessionKind> = {
  Base: 'easy',
  Tempo: 'tempo',
  Threshold: 'threshold',
  VO2Max: 'vo2max',
  Anaerobic: 'anaerobic',
  Sprint: 'sprint',
  Race: 'race',
}

/** A run that is still in the legs the next morning: everything but an easy or a recovery run. */
const HARD: ReadonlySet<SessionKind> = new Set(['long_run', 'tempo', 'threshold', 'vo2max', 'anaerobic', 'sprint', 'race'])
const QUALITY: ReadonlySet<SessionKind> = new Set(['tempo', 'threshold', 'vo2max', 'anaerobic', 'sprint'])

/** An activity type as a session kind; a type this build does not know reads as easy. */
export function kindOfType(type: string | null | undefined): SessionKind {
  return isActivityType(type) ? KIND_OF_TYPE[type] : 'easy'
}

/** Today by the session row's state and the planned type. */
export function todayPlanOf(state: WeekDayState, type: ActivityType | null): TodayPlan {
  if (state === 'done') return 'done'
  if (state !== 'planned') return 'rest'
  const kind = kindOfType(type)
  return kind === 'race' ? 'race' : QUALITY.has(kind) ? 'quality' : 'easy'
}

/**
 * What yesterday's run was, when there was one. A run's type cannot tell a
 * long run from an easy one - both are Base - so a Base run on a day the
 * coach set a long run is that long run.
 */
export function yesterdayKind(run: { type: string } | null, prescribed: SessionKind | null): SessionKind | null {
  if (!run) return null
  const kind = kindOfType(run.type)
  return kind === 'easy' && (prescribed === 'long_run' || prescribed === 'recovery') ? prescribed : kind
}

export interface TodayVerdictInput {
  tone: ReadinessTone
  today: TodayPlan
  /** Yesterday's run, when one was run. */
  yesterday: SessionKind | null
  /** The next session on the plan, and how many days away it is. */
  next: { date: string; inDays: number; kind: SessionKind | null } | null
}

function weekdayLong(date: string): string {
  return new Intl.DateTimeFormat(t.locale, { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}

/**
 * The coach card's verdict when there is no written one (v4.17.1): a short
 * headline that says what to do with today, and a body that says why and
 * what it gives. It never repeats a figure the Form / Fitness / Fatigue row
 * under it prints - "Fatigue is ahead of fitness · Form −15 · tired" was
 * that row, twice.
 */
export function todayVerdict({ tone, today, yesterday, next }: TodayVerdictInput): { headline: string; body: string } {
  const v = t.dashboard.todayHero.verdict
  const headline = v.headline[today][tone]

  const why =
    today === 'done'
      ? v.whyDone[tone]
      : tone !== 'go' && yesterday && HARD.has(yesterday)
        ? v.yesterdayInLegs(v.kind[yesterday])
        : v.why[tone]

  const ahead = next?.kind ? { when: next.inDays === 1 ? v.tomorrow : weekdayLong(next.date), kind: next.kind } : null
  const quality = ahead && QUALITY.has(ahead.kind) ? ahead : null
  let gain: string
  switch (today) {
    case 'rest':
      gain = ahead ? (tone === 'go' ? v.gain.restFresh : v.gain.restPaysOff)(ahead.when, v.kind[ahead.kind]) : v.gain.restSinksIn
      break
    case 'easy':
      gain =
        tone === 'hold'
          ? v.gain.easyHold
          : quality
            ? (tone === 'go' ? v.gain.easySave : v.gain.easyLands)(quality.when, v.kind[quality.kind])
            : tone === 'go' || tone === 'build'
              ? v.gain.easyGo
              : v.gain.easySettle
      break
    case 'quality':
      gain = v.gain.quality[tone]
      break
    case 'race':
      gain = v.gain.race[tone]
      break
    case 'done':
      gain = v.gain.done[tone]
      break
  }
  return { headline, body: [why, gain].filter(Boolean).join(' ') }
}
