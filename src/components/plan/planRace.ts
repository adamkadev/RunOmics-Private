import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import { shortDist } from '@/components/goals/shortDistance'
import { DAY_MS, isoDate, startOfWeek } from '@/lib/calendarDate'
import { formatDate } from '@/lib/formatters'
import { t } from '@/i18n'
import type { PlanCoachingView } from './planCoachingView'

export type PlanRace = Pick<UpcomingRace, 'date' | 'name' | 'distance' | 'location'>

/**
 * The race the plan builds to: the coaching block's target, else its next
 * tune-up still to come; Garmin's next race when there is no coaching. The
 * header counts down to it and the phase card names its week (v4.17), so both
 * read the same race.
 */
export function planRace(coaching: PlanCoachingView | null, nextRace: UpcomingRace | null | undefined, today: string): PlanRace | null {
  if (!coaching) return nextRace && nextRace.date >= today ? nextRace : null
  const { targetEvent, tuneUpEvents } = coaching.plan
  const event = [...(targetEvent ? [targetEvent] : []), ...(tuneUpEvents ?? [])].find((e) => e.date >= today)
  return event ? { date: event.date, name: event.name, distance: event.distanceLabel ?? '', location: event.location } : null
}

const DISTANCE_ONLY = /^\s*\d+(?:[.,]\d+)?\s*(?:k|km|m|mi|miles?)\s*$/i

/** "10K Wintzenheim": a name that only restates the distance gives way to the distance and the place. */
export function raceTitle(race: PlanRace): string {
  if (!DISTANCE_ONLY.test(race.name) && race.name !== race.distance) return race.name
  return [shortDist(race.distance) || race.name, race.location].filter(Boolean).join(' ')
}

export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(date) - Date.parse(today)) / DAY_MS)
}

/** The header's subtitle: "10K Wintzenheim · Nov 29 · 62 days to go". */
export function raceSubtitle(race: PlanRace, today: string): string {
  return [raceTitle(race), formatDate(race.date, { style: 'bare' }), t.plan.header.daysToGo(daysUntil(race.date, today))].join(' · ')
}

/** "Race week Nov 23": the Monday of the week the race falls in. */
export function raceWeekLabel(race: PlanRace): string {
  const monday = isoDate(startOfWeek(new Date(`${race.date}T00:00:00`)))
  return t.plan.phaseTrack.raceWeek(formatDate(monday, { style: 'bare' }))
}
