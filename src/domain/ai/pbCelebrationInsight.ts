import type { RecordEntry } from '@/application/usecases/GetRecords'
import { HERO_POOL } from './budget'
import { insightHash } from './insightHash'
import { avoidClause, systemInstruction } from './prompt'
import { formatClock } from '@/lib/formatters'

export const PB_CELEBRATION_SURFACE = 'pbCelebration'
export const PB_CELEBRATION_LIMITS = { headline: 48, body: 130 }

// A handful of calls a year, on the one screen that takes over the whole app:
// the strongest model, and the cheapest surface in the budget by far.
export const PB_CELEBRATION_POOL = HERO_POOL

/** How long a record stays worth celebrating - shared with the overlay's own check. */
export const CELEBRATION_WINDOW_DAYS = 3

/** The record the overlay would raise, or null when there is nothing to celebrate. */
export function celebratedRecord(record: RecordEntry | null, now: Date): RecordEntry | null {
  if (!record?.activityId || !record.date || record.seconds === null) return null
  const days = (now.getTime() - new Date(record.date + 'T00:00:00').getTime()) / 86_400_000
  return days >= 0 && days <= CELEBRATION_WINDOW_DAYS ? record : null
}

function facts(record: RecordEntry) {
  return {
    key: record.key,
    label: record.label,
    seconds: record.seconds,
    distanceKm: record.distanceKm ?? null,
    official: record.official,
    event: record.eventName ?? null,
  }
}

export function pbCelebrationInsightHash(record: RecordEntry): string {
  return insightHash(facts(record))
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
  'Be warm and direct, never breathless. No exclamation marks stacked up, no emoji.',
].join(' ')

export function pbCelebrationInsightPrompt(record: RecordEntry, recentHeadlines: string[]): string {
  const f = facts(record)

  return [
    'Facts:',
    `- Record: ${f.label}`,
    f.seconds !== null ? `- Time: ${formatClock(f.seconds)}` : null,
    f.distanceKm ? `- Distance: ${f.distanceKm} km` : null,
    f.official ? `- Set in an official race${f.event ? `: ${f.event}` : ''}` : '- Set in training, not in a race',
    avoidClause(recentHeadlines),
  ]
    .filter((line) => line !== null)
    .join('\n')
}
