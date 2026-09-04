import Link from 'next/link'
import { ChevronRight, Sparkles } from 'lucide-react'
import type { CoachingOverview } from '@/application/coaching/GetCoachingView'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { StatusPill } from '@/components/ui/StatusPill'
import { formatDate } from '@/lib/formatters'
import { t } from '@/i18n'

export function CoachBrief({ coaching }: { coaching: CoachingOverview }) {
  const decision = coaching.latestDecision
  const next = coaching.nextKeyWorkout
  if (!decision && !next) return null

  return (
    <GlassSurface variant="card" className="rounded-[18px] px-4 py-3.5">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-accent-text" />
        <span className="widget-label text-accent-text">{t.coaching.coach}</span>
        {decision && (
          <StatusPill tone={decision.outcome === 'KEEP' ? 'emerald' : 'amber'} className="ml-auto">
            {t.coaching.outcomes[decision.outcome]}
          </StatusPill>
        )}
      </div>
      {decision && <p className="mt-2 text-sm leading-snug text-foreground">{decision.summary}</p>}
      {next && (
        <Link href="/plan" className="mt-3 flex items-center gap-3 border-t border-foreground/[0.08] pt-3">
          <div className="min-w-0 flex-1">
            <p className="text-micro font-bold uppercase tracking-[0.06em] text-muted-foreground">{t.coaching.nextKeySession}</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{next.prescription.title}</p>
            <p className="text-xs text-muted-foreground">{formatDate(next.prescription.date)}</p>
          </div>
          <ChevronRight size={17} className="text-muted-foreground" />
        </Link>
      )}
    </GlassSurface>
  )
}
