import type { Insight } from '@/lib/gemini'

export function TabInsight({ insight }: { insight: Insight }) {
  return <p className="mb-4 text-footnote leading-snug text-muted-foreground">{insight.headline}</p>
}
