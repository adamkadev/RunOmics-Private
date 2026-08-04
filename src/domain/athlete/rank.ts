export type RankTier = 'D' | 'C' | 'B' | 'A' | 'S'

export const RANK_LADDER: RankTier[] = ['D', 'C', 'B', 'A', 'S']

export function tierFromScore(score: number, thresholds: number[]): RankTier {
  let index = 0
  for (let i = 0; i < thresholds.length; i++) {
    if (score >= (thresholds[i] ?? Infinity)) index = i
  }
  return RANK_LADDER[Math.min(index, RANK_LADDER.length - 1)] ?? 'D'
}

