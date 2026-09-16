import type { Insight } from '@/lib/gemini'

/**
 * The tab's own take, as a subhead rather than a second prose card. On Fitness
 * it sat directly under the season headline and made the same point in more
 * words - "you are running faster with less physical effort", then "yes, your
 * training is paying off" - so it keeps the line that is the finding and drops
 * the paragraph that restated the card above it.
 */
export function TabInsight({ insight }: { insight: Insight }) {
  return <p className="mb-4 text-footnote leading-snug text-muted-foreground">{insight.headline}</p>
}
