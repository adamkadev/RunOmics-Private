// Contract for the AI training-plan layer. A grounded, single representative
// training week derived from the athlete's current data and this year's goals -
// not a multi-month periodised program (that would require inventing data).

export type SessionKind =
  | 'rest'
  | 'recovery'
  | 'easy'
  | 'long'
  | 'tempo'
  | 'threshold'
  | 'intervals'
  | 'race_pace'
  | 'cross_training'

export type PlanConfidence = 'low' | 'medium' | 'high'

export interface PlanSession {
  day: string                 // 'Monday' .. 'Sunday'
  kind: SessionKind
  title: string
  description: string
  distanceKm: number | null   // null for rest / cross-training
  targetPace: string | null   // e.g. '5:20 /km', null when not pace-specific
}

export interface TrainingPlan {
  focus: string               // current training phase focus
  rationale: string           // why this plan, given the data + goal
  targetWeeklyKm: number
  keyWorkout: string | null   // the one priority session this week
  sessions: PlanSession[]     // one representative week (incl. rest days)
  confidence: PlanConfidence
}

export interface PlanOutput {
  plan: TrainingPlan | null
}

// Compact, serializable snapshot used to ground the plan. Assembled at build
// time by GetPlanSnapshot from existing usecases (read-only).
export interface PlanInput {
  trainingStatus: {
    status: string
    risk: string
    loadTrend: string
    acwr: number | null
    ctlDelta: number
  } | null
  load: {
    fitnessCtl: number
    fatigueAtl: number
    formTsb: number
  } | null
  consistency: {
    score: number
    adherence: number
    stability: number
    rating: string
  } | null
  recentWeeklyKm: number       // rolling 8-week rate
  currentWeek: {
    distanceKm: number
    sessions: number
  }
  sessionMix: {
    type: string
    sessions: number
    distanceKm: number
  }[]
  easyHardSplit: {
    easyPct: number | null
    hardPct: number | null
  }
  // Pace zones (sec/km) so the plan can prescribe concrete paces. Empty when
  // no athlete threshold pace is configured.
  paceZones: {
    key: string
    paceMinSecPerKm: number
    paceMaxSecPerKm: number
  }[]
  goal: {
    year: number
    annualDistanceKm: number
    distanceDoneKm: number
    projection: {
      weeklyRate: number
      weeklyNeeded: number
      projectedYearKm: number
      status: string
      deltaKm: number
    } | null
    targets: {
      distance: string
      targetSeconds: number | null
    }[]
  } | null
}
