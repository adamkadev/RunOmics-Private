/** The training status the dashboard, readiness and the AI verdicts all read. */

export type TrainingStatusType =
  | 'productive'
  | 'fresh'
  | 'overreaching'
  | 'recovery'
  | 'detraining'
  | 'maintaining'
  | 'unproductive'

export type RiskLevel = 'low' | 'moderate' | 'high'

export type LoadTrend = 'building' | 'maintaining' | 'tapering' | 'detraining'

export interface TrainingStatus {
  status: TrainingStatusType
  risk: RiskLevel
  loadTrend: LoadTrend
  ctl: number
  atl: number
  tsb: number
  tsbNow: number
  acwr: number | null
  ctlDelta: number
  atlDelta: number
  tsbDelta: number
  ctlPeak: number
  source: 'garmin' | 'local'
  acwrStatus: string | null
  chronicLoad: number | null
  chronicLoadMin: number | null
  chronicLoadMax: number | null
}
