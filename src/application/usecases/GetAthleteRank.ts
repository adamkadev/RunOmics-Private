import { getLatestVO2max } from '@/application/usecases/GetVO2maxHistory'
import type { RecordEntry } from '@/application/usecases/GetRecords'
import { ATHLETE_NAME, ATHLETE_BIRTHDATE, ATHLETE_SEX } from '@/domain/athlete/constants'
import { round } from '@/lib/math'

export type RankTier = 'D' | 'C-' | 'C+' | 'B-' | 'B+' | 'A-' | 'A+' | 'S' | 'S+'

const RANK_LADDER: RankTier[] = ['D', 'C-', 'C+', 'B-', 'B+', 'A-', 'A+', 'S', 'S+']

export interface AthleteRank {
  tier: RankTier
  vo2maxGarmin: number | null
  vdot: number | null
}

type AgeBracket = '20-29' | '30-39' | '40-49' | '50-59' | '60-69' | '70-79'

interface Vo2maxThresholds {
  superior: number
  excellent: number
  good: number
  fair: number
}

// Cooper/Garmin age-graded VO2max percentile norms (mL/kg/min): superior = 95th
// percentile, excellent = 80th, good = 60th, fair = 40th.
const VO2MAX_NORMS: Record<'male' | 'female', Record<AgeBracket, Vo2maxThresholds>> = {
  male: {
    '20-29': { superior: 55.4, excellent: 51.1, good: 45.4, fair: 41.7 },
    '30-39': { superior: 54, excellent: 48.3, good: 44, fair: 40.5 },
    '40-49': { superior: 52.5, excellent: 46.4, good: 42.4, fair: 38.5 },
    '50-59': { superior: 48.9, excellent: 43.4, good: 39.2, fair: 35.6 },
    '60-69': { superior: 45.7, excellent: 39.5, good: 35.5, fair: 32.3 },
    '70-79': { superior: 42.1, excellent: 36.7, good: 32.3, fair: 29.4 },
  },
  female: {
    '20-29': { superior: 49.6, excellent: 43.9, good: 39.5, fair: 36.1 },
    '30-39': { superior: 47.4, excellent: 42.4, good: 37.8, fair: 34.4 },
    '40-49': { superior: 45.3, excellent: 39.7, good: 36.3, fair: 33 },
    '50-59': { superior: 41.1, excellent: 36.7, good: 33, fair: 30.1 },
    '60-69': { superior: 37.8, excellent: 33, good: 30, fair: 27.5 },
    '70-79': { superior: 36.7, excellent: 30.9, good: 28.1, fair: 25.9 },
  },
}

const AGE_BRACKETS: AgeBracket[] = ['20-29', '30-39', '40-49', '50-59', '60-69', '70-79']

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

function ageFromBirthdate(birthdateIso: string): number {
  const today = new Date()
  const birth = new Date(birthdateIso + 'T00:00:00')
  let age = today.getFullYear() - birth.getFullYear()
  const hadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate())
  if (!hadBirthdayThisYear) age--
  return age
}

function bracketForAge(age: number): AgeBracket {
  const clamped = Math.min(Math.max(age, 20), 79)
  const index = Math.min(Math.floor((clamped - 20) / 10), AGE_BRACKETS.length - 1)
  return AGE_BRACKETS[index]
}

// Maps the 4 known percentile anchors (fair=40th, good=60th, excellent=80th,
// superior=95th) onto the 9-tier ladder, linearly interpolating/extrapolating
// the VO2max value at each tier's percentile so every tier has a real threshold
// instead of an arbitrary one.
function tierThresholds(t: Vo2maxThresholds): number[] {
  const fairToGood = (t.good - t.fair) / 20 // per percentile point, 40th -> 60th
  const goodToExcellent = (t.excellent - t.good) / 20 // 60th -> 80th
  const excellentToSuperior = (t.superior - t.excellent) / 15 // 80th -> 95th

  return [
    t.fair - fairToGood * 40, // D            (0th pct)
    t.fair - fairToGood * 20, // C-           (20th pct)
    t.fair, //                   C+           (40th pct)
    t.fair + fairToGood * 10, // B-           (50th pct)
    t.good, //                   B+           (60th pct)
    t.good + goodToExcellent * 10, // A-      (70th pct)
    t.excellent, //              A+           (80th pct)
    t.excellent + excellentToSuperior * 10, // S (90th pct)
    t.superior, //               S+           (95th pct)
  ]
}

function tierFromScore(score: number, thresholds: number[]): RankTier {
  let index = 0
  for (let i = 0; i < thresholds.length; i++) {
    if (score >= thresholds[i]) index = i
  }
  return RANK_LADDER[index]
}

export function getAthleteRank(records: RecordEntry[]): AthleteRank | null {
  const vo2maxGarmin = getLatestVO2max()
  const vdot = bestVdot(records)
  if (vo2maxGarmin === null && vdot === null) return null

  const combined = vo2maxGarmin !== null && vdot !== null ? (vo2maxGarmin + vdot) / 2 : (vo2maxGarmin ?? vdot ?? 0)

  const thresholds = VO2MAX_NORMS[ATHLETE_SEX][bracketForAge(ageFromBirthdate(ATHLETE_BIRTHDATE))]
  const tier = tierFromScore(combined, tierThresholds(thresholds))

  return { tier, vo2maxGarmin: vo2maxGarmin !== null ? round(vo2maxGarmin) : null, vdot: vdot !== null ? round(vdot) : null }
}
