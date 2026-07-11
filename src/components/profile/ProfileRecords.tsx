import Link from 'next/link'
import { Trophy, ArrowRight } from 'lucide-react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import type { RecordEntry } from '@/application/usecases/GetRecords'
import { formatDuration, formatDateWithYear } from '@/lib/formatters'
import { t } from '@/i18n'

const RECENT_PR_DAYS = 90

function isRecentPr(date: string): boolean {
  const days = (Date.now() - new Date(date + 'T00:00:00').getTime()) / 86_400_000
  return days >= 0 && days <= RECENT_PR_DAYS
}

function mostRecent(records: RecordEntry[]): (RecordEntry & { date: string }) | null {
  const withDate = records.filter((r): r is RecordEntry & { date: string } => r.date !== null)
  if (withDate.length === 0) return null
  return withDate.reduce((latest, r) => (r.date > latest.date ? r : latest))
}

interface Props {
  records: RecordEntry[]
  milestonesCount: number
}

export function ProfileRecords({ records, milestonesCount }: Props) {
  const best = mostRecent(records)
  const recent = best?.date ? isRecentPr(best.date) : false

  return (
    <GlassSurface variant="card" className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">{t.profile.records.title}</h2>
        <Trophy size={16} className="text-muted-foreground" aria-hidden="true" />
      </div>

      {best ? (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-extrabold tracking-tight text-foreground">
              {best.seconds !== null ? formatDuration(best.seconds) : '—'}
            </span>
            {recent && (
              <span className="rounded-[4px] border border-emerald-500/25 bg-emerald-500/[0.14] px-[5px] py-px text-micro font-bold text-emerald-600 dark:text-emerald-400">
                {t.profile.records.newBadge}
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-micro text-muted-foreground">
            {best.label} · {formatDateWithYear(best.date)}
          </div>
        </div>
      ) : (
        <p className="text-micro text-muted-foreground">{t.profile.records.notYet}</p>
      )}

      <div className="mt-auto flex flex-col gap-1.5">
        <Link
          href="/records"
          className="flex items-center gap-1.5 text-sm font-semibold text-accent-text active:scale-95"
        >
          {t.profile.records.viewAll} <ArrowRight size={16} />
        </Link>
        {milestonesCount > 0 && (
          <Link
            href="/milestones"
            className="flex items-center gap-1.5 text-caption font-semibold text-muted-foreground active:scale-95"
          >
            {t.profile.milestones.viewAll} <ArrowRight size={14} />
          </Link>
        )}
      </div>
    </GlassSurface>
  )
}
