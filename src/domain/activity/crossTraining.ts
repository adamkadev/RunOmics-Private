import { DAY_MS } from '@/lib/calendarDate'

/** One work set of a strength session, as its FIT file records it; a field the watch did not log is absent. */
export interface StrengthSet {
  category?: string
  exercise?: string
  reps?: number
  weightKg?: number
  durationSeconds?: number
}

/** A non-running activity: never an Activity, so no running metric, load or record reads one. */
export interface CrossTrainingSession {
  id: string
  date: string
  startTimeLocal?: string
  /** Garmin's activity type key: strength_training, road_biking, lap_swimming… */
  sport: string
  durationSeconds: number
  distanceKm: number | null
  avgHeartRate: number | null
  /** Garmin's training load for the activity, when the watch scored one. */
  trainingLoad: number | null
  sets?: StrengthSet[]
}

export const CROSS_TRAINING_KINDS = ['strength', 'cycling', 'swimming', 'walking', 'cardio', 'mobility', 'other'] as const
export type CrossTrainingKind = (typeof CROSS_TRAINING_KINDS)[number]

const KIND_PATTERNS: [CrossTrainingKind, RegExp][] = [
  ['strength', /strength/],
  ['cycling', /cycl|bik|ride/],
  ['swimming', /swim/],
  ['walking', /walk|hik/],
  ['mobility', /yoga|pilates|stretch|mobility/],
  ['cardio', /cardio|hiit|elliptical|stair|row|ski|paddl/],
]

export function crossTrainingKind(sport: string): CrossTrainingKind {
  return KIND_PATTERNS.find(([, pattern]) => pattern.test(sport))?.[0] ?? 'other'
}

/** What a list or a calendar draws of a session: the heart rate, the load and the sets stay on the server. */
export interface CrossTrainingEntry {
  id: string
  date: string
  kind: CrossTrainingKind
  durationSeconds: number
  distanceKm: number | null
  /** Work sets the FIT file recorded; null when it recorded none. */
  sets: number | null
}

export function crossTrainingEntry(session: CrossTrainingSession): CrossTrainingEntry {
  return {
    id: session.id,
    date: session.date,
    kind: crossTrainingKind(session.sport),
    durationSeconds: session.durationSeconds,
    distanceKm: session.distanceKm,
    sets: session.sets?.length || null,
  }
}

const COACH_DAYS = 28

export interface OtherTrainingFacts {
  minutes7Days: number
  minutes28Days: number
  sessions: { date: string; kind: CrossTrainingKind; minutes: number; trainingLoad?: number; sets?: number }[]
}

/** Null without a session in the 28 days, so a context with none reads and hashes as it did before. */
export function otherTrainingFacts(sessions: readonly CrossTrainingSession[], referenceDate: string): OtherTrainingFacts | null {
  const reference = Date.parse(`${referenceDate}T00:00:00Z`)
  const ageOf = (date: string) => Math.round((reference - Date.parse(`${date}T00:00:00Z`)) / DAY_MS)
  const recent = sessions
    .filter((session) => ageOf(session.date) >= 0 && ageOf(session.date) < COACH_DAYS)
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
  if (recent.length === 0) return null
  const minutes = (list: readonly CrossTrainingSession[]) => Math.round(list.reduce((sum, s) => sum + s.durationSeconds, 0) / 60)
  return {
    minutes7Days: minutes(recent.filter((session) => ageOf(session.date) < 7)),
    minutes28Days: minutes(recent),
    sessions: recent.map((session) => ({
      date: session.date,
      kind: crossTrainingKind(session.sport),
      minutes: Math.round(session.durationSeconds / 60),
      ...(session.trainingLoad ? { trainingLoad: Math.round(session.trainingLoad) } : {}),
      ...(session.sets?.length ? { sets: session.sets.length } : {}),
    })),
  }
}
