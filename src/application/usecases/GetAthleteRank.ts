import { getLatestVO2max } from '@/application/usecases/GetVO2maxHistory'
import type { RecordEntry } from '@/application/usecases/GetRecords'
import type { AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getVo2maxNorms } from '@/infrastructure/repositories/JsonVo2maxNormsRepository'
import { tierFromScore, type RankTier } from '@/domain/athlete/rank'
import { bracketForAge, type Vo2maxNorms, type Vo2maxThresholds } from '@/domain/athlete/vo2maxNorms'
import { round } from '@/lib/math'
import { vdotFromEffort } from '@/domain/training/vdot'

export type { RankTier }

export interface AthleteRank {
  tier: RankTier
  vo2maxGarmin: number | null
  vdot: number | null
}

const VDOT_EFFORT_KM: Record<string, number> = { '5k': 5, '10k': 10, half: 21.0975, marathon: 42.195 }

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

function tierThresholds(t: Vo2maxThresholds): number[] {
  return [0, t.fair, t.good, t.excellent, t.superior]
}

export function getAthleteRank(
  records: RecordEntry[],
  athlete: AthleteProfile,
  norms: Vo2maxNorms = getVo2maxNorms(),
): AthleteRank | null {
  const vo2maxGarmin = getLatestVO2max()
  const vdot = bestVdot(records)
  if (vo2maxGarmin === null && vdot === null) return null
  if (athlete.age === undefined || !athlete.sex) return null

  const combined = vo2maxGarmin !== null && vdot !== null ? (vo2maxGarmin + vdot) / 2 : (vo2maxGarmin ?? vdot ?? 0)

  const thresholds = norms[athlete.sex][bracketForAge(athlete.age)]
  const tier = tierFromScore(combined, tierThresholds(thresholds))

  return { tier, vo2maxGarmin: vo2maxGarmin !== null ? round(vo2maxGarmin) : null, vdot: vdot !== null ? round(vdot) : null }
}
