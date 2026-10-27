/** In the domain so a repository never has to import a use case to know its own shape. */

export interface PbEntry {
  distance: string
  seconds: number
  activityId: string
}

export interface PbYear {
  year: number
  entries: PbEntry[]
}

export interface GoalTarget {
  distance: string
  targetSeconds: number | null
}

export interface GoalYear {
  year: number
  annualDistanceKm: number
  targets: GoalTarget[]
}

/** A is the race the block builds to, C a tune-up run as training (Garmin's primary and training events). */
export type RacePriority = 'A' | 'B' | 'C'

export interface UpcomingRace {
  courseContext?: import('@/domain/coaching/types').RaceCourseContext
  garminEventUuid?: string
  garminEventId?: number
  date: string
  name: string
  distance: string
  location?: string
  targetSeconds?: number | null
  isPrimaryEvent?: boolean
  isTrainingEvent?: boolean
  /** Set on a race added in the app: its Firestore id. */
  entryId?: string
  priority?: RacePriority
  /** Chosen in the app: no time goal, so the season's target for the distance does not apply either. */
  justFinish?: true
}

export interface UpcomingRaceYear {
  year: number
  races: UpcomingRace[]
}
