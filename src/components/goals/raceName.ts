import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import { shortDist } from './shortDistance'

/** Garmin fills in the distance ("10 km" for a 10K) as the name until a real event name is set. */
export function isPlaceholderRaceName(distance: string, name: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/\bkm\b/g, 'k').replace(/[^a-z0-9]/g, '')
  return normalize(name) === normalize(distance)
}

const EVENT_WORD = /\b(?:half[- ]marathon|semi[- ]marathon|marathon)\b/i
const YEAR = /\s*\b(?:19|20)\d{2}\b/g
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * "ING Night Marathon Luxembourg" run as a half reads "ING Night Half": the event's word gives way to the race's own
 * distance, and the year and the city, which the facts line carries, go.
 */
export function raceShortName(name: string, distance: string, location?: string): string {
  const city = location ? new RegExp(`\\s*(?:\\b(?:de|du|d’|d'|à|in|of)\\s+)?\\b${escaped(location)}\\b`, 'i') : null
  const short = (city ? name.replace(city, '') : name).replace(YEAR, '').replace(EVENT_WORD, shortDist(distance))
  return short.replace(/\s+/g, ' ').trim() || name
}

/** A plain module, not the client SeasonRaces, so a server page can call it too. */
export function raceDisplayName(race: Pick<UpcomingRace, 'distance' | 'name' | 'location'>): string {
  if (isPlaceholderRaceName(race.distance, race.name)) return race.location ?? race.name
  return raceShortName(race.name, race.distance, race.location)
}
