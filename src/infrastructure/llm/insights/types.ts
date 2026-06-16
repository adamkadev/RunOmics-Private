// Provider-agnostic contract for the AI Insights layer. Nothing outside this
// folder should depend on a concrete provider - only on these types.

export type InsightType =
  | 'training_load'
  | 'performance_trend'
  | 'vo2max'
  | 'consistency'
  | 'pacing_efficiency'
  | 'injury_risk'

export type InsightSeverity = 'low' | 'medium' | 'high'

// How well-grounded the insight is in the data, not a fabricated probability.
// "high" = directly supported by a clear threshold or enough history; "low" =
// a speculative read (short window, noisy signal). Qualitative on purpose -
// this project avoids fake numeric precision (see CLAUDE.md).
export type InsightConfidence = 'low' | 'medium' | 'high'

export interface Insight {
  type: InsightType
  title: string
  message: string
  severity: InsightSeverity
  confidence: InsightConfidence
  metrics?: Record<string, number>
}

export interface InsightsOutput {
  insights: Insight[]
}

// Compact, serializable snapshot of the athlete's current state. Assembled at
// build time by GetInsightsSnapshot from existing usecases (read-only) and sent
// to the provider. Kept small on purpose: the LLM only reasons over this.
export interface InsightsInput {
  trainingLoad: {
    fitnessCtl: number
    fatigueAtl: number
    formTsb: number
  } | null
  trainingStatus: {
    status: string
    risk: string
    loadTrend: string
    acwr: number | null
    ctlDelta: number
  } | null
  consistency: {
    score: number
    adherence: number
    stability: number
    rating: string
  } | null
  vo2max: number | null
  volume: {
    last7Km: number
    last28Km: number
    weeklyAvgKm: number
  }
  easyHardSplit: {
    easyPct: number | null
    hardPct: number | null
  }
  pace: {
    easyPaceSecPerKm: number | null
    easyPaceDeltaSec: number | null // negative = faster vs previous window
  }
  efficiency: {
    ef7: number | null
    ef30: number | null
  }
  period: {
    weeks: number
    distancePct: number | null
    sessionsPct: number | null
  }
}
