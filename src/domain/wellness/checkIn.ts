import { DAY_MS } from '@/lib/calendarDate'

export const CHECK_IN_SCORES = ['sleep', 'soreness', 'stress', 'mood'] as const
export type CheckInScore = (typeof CHECK_IN_SCORES)[number]

export const SCORE_MIN = 1
export const SCORE_MAX = 5
export const PAIN_MAX = 10

export const NIGGLE_SITES = ['foot', 'ankle', 'achilles', 'calf', 'shin', 'knee', 'hamstring', 'quad', 'hip', 'back', 'other'] as const
export type NiggleSite = (typeof NIGGLE_SITES)[number]

export const NIGGLE_SIDES = ['left', 'right'] as const
export type NiggleSide = (typeof NIGGLE_SIDES)[number]

export interface Niggle {
  site: NiggleSite
  side?: NiggleSide
  pain: number
  /** The athlete's own call that it changes today's run. */
  changesRun?: boolean
}

export const SKIP_REASONS = ['ill', 'rest', 'life'] as const
export type SkipReason = (typeof SKIP_REASONS)[number]

/** One morning's answers, any of them left out. Every score is 1 worst to 5 best, as in McLean's wellness questionnaire. */
export interface CheckIn {
  sleep?: number
  soreness?: number
  stress?: number
  mood?: number
  ill?: boolean
  travel?: boolean
  niggle?: Niggle
  /** The day's planned session, marked skipped on Plan and why. */
  skipped?: SkipReason
}

export function isSkipReason(value: unknown): value is SkipReason {
  return (SKIP_REASONS as readonly unknown[]).includes(value)
}

export const WELLNESS_COLLECTION = 'wellness'

export function isCheckInDate(id: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(id) && !Number.isNaN(Date.parse(`${id}T00:00:00Z`))
}

function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

function readNiggle(raw: unknown): Niggle | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const { site, side, pain, changesRun } = raw as Record<string, unknown>
  if (!(NIGGLE_SITES as readonly unknown[]).includes(site) || !isInt(pain, 0, PAIN_MAX)) return undefined
  return {
    site: site as NiggleSite,
    ...((NIGGLE_SIDES as readonly unknown[]).includes(side) ? { side: side as NiggleSide } : {}),
    pain,
    ...(changesRun === true ? { changesRun: true } : {}),
  }
}

/** Firestore and the backup are read through this, so a malformed field is dropped rather than shown or sent to the coach. */
export function readCheckIn(raw: unknown): CheckIn | null {
  if (typeof raw !== 'object' || raw === null) return null
  const data = raw as Record<string, unknown>
  const entry: CheckIn = {}
  for (const field of CHECK_IN_SCORES) {
    const value = data[field]
    if (isInt(value, SCORE_MIN, SCORE_MAX)) entry[field] = value
  }
  if (data.ill === true) entry.ill = true
  if (data.travel === true) entry.travel = true
  const niggle = readNiggle(data.niggle)
  if (niggle) entry.niggle = niggle
  if (isSkipReason(data.skipped)) entry.skipped = data.skipped
  return isEmptyCheckIn(entry) ? null : entry
}

export function isEmptyCheckIn(entry: CheckIn): boolean {
  return CHECK_IN_SCORES.every((field) => entry[field] === undefined) && !entry.ill && !entry.travel && !entry.niggle && !entry.skipped
}

export function isCompleteCheckIn(entry: CheckIn | null): boolean {
  return entry !== null && CHECK_IN_SCORES.every((field) => entry[field] !== undefined)
}

/** The numeric pain scale's bands: 4 to 6 is moderate, 7 and over severe. */
export const PAIN_EASE = 4
export const PAIN_STOP = 7
const POOR_SLEEP = 2
const SORE = 2

export type CheckInConcern =
  | { kind: 'ill' }
  | { kind: 'pain'; niggle: Niggle }
  | { kind: 'sleepSoreness'; sleep: number; soreness: number }

export interface CheckInReading {
  tone: 'caution' | 'hold'
  /** The gravest first: it writes the card's headline. */
  concerns: CheckInConcern[]
}

/** Only answers with a recognised reason to ease off; a merely flat morning tempers nothing. */
export function readCheckInConcerns(entry: CheckIn | null): CheckInReading | null {
  if (!entry) return null
  const hold: CheckInConcern[] = []
  const caution: CheckInConcern[] = []
  if (entry.ill) hold.push({ kind: 'ill' })
  if (entry.niggle) {
    if (entry.niggle.pain >= PAIN_STOP) hold.push({ kind: 'pain', niggle: entry.niggle })
    else if (entry.niggle.pain >= PAIN_EASE || entry.niggle.changesRun) caution.push({ kind: 'pain', niggle: entry.niggle })
  }
  if (entry.sleep !== undefined && entry.soreness !== undefined && entry.sleep <= POOR_SLEEP && entry.soreness <= SORE) {
    caution.push({ kind: 'sleepSoreness', sleep: entry.sleep, soreness: entry.soreness })
  }
  if (hold.length > 0) return { tone: 'hold', concerns: [...hold, ...caution] }
  if (caution.length > 0) return { tone: 'caution', concerns: caution }
  return null
}

function dayNumber(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS)
}

export function shiftDate(date: string, days: number): string {
  return new Date((dayNumber(date) + days) * DAY_MS).toISOString().slice(0, 10)
}

export interface NiggleEpisode {
  site: NiggleSite
  side?: NiggleSide
  from: string
  to: string
  /** Days it was reported, not days between from and to. */
  daysReported: number
  peakPain: number
  lastPain: number
  daysChangingRun: number
}

/** Up to this many days without a report still count as one niggle: mornings get skipped. */
const EPISODE_GAP_DAYS = 3

/** Newest first. A site on the other side is another niggle. */
export function niggleEpisodes(entries: ReadonlyMap<string, CheckIn>): NiggleEpisode[] {
  const open = new Map<string, NiggleEpisode>()
  const episodes: NiggleEpisode[] = []
  const dates = [...entries.keys()].filter(isCheckInDate).sort()
  for (const date of dates) {
    const niggle = entries.get(date)?.niggle
    if (!niggle) continue
    const key = `${niggle.site}:${niggle.side ?? ''}`
    const current = open.get(key)
    if (current && dayNumber(date) - dayNumber(current.to) <= EPISODE_GAP_DAYS + 1) {
      current.to = date
      current.daysReported += 1
      current.peakPain = Math.max(current.peakPain, niggle.pain)
      current.lastPain = niggle.pain
      if (niggle.changesRun) current.daysChangingRun += 1
      continue
    }
    const episode: NiggleEpisode = {
      site: niggle.site,
      ...(niggle.side ? { side: niggle.side } : {}),
      from: date,
      to: date,
      daysReported: 1,
      peakPain: niggle.pain,
      lastPain: niggle.pain,
      daysChangingRun: niggle.changesRun ? 1 : 0,
    }
    open.set(key, episode)
    episodes.push(episode)
  }
  return episodes.sort((a, b) => b.to.localeCompare(a.to) || b.from.localeCompare(a.from))
}

/** The window ending on `to`, oldest first, one slot per day whether or not it was answered. */
export function checkInDays(entries: ReadonlyMap<string, CheckIn>, to: string, days: number): { date: string; entry: CheckIn | null }[] {
  return Array.from({ length: days }, (_, i) => {
    const date = shiftDate(to, i - days + 1)
    return { date, entry: entries.get(date) ?? null }
  })
}
