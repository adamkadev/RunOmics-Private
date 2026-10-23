/**
 * Days either side within which a run counts as an unrun session's, so a
 * Tuesday run moved to Wednesday is one done session, not missed plus extra.
 */
export const PLAN_MATCH_WINDOW_DAYS = 1

export type MonthDayState = 'done' | 'extra' | 'missed' | 'planned' | 'rest'

export interface MonthDay {
  state: MonthDayState
  ranOn?: string
  standsFor?: string
}

const DAY_MS = 86_400_000
const plusDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)

/** The day before, then the day after, then two before... out to the window. */
function offsets(window: number): number[] {
  return Array.from({ length: window }, (_, i) => [-(i + 1), i + 1]).flat()
}

/**
 * Matching looks past the grid's edges, so a run on the 31st can stand for a
 * session planned on the 1st of the next month on both months' screens.
 */
export function monthDays(
  dates: readonly string[],
  ran: (date: string) => boolean,
  planned: (date: string) => boolean,
  today: string,
  window = PLAN_MATCH_WINDOW_DAYS,
): Map<string, MonthDay> {
  const first = dates[0]
  const last = dates.at(-1)
  const days = new Map<string, MonthDay>()
  if (!first || !last) return days

  const unrun: string[] = []
  for (let d = plusDays(first, -window); d <= plusDays(last, window); d = plusDays(d, 1)) {
    if (planned(d) && !ran(d)) unrun.push(d)
  }
  const ranOn = new Map<string, string>()
  const standsFor = new Map<string, string>()
  for (const day of unrun) {
    for (const offset of offsets(window)) {
      const other = plusDays(day, offset)
      if (other > today || !ran(other) || planned(other) || standsFor.has(other)) continue
      ranOn.set(day, other)
      standsFor.set(other, day)
      break
    }
  }

  for (const date of dates) {
    const isPlanned = planned(date)
    const isRun = ran(date)
    if (isPlanned && isRun) days.set(date, { state: 'done' })
    else if (isPlanned && ranOn.has(date)) days.set(date, { state: 'done', ranOn: ranOn.get(date)! })
    else if (isPlanned) days.set(date, { state: date < today ? 'missed' : 'planned' })
    else if (isRun && standsFor.has(date)) days.set(date, { state: 'done', standsFor: standsFor.get(date)! })
    else if (isRun) days.set(date, { state: 'extra' })
    else days.set(date, { state: 'rest' })
  }
  return days
}
