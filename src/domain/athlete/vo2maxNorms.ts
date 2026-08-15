import norms from '../../../data/vo2max_norms.json'

export type AgeBracket = '20-29' | '30-39' | '40-49' | '50-59' | '60-69' | '70-79'

export interface Vo2maxThresholds {
  superior: number
  excellent: number
  good: number
  fair: number
}

// Cooper/Garmin age-graded VO2max percentile norms (mL/kg/min): superior = 95th
// percentile, excellent = 80th, good = 60th, fair = 40th. Not hand-maintained -
// scripts/garmin/vo2max_norms.py refreshes the JSON from Garmin on every sync
// and logs a diff when Garmin moves an anchor. Small enough (~1 KB) to inline
// into the client bundle, which keeps every lookup below synchronous.
export const VO2MAX_NORMS: Record<'male' | 'female', Record<AgeBracket, Vo2maxThresholds>> = norms

const AGE_BRACKETS: AgeBracket[] = ['20-29', '30-39', '40-49', '50-59', '60-69', '70-79']

export function bracketForAge(age: number): AgeBracket {
  const clamped = Math.min(Math.max(age, 20), 79)
  const index = Math.min(Math.floor((clamped - 20) / 10), AGE_BRACKETS.length - 1)
  return AGE_BRACKETS[index] ?? '20-29'
}

export type Vo2maxBand = 'building' | 'solid' | 'strong' | 'elite'

// Maps a raw VO2max value onto the same 40th/60th/80th/95th percentile anchors
// used for the athlete rank badge, as a standalone qualitative read (no blending
// with VDOT) - for surfacing "is this number good?" next to the raw metric.
export function vo2maxBand(vo2max: number, age: number, sex: 'male' | 'female'): Vo2maxBand {
  const t = VO2MAX_NORMS[sex][bracketForAge(age)]
  if (vo2max >= t.superior) return 'elite'
  if (vo2max >= t.excellent) return 'strong'
  if (vo2max >= t.good) return 'solid'
  return 'building'
}

// Interpolates a percentile (1-99) between the fair/good/excellent/superior
// anchors (40th/60th/80th/95th pct) for the "· top X%" band suffix - reuses
// the same norms table as vo2maxBand, no separate lookup.
export function vo2maxTopPercent(vo2max: number, age: number, sex: 'male' | 'female'): number {
  const t = VO2MAX_NORMS[sex][bracketForAge(age)]
  const anchors: [number, number][] = [[0, 1], [40, t.fair], [60, t.good], [80, t.excellent], [95, t.superior]]

  let percentile: number
  if (vo2max >= t.superior) {
    percentile = Math.min(99, 95 + ((vo2max - t.superior) / t.superior) * 100)
  } else {
    let lo = anchors[0]!
    let hi = anchors[anchors.length - 1]!
    for (let i = 0; i < anchors.length - 1; i++) {
      const [, loVal] = anchors[i]!
      const [, hiVal] = anchors[i + 1]!
      if (vo2max >= loVal && vo2max <= hiVal) {
        lo = anchors[i]!
        hi = anchors[i + 1]!
        break
      }
    }
    const [loPct, loVal] = lo
    const [hiPct, hiVal] = hi
    const frac = hiVal > loVal ? (vo2max - loVal) / (hiVal - loVal) : 0
    percentile = loPct + frac * (hiPct - loPct)
  }

  return Math.max(1, Math.round(100 - percentile))
}
