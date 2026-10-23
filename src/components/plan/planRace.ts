import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import { shortDist } from '@/components/goals/shortDistance'
import { DAY_MS } from '@/lib/calendarDate'
import type { PlanCoachingView } from './planCoachingView'

export type PlanRace = Pick<UpcomingRace, 'date' | 'name' | 'distance' | 'location'>

export function planRace(coaching: PlanCoachingView | null, nextRace: UpcomingRace | null | undefined, today: string): PlanRace | null {
  if (!coaching) return nextRace && nextRace.date >= today ? nextRace : null
  const { targetEvent, tuneUpEvents } = coaching.plan
  const event = [...(targetEvent ? [targetEvent] : []), ...(tuneUpEvents ?? [])].find((e) => e.date >= today)
  return event ? { date: event.date, name: event.name, distance: event.distanceLabel ?? '', location: event.location } : null
}

const DISTANCE_ONLY = /^\s*\d+(?:[.,]\d+)?\s*(?:k|km|m|mi|miles?)\s*$/i

export function raceTitle(race: PlanRace): string {
  if (!DISTANCE_ONLY.test(race.name) && race.name !== race.distance) return race.name
  return [shortDist(race.distance) || race.name, race.location].filter(Boolean).join(' ')
}

export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(date) - Date.parse(today)) / DAY_MS)
}
