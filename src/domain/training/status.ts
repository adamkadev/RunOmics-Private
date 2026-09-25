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
  /** Fitness change over LOAD_TREND_DAYS, which the status is classified on. */
  ctlDelta: number
  /** Fitness change over STATUS_DELTA_DAYS.fitness, the one Today prints. */
  ctlDeltaShown: number
  atlDelta: number
  tsbDelta: number
  ctlPeak: number
  source: 'garmin' | 'local'
  acwrStatus: string | null
  chronicLoad: number | null
  chronicLoadMin: number | null
  chronicLoadMax: number | null
}

/**
 * The window each delta Today prints is measured over, written beside the
 * arrow ("↑1 in 7 d"). One week for all three: Fitness read "in 14 d" beside
 * Form and Fatigue "in 7 d", so the trio compared different spans.
 */
export const STATUS_DELTA_DAYS = { form: 7, fitness: 7, fatigue: 7 } as const

/** The fitness trend the status is classified on: two weeks, so one heavy
 *  week does not flip "building". Not printed. */
export const LOAD_TREND_DAYS = 14
