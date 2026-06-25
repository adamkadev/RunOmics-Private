import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { PrBadge } from './PrBadge'
import { ACTIVITY_TYPE_CONFIG } from '@/domain/activity/types'
import type { Activity } from '@/domain/activity/types'
import { formatDate, formatDistance, formatDuration, formatClock } from '@/lib/formatters'
import { t } from '@/i18n'

interface Props {
  activity: Activity
  prLabels?: string[]
}

/** B4 anatomy: icon + title + chevron, type pill + date, 4-metric grid. */
export function ActivityListCard({ activity: a, prLabels = [] }: Props) {
  const { dotColor } = ACTIVITY_TYPE_CONFIG[a.type]
  const title = a.description || t.activity.runTitle(a.dayOfWeek)

  return (
    <Link
      href={`/activities/${a.id}`}
      className="glass-card block rounded-[20px] px-5 py-[18px] transition-transform duration-[120ms] ease-out active:scale-[0.98]"
    >
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
          style={{
            backgroundColor: `color-mix(in srgb, ${dotColor} 10%, transparent)`,
            borderColor: `color-mix(in srgb, ${dotColor} 30%, transparent)`,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dotColor} strokeWidth="2.2">
            <path d="M13 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-5 6l2-2 2 1 3-2M7 17l2-3 3 1 2-2" />
          </svg>
        </span>
        <span className="flex-1 truncate text-[15px] font-bold text-foreground">{title}</span>
        <ChevronRight size={16} className="shrink-0 text-foreground/30" />
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <span
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[11px] font-semibold"
          style={{
            backgroundColor: `color-mix(in srgb, ${dotColor} 16%, transparent)`,
            borderColor: `color-mix(in srgb, ${dotColor} 28%, transparent)`,
            color: dotColor,
          }}
        >
          <span className="h-[5px] w-[5px] shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />
          {t.activityTypes[a.type]}
        </span>
        <PrBadge labels={prLabels} />
        <span className="text-xs font-medium text-muted-foreground">{formatDate(a.date)}</span>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-x-1 gap-y-2.5 border-t border-foreground/[0.07] pt-2.5">
        <Metric value={formatDistance(a.distanceKm)} unit={t.units.km} />
        <Metric value={formatDuration(a.durationSeconds)} unit={t.activities.row.duration} />
        {a.paceSecPerKm ? (
          <Metric value={formatClock(a.paceSecPerKm)} unit={t.units.perKm} />
        ) : (
          <Metric value="-" unit={t.units.perKm} />
        )}
        {a.avgHeartRate ? (
          <Metric value={`${a.avgHeartRate}`} unit={t.units.bpm} />
        ) : (
          <Metric value="-" unit={t.units.bpm} />
        )}
      </div>
    </Link>
  )
}

function Metric({ value, unit }: { value: string; unit: string }) {
  return (
    <div>
      <div className="text-[15px] font-extrabold text-foreground">{value}</div>
      <div className="text-[10px] font-semibold text-muted-foreground">{unit}</div>
    </div>
  )
}
