import { ArrowUpRight, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BRAND_TINTS } from '@/lib/colors'
import type { SeasonHeadlineData } from '@/application/usecases/GetSeasonHeadline'
import type { Insight } from '@/lib/gemini'
import { t } from '@/i18n'

// The insight-first opener: what the season says in one line, backed by up to
// three reads. Centered green-gradient card, left-aligned bullets.
interface Props {
  data: SeasonHeadlineData
  /** Generated take on the same reads; falls back to the rules-based copy when absent. */
  aiTake: Insight | null
}

export function SeasonHeadline({ data, aiTake }: Props) {
  return (
    <div
      className="rounded-[20px] border p-4 text-center"
      style={{
        borderColor: BRAND_TINTS.headlineBorder,
        background: BRAND_TINTS.headlineFill,
      }}
    >
      <div className="mb-2 font-mono text-micro font-bold uppercase tracking-[0.14em] text-accent-text">
        {t.analytics.seasonHeadline.eyebrow}
      </div>
      <div className="mb-3">
        <p className="font-display text-lg font-bold leading-[1.18] tracking-tight text-foreground">
          {aiTake?.headline ?? data.title}
        </p>
        {aiTake && <p className="mt-1.5 text-footnote leading-snug text-muted-foreground">{aiTake.body}</p>}
      </div>
      <ul className="flex flex-col gap-2 text-left">
        {data.bullets.map((bullet, i) => {
          const Icon = bullet.tone === 'positive' ? ArrowUpRight : ArrowRight
          return (
            <li key={i} className="flex items-center gap-2.5 text-footnote text-muted-foreground">
              <Icon
                size={14}
                strokeWidth={2.4}
                className={cn('shrink-0', bullet.tone === 'positive' ? 'text-accent' : 'text-amber-500')}
              />
              {aiTake?.bullets?.[i] ?? bullet.text}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
