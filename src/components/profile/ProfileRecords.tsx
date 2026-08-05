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

function mostRecent(records: RecordEntry[]): (RecordEntry & { date: string }) | null {
  const withDate = records.filter((r): r is RecordEntry & { date: string } => r.date !== null)
  if (withDate.length === 0) return null
  return withDate.reduce((latest, r) => (r.date > latest.date ? r : latest))
}

interface Props {
  records: RecordEntry[]
}

export function ProfileRecords({ records }: Props) {
  const best = mostRecent(records)
  const recent = best?.date ? isRecentPr(best.date) : false

  return (
    <GlassSurface variant="card" className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between">
        <h2 className="text-sm font-bold text-foreground">{t.profile.records.title}</h2>
        {best && recent && (
          <span
            className="rounded-[5px] border px-[6px] py-px text-micro font-bold text-accent-text"
            style={{
              // Accent-subtle, per the Progress mockup: a NEW badge shouldn't stay
              // emerald when the athlete's theme is rose/blue/etc.
              borderColor: 'color-mix(in srgb, var(--accent) 25%, transparent)',
              background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
            }}
          >
            {t.profile.records.newBadge}
          </span>
        )}
      </div>

      {best ? (
        <div>
          <span className="text-lg font-extrabold tracking-tight text-foreground">
            {best.seconds !== null ? formatDuration(best.seconds) : '–'}
          </span>
          <div className="mt-0.5 truncate text-micro text-muted-foreground">
            {best.label} · {formatDateWithYear(best.date)}
          </div>
        </div>
      ) : (
        <p className="text-micro text-muted-foreground">{t.profile.records.notYet}</p>
      )}

      <Link
        href="/records"
        className="mt-auto flex min-h-6 items-center gap-1.5 text-sm font-semibold text-accent-text active:scale-95"
      >
        {t.profile.records.viewAll} <ArrowRight size={16} />
      </Link>
    </GlassSurface>
  )
}
