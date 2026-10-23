import { t } from '@/i18n'
import { formatWeekdayLong } from '@/lib/formatters'
import type { ActivityType } from '@/domain/activity/types'

export function activityTitle(activity: { description: string; date: string }): string {
  return activity.description || t.activity.runTitle(formatWeekdayLong(activity.date))
}

/** Leading words that only name a session type; null where a word fits several types ("Intervals" is VO₂ max or threshold). */
const TYPE_WORDS = new Map<string, ActivityType | null>([
  ['threshold', 'Threshold'], ['threshold run', 'Threshold'], ['seuil', 'Threshold'],
  ['tempo', 'Tempo'], ['tempo run', 'Tempo'],
  ['vo2 max', 'VO2Max'], ['vo2max', 'VO2Max'],
  ['sprint', 'Sprint'], ['anaerobic', 'Anaerobic'], ['anaérobie', 'Anaerobic'],
  ['easy', 'Base'], ['easy run', 'Base'], ['base', 'Base'], ['footing', 'Base'], ['endurance', 'Base'],
  ['recovery', 'Base'], ['recovery run', 'Base'], ['récupération', 'Base'], ['long run', 'Base'], ['sortie longue', 'Base'],
  ['intervals', null], ['interval', null], ['fractionné', null], ['fractionne', null], ['race', null], ['course', null],
])

function typeKey(words: string): string {
  return words.trim().replace(/[·:,\-–—]+$/, '').trim().toLowerCase().replace('₂', '2').replace(/\s+/g, ' ')
}

function isTypeWord(words: string): boolean {
  return TYPE_WORDS.has(typeKey(words))
}

/**
 * The type a run's name leads with, else the watch's: Garmin files a run by how it went (a threshold
 * session at too low a heart rate becomes tempo), but the session was what it was named.
 */
export function intendedType(activity: { type: ActivityType; description?: string | null }): ActivityType {
  const name = activity.description?.trim() ?? ''
  const leading = name.split(/\s[-–—·]\s|\d/u)[0] ?? ''
  return TYPE_WORDS.get(typeKey(leading)) ?? activity.type
}

/** A set of reps ("3 × 8", "4x3"), a length in minutes or seconds ("8′", "7'"), a pace ("@ 4:25") or a body and its extras ("54 min + 6 strides"). */
function isStructure(text: string): boolean {
  return /\d\s*[×xX*]\s*\d/.test(text) || /\d\s?[′'″"]/.test(text) || /@\s*\d/.test(text) || /\d.*\s\+\s/.test(text)
}

/** A set as the naming rules write it: "3x7'@4:25/km" -> "3 × 7′ @ 4:25", a rep's "7:00" -> "7′". */
function notation(set: string): string {
  return set
    .replace(/\/km\b/g, '')
    .replace(/(\d)\s*[xX*×]\s*(?=\d)/g, '$1 × ')
    .replace(/× (\d+):(\d{2})\b/g, (_, minutes: string, seconds: string) => (seconds === '00' ? `× ${minutes}′` : `× ${minutes}′${seconds}″`))
    .replace(/(\d)\s?'/g, '$1′')
    .replace(/(\d)\s?"/g, '$1″')
    .replace(/(\d)′(\d{2})(?![″\d])/g, '$1′$2″')
    .replace(/\s*@\s*/g, ' @ ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** "Strides" -> "strides", where it follows the set; "VO2" stays as written. */
function lowerFirst(words: string): string {
  return /^\p{Lu}\p{Ll}/u.test(words) ? words.charAt(0).toLocaleLowerCase() + words.slice(1) : words
}

/**
 * A name without the type its dot or eyebrow already shows: "Threshold · 3 × 8′ @ 4:25" reads "3 × 8′ @ 4:25".
 * A coach-then-Garmin name ("Threshold 2 x 7:00 - 2x7'@4:25") keeps Garmin's half; other words follow the
 * set ("Strides 6 × 20s" reads "6 × 20s strides"); a name with no set stays whole.
 */
export function sessionLabel(title: string): string {
  const name = title.trim()
  const dash = /\s[-–—]\s/.exec(name)
  if (dash) {
    const garmin = name.slice(dash.index + dash[0].length)
    if (isStructure(garmin)) return notation(garmin)
  }
  if (/^\d/.test(name)) return isStructure(name) ? notation(name) : name
  const match = /^(\p{L}[^\d]*?)[\s·:,\-–—]+(\d.*)$/u.exec(name)
  if (!match) return name
  const [, words, set] = match as unknown as [string, string, string]
  if (!isStructure(set)) return name
  return isTypeWord(words) ? notation(set) : `${notation(set)} ${lowerFirst(words.trim())}`
}
