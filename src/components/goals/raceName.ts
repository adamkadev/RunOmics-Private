import type { UpcomingRace } from '@/application/usecases/GetGoalsData'

/** Garmin fills in the distance ("10 km" for a 10K) as the name until a real event name is set. */
export function isPlaceholderRaceName(distance: string, name: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/\bkm\b/g, 'k').replace(/[^a-z0-9]/g, '')
  return normalize(name) === normalize(distance)
}

/** A plain module, not the client SeasonRaces, so a server page can call it too. */
export function raceDisplayName(race: Pick<UpcomingRace, 'distance' | 'name' | 'location'>): string {
  return isPlaceholderRaceName(race.distance, race.name) && race.location ? race.location : race.name
}
