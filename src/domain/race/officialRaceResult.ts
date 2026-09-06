export interface OfficialRaceResult {
  activityId: string
  eventName: string
  date: string
  distanceMeters: number
  chipTimeSeconds: number
  gunTimeSeconds?: number
  overallPlace?: number
  source?: string
}
