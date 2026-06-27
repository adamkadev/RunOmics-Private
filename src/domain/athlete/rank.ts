export type RankTier = 'D' | 'C' | 'B' | 'A' | 'S'

export const RANK_LADDER: RankTier[] = ['D', 'C', 'B', 'A', 'S']

export function tierFromScore(score: number, thresholds: number[]): RankTier {
  let index = 0
  for (let i = 0; i < thresholds.length; i++) {
    if (score >= thresholds[i]) index = i
  }
  return RANK_LADDER[index]
}

// Same percentile anchors as GetAthleteRank's tierThresholds() (40th/60th/80th/95th),
// reused directly for any score that is already on a 0-100 percentile-like scale
// (e.g. the consistency score) so the badge ladder stays consistent app-wide.
const PERCENTILE_BREAKPOINTS = [0, 40, 60, 80, 95]

export function tierFromPercentile(percentile: number): RankTier {
  return tierFromScore(percentile, PERCENTILE_BREAKPOINTS)
}
