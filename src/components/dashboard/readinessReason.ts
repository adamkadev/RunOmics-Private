import type { ActivitySummary, PlannedWorkout } from '@/domain/activity/types'
import { intendedType } from '@/lib/activityTitle'
import { addDays, isoDate } from '@/lib/calendarDate'
import { sessionOn, type NextSession } from './nextSession'
import { kindOfType, type SessionKind } from './sessionKind'

/** Why the load reads as it does today, from the days around it: the readiness headline's reason. */
export type ReadinessReason =
  | { kind: 'rest'; session: SessionKind; date: string }
  | { kind: 'yesterday'; session: SessionKind }
  | { kind: 'today'; session: SessionKind }

const HARD: ReadonlySet<SessionKind> = new Set(['long_run', 'tempo', 'threshold', 'vo2max', 'anaerobic', 'sprint', 'race'])

export function readinessReason(
  today: string,
  coach: Parameters<typeof sessionOn>[1],
  garmin: readonly PlannedWorkout[],
  activities: readonly Pick<ActivitySummary, 'date' | 'type' | 'description'>[],
  next: NextSession | null,
): ReadinessReason | null {
  const todaySession = sessionOn(today, coach, garmin, null)
  const ranToday = activities.some((a) => a.date === today)
  if (!todaySession && !ranToday && next?.kind) return { kind: 'rest', session: next.kind, date: next.date }

  const yesterday = isoDate(addDays(new Date(`${today}T00:00:00`), -1))
  const yesterdayRun = activities.find((a) => a.date === yesterday)
  // The plan says what the day was for: the watch can type a run/walk VO2 max.
  const yesterdayKind = yesterdayRun ? (sessionOn(yesterday, coach, garmin, null)?.kind ?? kindOfType(intendedType(yesterdayRun))) : null
  if (!ranToday && yesterdayKind && HARD.has(yesterdayKind)) return { kind: 'yesterday', session: yesterdayKind }

  if (!ranToday && todaySession?.kind && HARD.has(todaySession.kind)) return { kind: 'today', session: todaySession.kind }
  return null
}
