export const AVOID_REASONS = ['blocked', 'mud', 'unsafe'] as const
export type AvoidReason = (typeof AVOID_REASONS)[number]

export interface AvoidSpot {
  id: string
  lon: number
  lat: number
  radiusM: number
  /** 'YYYY-MM-DD' it was marked. */
  createdAt: string
  reason: AvoidReason | null
  /** 'YYYY-MM-DD' from which loops no longer went round it; null kept it until removed. */
  expiresOn: string | null
}

export const AVOID_LIMITS = { minRadiusM: 20, maxRadiusM: 250 } as const
