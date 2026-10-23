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
}

export interface UpcomingRaceYear {
  year: number
  races: UpcomingRace[]
}
