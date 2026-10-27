export type AgeBracket = '20-29' | '30-39' | '40-49' | '50-59' | '60-69' | '70-79'

export interface Vo2maxThresholds {
  superior: number
  excellent: number
  good: number
  fair: number
}

export type Vo2maxNorms = Record<'male' | 'female', Record<AgeBracket, Vo2maxThresholds>>

const AGE_BRACKETS: AgeBracket[] = ['20-29', '30-39', '40-49', '50-59', '60-69', '70-79']

export function bracketForAge(age: number): AgeBracket {
  const clamped = Math.min(Math.max(age, 20), 79)
  const index = Math.min(Math.floor((clamped - 20) / 10), AGE_BRACKETS.length - 1)
  return AGE_BRACKETS[index] ?? '20-29'
}

export function vo2maxTopPercent(vo2max: number, age: number, sex: 'male' | 'female', norms: Vo2maxNorms): number {
  const t = norms[sex][bracketForAge(age)]
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
