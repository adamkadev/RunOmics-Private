import type { Insight } from '@/lib/gemini'
import { GlassSurface } from '@/components/ui/GlassSurface'

/** The generated answer to the question a tab exists to ask, above its charts. */
export function TabInsight({ insight }: { insight: Insight }) {
  return (
    <GlassSurface variant="card" className="mb-4 rounded-card-sm p-3.5">
      <p className="font-display text-subhead font-bold leading-snug text-foreground">{insight.headline}</p>
      <p className="mt-1 text-footnote leading-snug text-muted-foreground">{insight.body}</p>
    </GlassSurface>
  )
}
