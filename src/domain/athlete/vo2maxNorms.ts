export type AgeBracket = '20-29' | '30-39' | '40-49' | '50-59' | '60-69' | '70-79'

export interface Vo2maxThresholds {
  superior: number
  excellent: number
  good: number
  fair: number
}

// Cooper/Garmin age-graded VO2max percentile norms (mL/kg/min): superior = 95th
// percentile, excellent = 80th, good = 60th, fair = 40th.
export const VO2MAX_NORMS: Record<'male' | 'female', Record<AgeBracket, Vo2maxThresholds>> = {
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

export function ageFromBirthdate(birthdateIso: string): number {
  const today = new Date()
  const birth = new Date(birthdateIso + 'T00:00:00')
  let age = today.getFullYear() - birth.getFullYear()
  const hadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate())
  if (!hadBirthdayThisYear) age--
  return age
}

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

// Fraction of the way to this age/sex bracket's superior (95th pct) anchor,
// clamped to [0,1] - used to size a reference-band fill bar under the raw number.
export function vo2maxProgressToSuperior(vo2max: number, age: number, sex: 'male' | 'female'): number {
  const t = VO2MAX_NORMS[sex][bracketForAge(age)]
  return Math.max(0, Math.min(1, vo2max / t.superior))
}
