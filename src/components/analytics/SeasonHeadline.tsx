import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import { ArrowUpRight, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BRAND_TINTS } from '@/lib/colors'
import type { SeasonHeadlineData } from '@/application/usecases/GetSeasonHeadline'
import type { Insight } from '@/lib/gemini'
import { t } from '@/i18n'

interface Props {
  data: SeasonHeadlineData
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
      <div className={cn(EYEBROW_CLASS, 'mb-2 text-accent-text')}>
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
