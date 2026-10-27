import { getAthleteProfile as readAthleteProfile, type AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'

export type { AthleteProfile }

export function getAthleteProfile(): AthleteProfile {
  return readAthleteProfile()
}
