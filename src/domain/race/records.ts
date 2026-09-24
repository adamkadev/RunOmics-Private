/** One row of the records board: a best effort, or an official result. */

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
