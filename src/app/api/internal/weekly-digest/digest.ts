import type { CoachingOverview } from '@/application/coaching/GetCoachingView'
import type { ActivitySummary, PlannedWorkout } from '@/domain/activity/types'
import type { CrossTrainingEntry } from '@/domain/activity/crossTraining'
import { qualityKind } from '@/domain/training/qualitySession'
import type { RecoveryDay } from '@/domain/training/recovery'
import { weekTarget } from '@/domain/training/weekTarget'
import { planMaps, resolvePlannedType, weekDates, weekPlanDays } from '@/components/plan/weekPlanDays'
import { addDays, isoDate, startOfWeek } from '@/lib/calendarDate'
import { formatDelta, formatDurationWords, formatPlannedKm, formatRanKm } from '@/lib/formatters'
import { t } from '@/i18n'

export interface WeeklyDigest {
  ranKm: number
  planKm: number | null
  qualityDone: number
  qualityPlanned: number
  otherTrainingSeconds: number
  restingHr: { bpm: number; change: number } | null
  focus: string | null
}

export interface DigestInput {
  today: string
  activities: readonly ActivitySummary[]
  planned: readonly PlannedWorkout[]
  coaching: CoachingOverview | null
  recovery: readonly RecoveryDay[]
  crossTraining: readonly CrossTrainingEntry[]
}

const RESTING_HR_BASELINE_DAYS = 28
const MIN_WEEK_READINGS = 3
const MIN_BASELINE_READINGS = 7
const MAX_FOCUS_CHARS = 60

const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length

/** Read the way Plan reads a week, so the push and the Plan screen give the same counts. */
export function weeklyDigest({ today, activities, planned, coaching, recovery, crossTraining }: DigestInput): WeeklyDigest {
  const monday = addDays(startOfWeek(new Date(`${today}T00:00:00`)), -7)
  const lastMonday = isoDate(monday)
  const nextMonday = isoDate(addDays(monday, 7))
  const maps = planMaps(activities, planned, coaching?.workouts ?? [])
  const days = weekPlanDays(weekDates(monday), maps)
  const target = weekTarget(days, today, null)

  const week = recovery.filter((d) => d.date >= lastMonday && d.date < nextMonday).map((d) => d.restingHr)
  const baseline = recovery
    .filter((d) => d.date >= isoDate(addDays(monday, -RESTING_HR_BASELINE_DAYS)) && d.date < lastMonday)
    .map((d) => d.restingHr)

  return {
    ranKm: target.ranKm,
    planKm: target.planKm,
    qualityDone: days.filter((d) => d.runs > 0 && qualityKind(d.type) !== null).length,
    qualityPlanned: days.filter(
      (d) => d.plannedSessions > 0 && qualityKind(resolvePlannedType(d.date, maps.byDatePlanned, maps.byDateCoach)) !== null
    ).length,
    otherTrainingSeconds: crossTraining
      .filter((s) => s.date >= lastMonday && s.date < nextMonday)
      .reduce((sum, s) => sum + s.durationSeconds, 0),
    restingHr:
      week.length >= MIN_WEEK_READINGS && baseline.length >= MIN_BASELINE_READINGS
        ? { bpm: Math.round(mean(week)), change: Math.round(mean(week) - mean(baseline)) }
        : null,
    focus: coaching?.plan.weeks.find((w) => w.startDate <= today && today <= w.endDate)?.focus.trim() || null,
  }
}

function shorten(text: string): string {
  return text.length <= MAX_FOCUS_CHARS ? text : `${text.slice(0, MAX_FOCUS_CHARS - 1).trimEnd()}…`
}

/** Null for a week with nothing to say: no run, no other training, no plan, no resting HR, no focus. */
export function digestPush(digest: WeeklyDigest): { title: string; body: string } | null {
  const n = t.notifications.weeklyDigest
  if (digest.ranKm === 0 && digest.otherTrainingSeconds === 0 && digest.planKm === null && !digest.restingHr && !digest.focus) return null

  const volume = [
    digest.planKm !== null ? n.kmOfPlan(formatRanKm(digest.ranKm), formatPlannedKm(digest.planKm)) : n.km(formatRanKm(digest.ranKm)),
    digest.qualityPlanned > 0
      ? n.qualityOfPlan(digest.qualityDone, digest.qualityPlanned)
      : digest.qualityDone > 0 ? n.quality(digest.qualityDone) : null,
    digest.otherTrainingSeconds > 0 ? n.otherTraining(formatDurationWords(digest.otherTrainingSeconds)) : null,
  ]
  const outlook = [
    digest.restingHr ? n.restingHr(digest.restingHr.bpm, formatDelta(digest.restingHr.change)) : null,
    digest.focus ? n.focus(shorten(digest.focus)) : null,
  ]
  const line = (parts: (string | null)[]) => parts.filter(Boolean).join(' · ')
  return { title: n.title, body: [line(volume), line(outlook)].filter(Boolean).join('\n') }
}
