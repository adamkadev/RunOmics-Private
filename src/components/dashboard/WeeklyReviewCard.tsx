import { AlertTriangle, ArrowUpRight } from 'lucide-react'
import type { WeeklyDigest } from '@/application/usecases/GetWeeklyDigest'
import type { Insight } from '@/lib/gemini'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { t } from '@/i18n'

interface Props {
  digest: WeeklyDigest
  /** Generated read on the same facts; the bullets stand on their own without it. */
  aiTake: Insight | null
}

export function WeeklyReviewCard({ digest, aiTake }: Props) {
  const s = t.dashboard.weeklyReview
  const { totals, review } = digest

  return (
    <GlassSurface variant="card" className="p-5">
      <p className="mb-2 font-mono text-micro font-bold uppercase tracking-[0.14em] text-accent-text">{s.eyebrow}</p>

      <p className="font-display text-subhead font-bold leading-snug text-foreground">
        {aiTake?.headline ?? s.fallbackTitle(totals.distanceKm, totals.sessions)}
      </p>
      {aiTake && <p className="mt-1 text-footnote leading-snug text-muted-foreground">{aiTake.body}</p>}

      {review.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {review.map((fact) => {
            const positive = fact.severity === 'positive'
            const Icon = positive ? ArrowUpRight : AlertTriangle
            return (
              <li key={fact.key} className="flex items-start gap-2 text-footnote text-muted-foreground">
                <Icon
                  size={14}
                  strokeWidth={2.4}
                  className={positive ? 'mt-px shrink-0 text-accent' : 'mt-px shrink-0 text-amber-500'}
                />
                <span className="min-w-0 leading-snug">{fact.text}</span>
              </li>
            )
          })}
        </ul>
      )}
    </GlassSurface>
  )
}
