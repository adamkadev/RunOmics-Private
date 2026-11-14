import type { CoachingPlan } from './types'

/** A session the athlete moved on their calendar, by prescription id, to the day it now sits on. */
export type SessionMoves = Record<string, string>

export interface CalendarEntry {
  prescriptionId: string
  eventId: string
}

export interface CalendarEvent {
  id: string
  date: string
}

function plannedDates(plan: CoachingPlan): Map<string, string> {
  return new Map(plan.weeks.flatMap((week) => week.workouts.map((workout) => [workout.id, workout.date] as const)))
}

/** Against the plan as written; an event not listed keeps its earlier move, being out of the window read or deleted. */
export function detectSessionMoves(
  plan: CoachingPlan,
  entries: readonly CalendarEntry[],
  events: readonly CalendarEvent[],
  previous: SessionMoves,
): SessionMoves {
  const planned = plannedDates(plan)
  const eventDate = new Map(events.map((event) => [event.id, event.date]))
  const moves: SessionMoves = { ...previous }
  for (const entry of entries) {
    const date = eventDate.get(entry.eventId)
    const scheduled = planned.get(entry.prescriptionId)
    if (date === undefined || scheduled === undefined) continue
    if (date === scheduled) delete moves[entry.prescriptionId]
    else moves[entry.prescriptionId] = date
  }
  return Object.fromEntries(Object.entries(moves).sort(([a], [b]) => a.localeCompare(b)))
}

/** A move out of the session's own week is left out: a week holds only its own days. */
export function withMovedSessions(plan: CoachingPlan, moves: SessionMoves): CoachingPlan {
  if (!plan.weeks.some((week) => week.workouts.some((workout) => moves[workout.id] !== undefined))) return plan
  return {
    ...plan,
    weeks: plan.weeks.map((week) => ({
      ...week,
      workouts: week.workouts.map((workout) => {
        const date = moves[workout.id]
        return date && date !== workout.date && date >= week.startDate && date <= week.endDate ? { ...workout, date } : workout
      }),
    })),
  }
}

export function parseSessionMoves(raw: unknown): SessionMoves {
  const moves = raw && typeof raw === 'object' ? (raw as { moves?: unknown }).moves : undefined
  if (!moves || typeof moves !== 'object' || Array.isArray(moves)) return {}
  return Object.fromEntries(
    Object.entries(moves).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry[1])),
  )
}
