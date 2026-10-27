import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'

export interface AthleteBody {
  heightCm: number | null
  weightKg: number | null
}

export function getAthleteBody(): AthleteBody {
  const { heightCm, weightKg } = getAthleteProfile()
  return { heightCm: heightCm ?? null, weightKg: weightKg ?? null }
}
