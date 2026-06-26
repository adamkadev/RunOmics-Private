export type RankTier = 'D' | 'C-' | 'C+' | 'B-' | 'B+' | 'A-' | 'A+' | 'S' | 'S+'

export const RANK_LADDER: RankTier[] = ['D', 'C-', 'C+', 'B-', 'B+', 'A-', 'A+', 'S', 'S+']

export function tierFromScore(score: number, thresholds: number[]): RankTier {
  let index = 0
  for (let i = 0; i < thresholds.length; i++) {
    if (score >= thresholds[i]) index = i
  }
  return RANK_LADDER[index]
}

// Same percentile anchors as GetAthleteRank's tierThresholds() (20th/40th/50th/60th/70th/80th/90th/95th),
// reused directly for any score that is already on a 0-100 percentile-like scale
// (e.g. the consistency score) so the badge ladder stays consistent app-wide.
const PERCENTILE_BREAKPOINTS = [0, 20, 40, 50, 60, 70, 80, 90, 95]

export function tierFromPercentile(percentile: number): RankTier {
  return tierFromScore(percentile, PERCENTILE_BREAKPOINTS)
}
