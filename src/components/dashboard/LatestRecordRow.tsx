import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { RecordEntry } from '@/domain/race/records'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { formatDate, formatDuration } from '@/lib/formatters'
import { t } from '@/i18n'

/**
 * The most recent win, from the same record CelebrationOverlay announces: one
 * row on Today that opens Records.
 */
export function LatestRecordRow({ record }: { record: RecordEntry | null }) {
  if (!record || record.seconds === null || !record.date) return null

  return (
    <GlassSurface variant="card" className="rounded-card-sm">
      <Link href="/records" className="flex min-h-11 items-center justify-between gap-3 px-4.5 py-2.5 active:opacity-70">
        <div className="min-w-0">
          <div className="text-caption font-semibold uppercase tracking-[0.06em] text-subtle">{t.dashboard.latestRecord}</div>
          <div className="truncate text-sm font-semibold text-foreground">
            {record.label} {formatDuration(record.seconds)} · {formatDate(record.date)}
          </div>
        </div>
        <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-subtle" />
      </Link>
    </GlassSurface>
  )
}
