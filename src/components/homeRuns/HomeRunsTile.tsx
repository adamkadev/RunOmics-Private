import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { HomeRunsSummary } from '@/application/usecases/GetHomeRuns'
import { cardClass } from '@/components/ui/Card'
import { formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

// The same press as ProgressHub's LINK_CARD.
const LINK_CARD = 'text-left transition-transform duration-100 ease-out active:scale-[0.98]'

export function HomeRunsTile({ summary }: { summary: HomeRunsSummary }) {
  return (
    <Link href="/home-runs" data-testid="home-runs-tile" className={cardClass({ className: cn('flex items-center gap-3.5', LINK_CARD) })}>
      <svg viewBox="-4 -4 108 108" aria-hidden="true" className="size-16 shrink-0 rounded-xl bg-[#0a0c10]">
        <path d={summary.preview} fill="none" stroke="var(--accent)" strokeOpacity={0.35} strokeWidth={1} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-headline text-foreground">{t.homeRuns.title}</span>
        <span className="text-[13px] text-muted-foreground text-pretty">
          {t.homeRuns.tileDetail(summary.runCount, formatDate(summary.firstDate, { precision: 'month', year: 'always' }))}
        </span>
      </div>
      <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
    </Link>
  )
}
