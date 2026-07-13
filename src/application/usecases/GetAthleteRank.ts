import { getLatestVO2max } from '@/application/usecases/GetVO2maxHistory'
import type { RecordEntry } from '@/application/usecases/GetRecords'
import type { AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { tierFromScore, type RankTier } from '@/domain/athlete/rank'
import { VO2MAX_NORMS, bracketForAge, type Vo2maxThresholds } from '@/domain/athlete/vo2maxNorms'
import { round } from '@/lib/math'

export type { RankTier }

export interface AthleteRank {
  tier: RankTier
  vo2maxGarmin: number | null
  vdot: number | null
}

// Daniels VDOT formula: estimates VO2max from a single race performance
// (distance + time), independent of the Garmin on-watch estimate.
const VDOT_EFFORT_KM: Record<string, number> = { '5k': 5, '10k': 10, half: 21.0975, marathon: 42.195 }

function vdotFromEffort(distanceKm: number, seconds: number): number {
  const velocity = (distanceKm * 1000) / (seconds / 60) // meters per minute
  const vo2 = -4.6 + 0.182258 * velocity + 0.000104 * velocity * velocity
  const minutes = seconds / 60
  const percentMax = 0.8 + 0.1894393 * Math.exp(-0.012778 * minutes) + 0.2989558 * Math.exp(-0.1932605 * minutes)
  return vo2 / percentMax
}

function bestVdot(records: RecordEntry[]): number | null {
  let best: number | null = null
  for (const r of records) {
    const km = VDOT_EFFORT_KM[r.key]
    if (!km || r.seconds === null) continue
    const vdot = vdotFromEffort(km, r.seconds)
    if (best === null || vdot > best) best = vdot
  }
  return best
}

// Maps the 4 VO2max percentile anchors directly onto the D/C/B/A/S ladder:
// D is the catch-all below fair (40th pct), C/B/A/S start at fair/good/excellent/superior.
function tierThresholds(t: Vo2maxThresholds): number[] {
  return [0, t.fair, t.good, t.excellent, t.superior]
}

export function getAthleteRank(records: RecordEntry[], athlete: AthleteProfile): AthleteRank | null {
  const vo2maxGarmin = getLatestVO2max()
  const vdot = bestVdot(records)
  if (vo2maxGarmin === null && vdot === null) return null
  if (athlete.age === undefined || !athlete.sex) return null

  const combined = vo2maxGarmin !== null && vdot !== null ? (vo2maxGarmin + vdot) / 2 : (vo2maxGarmin ?? vdot ?? 0)

  const thresholds = VO2MAX_NORMS[athlete.sex][bracketForAge(athlete.age)]
  const tier = tierFromScore(combined, tierThresholds(thresholds))

  return { tier, vo2maxGarmin: vo2maxGarmin !== null ? round(vo2maxGarmin) : null, vdot: vdot !== null ? round(vdot) : null }
}
