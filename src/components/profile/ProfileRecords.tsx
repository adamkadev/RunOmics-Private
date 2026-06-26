import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import type { RecordEntry } from '@/application/usecases/GetRecords'
import { formatDuration, formatDateWithYear } from '@/lib/formatters'
import { t } from '@/i18n'

const RECENT_PR_DAYS = 90

function isRecentPr(date: string): boolean {
  const days = (Date.now() - new Date(date + 'T00:00:00').getTime()) / 86_400_000
  return days >= 0 && days <= RECENT_PR_DAYS
}

export function ProfileRecords({ records }: { records: RecordEntry[] }) {
  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">{t.profile.records.title}</h2>
        <span className="text-sm" aria-hidden="true">🏆</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {records.map((r) => {
          const recent = r.seconds !== null && r.date && isRecentPr(r.date)
          return (
            <div key={r.key} className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] p-3">
              <div className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">
                {r.label}
              </div>
              <div className="mt-1 text-lg font-extrabold tracking-tight text-foreground">
                {r.seconds !== null ? formatDuration(r.seconds) : <span className="text-foreground/30">—</span>}
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-1">
                <span className="text-micro text-muted-foreground">
                  {r.date ? formatDateWithYear(r.date) : t.profile.records.notYet}
                </span>
                {recent && (
                  <span className="rounded-[4px] border border-amber-500/25 bg-amber-500/[0.14] px-[5px] py-px text-micro font-bold text-amber-600 dark:text-amber-400">
                    {t.activity.bestEfforts.prBadge}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <Link
        href="/records"
        className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-accent-text active:scale-95"
      >
        {t.profile.records.viewAll} <ArrowRight size={16} />
      </Link>
    </GlassSurface>
  )
}
