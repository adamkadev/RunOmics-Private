/** The three windows Garmin itself offers, from densest to longest. */
export const VO2MAX_RANGES = ['4w', '6m', '1y'] as const
export type VO2maxRange = (typeof VO2MAX_RANGES)[number]
