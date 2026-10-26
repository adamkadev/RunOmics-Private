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
  /** No reading yet: a long break erased the base these numbers are read against. */
  buildingBack: boolean
  acwrStatus: string | null
  chronicLoad: number | null
  chronicLoadMin: number | null
  chronicLoadMax: number | null
}

/** Written beside each arrow Today prints ("↑1 in 7 d"); one span for all three so the trio compares alike. */
export const STATUS_DELTA_DAYS = { form: 7, fitness: 7, fatigue: 7 } as const

/** The fitness trend the status is classified on: two weeks, so one heavy
 *  week does not flip "building". Not printed. */
export const LOAD_TREND_DAYS = 14
