import { DAY_MS } from '@/lib/calendarDate'
import type { RecordEntry } from '@/domain/race/records'
import { insightHash } from './insightHash'
import { isRecentRecord } from './celebrationWindow'
import { avoidClause, CARD_PROMPT_VERSION, promptVersion, systemInstruction } from './prompt'
import { formatClock } from '@/lib/formatters'

export const PB_CELEBRATION_SURFACE = 'pbCelebration'
export const PB_CELEBRATION_LIMITS = { headline: 48, body: 130 }

export function celebratedRecord(record: RecordEntry | null, now: Date): RecordEntry | null {
  if (!record?.activityId || !record.date || record.seconds === null) return null
  return isRecentRecord(record.date, now) ? record : null
}

export interface PbCelebrationContext {
  record: RecordEntry
  previous: { seconds: number; date: string } | null
}

function facts({ record, previous }: PbCelebrationContext) {
  return {
    promptVersion: promptVersion(CARD_PROMPT_VERSION),
    key: record.key,
    label: record.label,
    seconds: record.seconds,
    distanceKm: record.distanceKm ?? null,
    official: record.official,
    event: record.eventName ?? null,
    previousSeconds: previous?.seconds ?? null,
    previousDate: previous?.date ?? null,
  }
}

export function pbCelebrationInsightHash(context: PbCelebrationContext): string {
  return insightHash(facts(context))
}

export const PB_CELEBRATION_SYSTEM_INSTRUCTION = [
  systemInstruction(
    'You are a running coach congratulating an athlete on the full-screen card that celebrates a personal record they just set.',
    'one sentence on what the record says about their running',
    PB_CELEBRATION_LIMITS
  ),
  'The distance and the time are already printed in large type under your text: never state them.',
  // Conditional: said unconditionally, it pushes the model to invent a mark for a first record.
  'When the mark it replaced is given, it is not printed anywhere, so naming it - and how long it stood - is the one number worth writing. When none is given, this is the first time on record at this distance: say so, and never invent an earlier time.',
  'Be warm and direct, never breathless. No exclamation marks stacked up, no emoji.',
].join(' ')

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / DAY_MS)
}

const DAYS_PER_MONTH = 30.44

/** "5 months", not "163 days" or the ISO date it was set on, for the model to copy. */
function stoodFor(days: number): string {
  if (days < 60) return `${days} day${days === 1 ? '' : 's'}`
  const months = Math.round(days / DAYS_PER_MONTH)
  return months < 24 ? `${months} months` : `${Math.round(days / 365)} years`
}

export function pbCelebrationInsightPrompt(context: PbCelebrationContext, recentHeadlines: string[]): string {
  const { record, previous } = context
  const f = facts(context)
  const stoodDays = previous && record.date ? daysBetween(previous.date, record.date) : null

  return [
    'Facts:',
    `- Record: ${f.label}`,
    f.seconds !== null ? `- Time: ${formatClock(f.seconds)}` : null,
    f.distanceKm ? `- Distance: ${f.distanceKm} km` : null,
    f.official ? `- Set in an official race${f.event ? `: ${f.event}` : ''}` : '- Set in training, not in a race',
    previous ? `- The mark it replaces: ${formatClock(previous.seconds)}` : '- No earlier mark at this distance: a first record',
    previous && stoodDays !== null ? `- That mark had stood for ${stoodFor(stoodDays)}` : null,
    previous && f.seconds !== null ? `- Taken off it: ${Math.round(previous.seconds - f.seconds)}s` : null,
    avoidClause(recentHeadlines),
  ]
    .filter((line) => line !== null)
    .join('\n')
}
