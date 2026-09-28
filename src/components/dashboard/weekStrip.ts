import { isActivityType, type ActivityType, type PlannedWorkout } from '@/domain/activity/types'
import type { CoachingWorkoutType, WorkoutBlock } from '@/domain/coaching/types'
import type { WeekDayState, WeekTarget } from '@/domain/training/weekTarget'
import { sessionZone, zoneColor } from '@/lib/colors'
import { formatDate, formatRanKm } from '@/lib/formatters'
import { formatWeekKm } from '@/components/plan/weekPlanDays'
import { t } from '@/i18n'
import { kindOfType } from './todayVerdict'

interface CoachDay {
  state: string
  prescription: { date: string; type: CoachingWorkoutType; blocks: readonly WorkoutBlock[] }
}

function hasStrides(blocks: readonly WorkoutBlock[]): boolean {
  return blocks.some((block) =>
    block.kind === 'repeat' ? block.steps.some((step) => step.kind === 'strides') : block.kind === 'strides',
  )
}

/**
 * What each planned day of the week is, in the one or two words the week
 * strip writes under its bar (v4.17): "Threshold", "Easy + strides",
 * "Long run". Plan's priority - the coach's prescription over Garmin's, a
 * cancelled one is no plan - so the strip names the day Plan draws.
 */
export function plannedSessionKinds(
  dates: readonly string[],
  coach: readonly CoachDay[],
  garmin: readonly Pick<PlannedWorkout, 'date' | 'type'>[],
): Record<string, KindLabel> {
  const k = t.dashboard.weeklyStreak.kinds
  const kinds: Record<string, KindLabel> = {}
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

/** A day's session in words, long and short: "Threshold" and, under 480 pt, "Thr" (v4.17.3). */
export interface KindLabel {
  label: string
  shortLabel: string
}

function typeKind(type: ActivityType | undefined): KindLabel {
  if (!type) return { label: '', shortLabel: '' }
  // A type this build does not know yet has no label; name it as it came.
  const label = t.activityTypes[type] ?? type
  return { label, shortLabel: isActivityType(type) ? t.dashboard.weeklyStreak.kinds[kindOfType(type)].shortLabel : label }
}

export interface WeekStripDay {
  date: string
  /** "Mon". */
  weekday: string
  state: WeekDayState
  isToday: boolean
  /** Run km on a day run, planned km on a day to come or missed; null on rest or when the plan gave none. */
  km: number | null
  /** The km as the label over the bar writes it: "12.8" run, "13" planned. */
  kmText: string | null
  /** The bar's height against the week's tallest day, 0-1; null draws the stub. */
  share: number | null
  /** The session's category colour, as a token. */
  color: string
  /** What the day is: the planned session, what was run instead, or Rest. */
  kind: string
  /** The same in a word, for a phone under 480 pt: "Thr", "Long", "Int". */
  kindShort: string
  /** The day's accessible name. */
  label: string
}

/**
 * The seven days as Today's week strip draws them, from the same WeekTarget
 * the "0 of 51 km" beside it reads, so the bars and the total agree.
 */
export function weekStripDays(days: WeekTarget['days'], today: string, kinds: Record<string, KindLabel>): WeekStripDay[] {
  const kmOf = (day: WeekTarget['days'][number]) =>
    day.state === 'done' ? day.ranKm : day.state === 'rest' ? null : day.plannedKm
  const tallest = Math.max(0, ...days.map((day) => kmOf(day) ?? 0))

  return days.map((day, i) => {
    const km = kmOf(day)
    // A run day says what was run when it was not what was planned.
    const named =
      day.state === 'rest'
        ? t.dashboard.weeklyStreak.kinds.rest
        : day.state === 'done' && (day.plannedType || !kinds[day.date])
          ? typeKind(day.type)
          : (kinds[day.date] ?? typeKind(day.type))
    const kind = named.label
    const kmText = km === null ? null : day.state === 'done' ? formatRanKm(km) : formatWeekKm(km)
    const isToday = day.date === today
    const state = [t.sessionState[day.state], isToday ? t.sessionState.today : null].filter(Boolean).join(' · ')
    return {
      date: day.date,
      weekday: t.plan.weekdays[i] ?? '',
      state: day.state,
      isToday,
      km,
      kmText,
      share: km !== null && tallest > 0 ? km / tallest : null,
      color: zoneColor(sessionZone(day)),
      kind,
      kindShort: named.shortLabel,
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
