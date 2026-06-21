import Link from 'next/link'
import { Trophy } from 'lucide-react'
import type { RecordEntry } from '@/application/usecases/GetRecords'
import { formatDuration, formatDistance, formatDateWithYear } from '@/lib/formatters'

export function LatestRecordBadge({ record }: { record: RecordEntry | null }) {
  if (!record || record.seconds === null || record.date === null) return null

  const mainStat = record.distanceKm != null ? formatDistance(record.distanceKm) : formatDuration(record.seconds)

  const badge = (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
      <Trophy size={12} className="shrink-0" />
      {record.label} {mainStat}
      <span className="font-normal text-amber-600/70 dark:text-amber-400/60">· {formatDateWithYear(record.date)}</span>
    </span>
  )

  return record.activityId ? (
    <Link href={`/activities/${record.activityId}`} className="transition-opacity hover:opacity-80">
      {badge}
    </Link>
  ) : (
    badge
  )
}
