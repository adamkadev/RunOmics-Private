import { shortDist } from '@/components/goals/shortDistance'

const EVENT_WORD = /\b(?:half[- ]marathon|semi[- ]marathon|marathon)\b/i
const YEAR = /\s*\b(?:19|20)\d{2}\b/g

/** "Spring Marathon" run as a half reads "Spring Half": the event's word gives way to the race's own distance. */
export function raceShortName(name: string, distance: string): string {
  return name.replace(YEAR, '').replace(EVENT_WORD, shortDist(distance)).replace(/\s+/g, ' ').trim() || name
}
