import { ArrowUpRight, ArrowRight } from 'lucide-react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { STATUS } from '@/lib/statusColors'
import { cn } from '@/lib/utils'
import type { SeasonHeadlineData } from '@/application/usecases/GetSeasonHeadline'
import { t } from '@/i18n'

export function SeasonHeadline({ data }: { data: SeasonHeadlineData }) {
  return (
    <GlassSurface variant="card" className="border-accent/30 bg-gradient-to-br from-accent/[0.1] to-transparent p-5">
      <div className="mb-1.5 text-micro font-semibold uppercase tracking-wide text-accent-text">
        {t.analytics.seasonHeadline.eyebrow}
      </div>
      <p className="mb-3 text-base font-bold leading-snug text-foreground">{data.title}</p>
      <ul className="space-y-1.5">
        {data.bullets.map((bullet, i) => {
          const Icon = bullet.tone === 'positive' ? ArrowUpRight : ArrowRight
          const tone = bullet.tone === 'positive' ? STATUS.success.text : STATUS.warning.text
          return (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
              <Icon size={15} strokeWidth={2.5} className={cn('mt-0.5 shrink-0', tone)} />
              {bullet.text}
            </li>
          )
        })}
      </ul>
    </GlassSurface>
  )
}
