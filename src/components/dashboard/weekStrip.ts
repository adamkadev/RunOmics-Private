import type { ActivityType, PlannedWorkout } from '@/domain/activity/types'
import type { CoachingWorkoutType, WorkoutBlock } from '@/domain/coaching/types'
import type { WeekDayState, WeekTarget } from '@/domain/training/weekTarget'
import { sessionZone, zoneColor } from '@/lib/colors'
import { formatDate, formatNumber } from '@/lib/formatters'
import { formatWeekKm } from '@/components/plan/weekPlanDays'
import { t } from '@/i18n'

interface CoachDay {
  state: string
  prescription: { date: string; type: CoachingWorkoutType; blocks: readonly WorkoutBlock[] }
}

function hasStrides(blocks: readonly WorkoutBlock[]): boolean {
  return blocks.some((block) =>
    block.kind === 'repeat' ? block.steps.some((step) => step.kind === 'strides') : block.kind === 'strides',
  )
}

/** In Plan's priority (the coach's over Garmin's, a cancelled one is no plan), so the strip names the day Plan draws. */
export function plannedSessionKinds(
  dates: readonly string[],
  coach: readonly CoachDay[],
  garmin: readonly Pick<PlannedWorkout, 'date' | 'type'>[],
): Record<string, string> {
  const k = t.dashboard.weeklyStreak.kinds
  const kinds: Record<string, string> = {}
  for (const date of dates) {
    const view = coach.find((v) => v.prescription.date === date && v.state !== 'cancelled')
    if (view) {
      const { type, blocks } = view.prescription
      kinds[date] = type === 'easy' && hasStrides(blocks) ? k.easyStrides : k[type]
      continue
    }
    const plan = garmin.find((p) => p.date === date)
    if (plan?.type) kinds[date] = typeKind(plan.type)
  }
  return kinds
}

function typeKind(type: ActivityType | undefined): string {
  // A type this build does not know yet has no label; name it as it came.
  return type ? (t.activityTypes[type] ?? type) : ''
}

export interface WeekStripDay {
  date: string
  /** "Mon". */
  weekday: string
  /** "M", under the day's circle. */
  letter: string
  state: WeekDayState
  isToday: boolean
  /** Run km on a day run, planned km on a day to come or missed; null on rest, a session run on another day, or none given. */
  km: number | null
  /** The km as the circle writes it: "12.8" run, "13" planned. */
  kmText: string | null
  /** The session's category colour, as a token. */
  color: string
  /** What the day is: the planned session, what was run instead, or Rest. */
  kind: string
  /** The day's accessible name. */
  label: string
}

/** From the same WeekTarget as the week's km total, so the circles and the total agree. */
export function weekStripDays(days: WeekTarget['days'], today: string, kinds: Record<string, string>): WeekStripDay[] {
  return days.map((day, i) => {
    const km = day.state === 'done' ? (day.runs > 0 ? day.ranKm : null) : day.state === 'rest' ? null : day.plannedKm
    // A run day says what was run when it was not what was planned.
    const kind =
      day.state === 'rest'
        ? t.dashboard.weeklyStreak.kinds.rest
        : day.state === 'done' && (day.plannedType || !kinds[day.date])
          ? typeKind(day.type)
          : (kinds[day.date] ?? typeKind(day.type))
    // One decimal at most: a 34 pt circle holds "9.2", not "9.23".
    const kmText = km === null ? null : day.state === 'done' ? formatNumber(km, 1) : formatWeekKm(km)
    const isToday = day.date === today
    const state = [t.sessionState[day.state], isToday ? t.sessionState.today : null].filter(Boolean).join(' · ')
    const weekday = t.plan.weekdays[i] ?? ''
    return {
      date: day.date,
      weekday,
      letter: weekday.charAt(0).toUpperCase(),
      state: day.state,
      isToday,
      km,
      kmText,
      color: zoneColor(sessionZone(day)),
      kind,
      label: [
        t.sessionState.dayLabel(formatDate(day.date, { style: 'full' }), state),
        day.state === 'rest' ? null : kind,
        kmText !== null ? `${kmText} ${t.units.km}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    }
  })
}
