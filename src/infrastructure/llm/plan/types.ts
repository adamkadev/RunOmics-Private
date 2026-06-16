import type { ActivityType } from '@/domain/activity/types'

// Contract for the AI training-plan layer. A grounded, single representative
// training week derived from the athlete's current data and this year's goals -
// not a multi-month periodised program (that would require inventing data).

// Reuses the same activity types as the rest of the app (styling, i18n labels)
// plus two kinds that aren't loggable activities.
export type SessionKind = ActivityType | 'rest' | 'cross_training'

export type PlanConfidence = 'low' | 'medium' | 'high'

export interface PlanSession {
  day: string                 // 'Monday' .. 'Sunday'
  kind: SessionKind
  title: string
  description: string
  distanceKm: number | null   // null for rest / cross-training
  targetPace: string | null   // must be one of PlanInput.paceZones[].label, or null
  // True when this day already happened this calendar week and reflects a
  // real logged activity rather than a prescription.
  completed?: boolean
}

export interface TrainingPlan {
  focus: string               // current training phase focus
  rationale: string           // why this plan, given the data + goal
  targetWeeklyKm: number
  keyWorkout: string | null   // the one priority session this week
  sessions: PlanSession[]     // full Monday..Sunday week (past days = completed)
  confidence: PlanConfidence
}

export interface PlanOutput {
  plan: TrainingPlan | null
}

// Pre-formatted pace zone, ready to use as-is in a session's targetPace - the
// model must pick from these labels, never compute its own pace string.
export interface PlanPaceZone {
  key: string
  label: string // e.g. "5:18 - 6:36 /km"
}

// Compact, serializable snapshot used to ground the plan. Assembled at build
// time by GetPlanSnapshot from existing usecases (read-only).
export interface PlanInput {
  today: string // 'Monday' .. 'Sunday' - the current day of this week
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
  // Sessions already logged this calendar week (Monday up to today). The plan
  // must reflect these as completed, not prescribe them again.
  completedThisWeek: {
    day: string
    type: ActivityType
    distanceKm: number
  }[]
  sessionMix: {
    type: string
    sessions: number
    distanceKm: number
  }[]
  easyHardSplit: {
    easyPct: number | null
    hardPct: number | null
  }
  // Empty when no athlete threshold pace is configured.
  paceZones: PlanPaceZone[]
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
