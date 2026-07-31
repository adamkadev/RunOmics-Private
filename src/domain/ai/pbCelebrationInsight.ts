import type { RecordEntry } from '@/application/usecases/GetRecords'
import { insightHash } from './insightHash'
import { avoidClause, systemInstruction } from './prompt'
import { formatClock } from '@/lib/formatters'

export const PB_CELEBRATION_SURFACE = 'pbCelebration'
export const PB_CELEBRATION_LIMITS = { headline: 48, body: 130 }

/** How long a record stays worth celebrating - shared with the overlay's own check. */
export const CELEBRATION_WINDOW_DAYS = 3

/** The record the overlay would raise, or null when there is nothing to celebrate. */
export function celebratedRecord(record: RecordEntry | null, now: Date): RecordEntry | null {
  if (!record?.activityId || !record.date || record.seconds === null) return null
  const days = (now.getTime() - new Date(record.date + 'T00:00:00').getTime()) / 86_400_000
  return days >= 0 && days <= CELEBRATION_WINDOW_DAYS ? record : null
}

export interface PbCelebrationContext {
  record: RecordEntry
  /** The mark this one replaced - the whole reason the moment counts. */
  previous: { seconds: number; date: string } | null
}

function facts({ record, previous }: PbCelebrationContext) {
  return {
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
  // The distance and the finish time are set in huge type right under this
  // text, which is the whole design of the card.
  'The distance and the time are already printed in large type under your text: never state them.',
  'The mark it replaced is not printed anywhere, so naming it - and how long it stood - is the one number worth writing.',
  'Be warm and direct, never breathless. No exclamation marks stacked up, no emoji.',
].join(' ')

const DAY_MS = 86_400_000

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / DAY_MS)
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
    previous ? `- The mark it replaces: ${formatClock(previous.seconds)}, set on ${previous.date}` : null,
    previous && stoodDays !== null ? `- That mark had stood for ${stoodDays} days` : null,
    previous && f.seconds !== null ? `- Taken off it: ${Math.round(previous.seconds - f.seconds)}s` : null,
    avoidClause(recentHeadlines),
  ]
    .filter((line) => line !== null)
    .join('\n')
}
