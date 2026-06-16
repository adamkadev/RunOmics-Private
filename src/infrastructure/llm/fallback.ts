import type { Insight, InsightsInput, InsightsOutput } from './types'

// Deterministic, dependency-free insights derived directly from the snapshot.
// Used whenever the LLM is unavailable, unconfigured, or returns invalid JSON,
// so the UI always has something meaningful to render.

const MAX = 6

export function ruleBasedInsights(input: InsightsInput): InsightsOutput {
  const out: Insight[] = []

  const { trainingStatus, trainingLoad, consistency, vo2max, pace, efficiency, easyHardSplit, volume, period } = input

  if (trainingStatus) {
    const { acwr, status, risk } = trainingStatus
    if (acwr !== null && acwr >= 1.5) {
      out.push({
        type: 'injury_risk',
        title: 'Load ramping fast',
        message: `Your acute:chronic load is ${acwr}x your usual. Ease off for a few days to stay injury-free.`,
        severity: 'high',
        metrics: { acwr },
      })
    } else if (acwr !== null && acwr >= 0.8 && acwr <= 1.3) {
      out.push({
        type: 'injury_risk',
        title: 'Load in the sweet spot',
        message: `Your training load (ACWR ${acwr}) sits in the optimal range.`,
        severity: 'low',
        metrics: { acwr },
      })
    }

    if (status === 'overreaching' || risk === 'high') {
      out.push({
        type: 'training_load',
        title: 'High fatigue',
        message: 'Form is deep in the red. Plan an easy day or full rest before the next hard session.',
        severity: 'high',
      })
    } else if (status === 'fresh') {
      out.push({
        type: 'training_load',
        title: 'Fresh and ready',
        message: 'Form is positive, a good window for a quality session or a race.',
        severity: 'low',
      })
    }
  }

  if (trainingLoad && out.every((i) => i.type !== 'training_load')) {
    out.push({
      type: 'training_load',
      title: 'Fitness vs fatigue',
      message: `Fitness ${trainingLoad.fitnessCtl}, fatigue ${trainingLoad.fatigueAtl}, form ${trainingLoad.formTsb}.`,
      severity: trainingLoad.formTsb < -20 ? 'medium' : 'low',
      metrics: { fitness: trainingLoad.fitnessCtl, fatigue: trainingLoad.fatigueAtl, form: trainingLoad.formTsb },
    })
  }

  if (pace.easyPaceDeltaSec !== null && pace.easyPaceDeltaSec <= -3) {
    out.push({
      type: 'performance_trend',
      title: 'Easy pace improving',
      message: `Your easy pace is ${Math.abs(pace.easyPaceDeltaSec)}s/km faster than the previous block at the same effort.`,
      severity: 'low',
      metrics: { fasterSecPerKm: Math.abs(pace.easyPaceDeltaSec) },
    })
  } else if (period.distancePct !== null && Math.abs(period.distancePct) >= 10) {
    out.push({
      type: 'performance_trend',
      title: period.distancePct > 0 ? 'Volume trending up' : 'Volume trending down',
      message: `Distance is ${period.distancePct > 0 ? 'up' : 'down'} ${Math.abs(period.distancePct)}% vs the previous ${period.weeks} weeks.`,
      severity: 'low',
      metrics: { distancePct: period.distancePct },
    })
  }

  if (efficiency.ef30 !== null) {
    out.push({
      type: 'pacing_efficiency',
      title: 'Aerobic efficiency',
      message: `Your 30-day aerobic efficiency factor is ${efficiency.ef30}. Track it over easy runs to gauge aerobic gains.`,
      severity: 'low',
      metrics: { ef30: efficiency.ef30 },
    })
  } else if (easyHardSplit.easyPct !== null && easyHardSplit.easyPct < 65) {
    out.push({
      type: 'pacing_efficiency',
      title: 'Too much intensity',
      message: `Only ${easyHardSplit.easyPct}% of your time is easy. Aim closer to 80% to build the aerobic base.`,
      severity: 'medium',
      metrics: { easyPct: easyHardSplit.easyPct },
    })
  }

  if (vo2max !== null) {
    out.push({
      type: 'vo2max',
      title: 'Estimated VO2max',
      message: `Your current estimated VO2max is ${vo2max} ml/kg/min.`,
      severity: 'low',
      metrics: { vo2max },
    })
  }

  if (consistency) {
    out.push({
      type: 'consistency',
      title: `Consistency: ${consistency.rating}`,
      message: `Score ${consistency.score}/100 over the last 12 weeks (${consistency.adherence}% weeks active, ${volume.weeklyAvgKm} km/week avg).`,
      severity: consistency.rating === 'low' ? 'medium' : 'low',
      metrics: { score: consistency.score, adherence: consistency.adherence, weeklyAvgKm: volume.weeklyAvgKm },
    })
  }

  return { insights: out.slice(0, MAX) }
}
