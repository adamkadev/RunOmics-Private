export interface RecordEntry {
  key: string
  label: string
  seconds: number | null
  paceSecPerKm: number | null
  distanceKm?: number
  activityId: string | null
  date: string | null
  official: boolean
  eventName?: string
}

/** The record a run set, as its share card tells it. */
export interface RunRecord {
  key: string
  seconds: number
  /** The best before this run; null when it was the first time over the distance. */
  previousSeconds: number | null
  /** The round mark it broke for the first time ("sub-20"), in seconds. */
  milestoneSeconds: number | null
}
