import Link from 'next/link'
import { Check } from 'lucide-react'
import { ActivityTypeTag } from './ActivityTypeTag'
import { PrBadge } from './PrBadge'
import { formatDate, formatDistance, formatDuration, formatPace } from '@/lib/formatters'
import type { Activity } from '@/domain/activity/types'
import { cardClass } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface Props {
  activity: Activity
  prLabels?: string[]
  selectable?: boolean
  selected?: boolean
  selectionDisabled?: boolean
  onToggleSelect?: () => void
  /** `glass` renders a lighter translucent sub-surface (Dashboard recent activities, B9). */
  surface?: 'card' | 'glass'
}

export function ActivityRow({
  activity: a,
  prLabels = [],
  selectable = false,
  selected = false,
  selectionDisabled = false,
  onToggleSelect,
  surface = 'card',
}: Props) {
  const rowClassName = surface === 'glass'
    ? cn(
        'glass-row grid grid-cols-[1fr_auto] items-center gap-x-4 p-4 transition-transform active:scale-[0.99]',
        selected && 'border-accent ring-1 ring-accent',
        selectionDisabled && 'cursor-not-allowed opacity-50'
      )
    : cardClass({
        clickable: !selectionDisabled,
        className: cn(
          'grid grid-cols-[1fr_auto] items-center gap-x-4',
          selected && 'border-accent ring-1 ring-accent',
          selectionDisabled && 'cursor-not-allowed opacity-50'
        ),
      })

  if (selectable) {
    return (
      <button
        type="button"
        onClick={onToggleSelect}
        disabled={selectionDisabled}
        className={cn(rowClassName, 'w-full text-left')}
      >
        <RowContent activity={a} prLabels={prLabels} selected={selected} />
      </button>
    )
  }

  return (
    <Link href={`/activities/${a.id}`} className={rowClassName}>
      <RowContent activity={a} prLabels={prLabels} />
    </Link>
  )
}

function RowContent({ activity: a, prLabels, selected }: { activity: Activity; prLabels: string[]; selected?: boolean }) {
  return (
    <>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {selected !== undefined && (
            <span
              className={cn(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                selected ? 'border-accent bg-accent text-accent-foreground' : 'border-border'
              )}
            >
              {selected && <Check size={10} />}
            </span>
          )}
          <ActivityTypeTag type={a.type} />
          <PrBadge labels={prLabels} />
          {a.rpe !== null && (
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium text-subtle`}>
              RPE {a.rpe}
            </span>
          )}
          <div className="hidden sm:block">
            <span className="text-xs text-subtle">{formatDate(a.date)}</span>
          </div>
        </div>
        {a.description && (
          <p className="mt-1 text-sm font-medium text-foreground">
            {a.description}
          </p>
        )}
        {a.comment && (
          <p className="mt-0.5 truncate text-xs text-subtle">{a.comment}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-5 text-right text-sm">
        <div>
          <span className="text-xs text-subtle">{formatDate(a.date)}</span>
          <p className="font-semibold text-foreground">
            {formatDistance(a.distanceKm)}
            <span className="text-subtle"> {t.units.km}</span>
          </p>
        </div>
        <div className="hidden sm:block">
          <p className="font-medium text-foreground/80">
            {formatDuration(a.durationSeconds)}
          </p>
          <p className="text-xs text-subtle">{t.activities.row.duration}</p>
        </div>
        {a.paceSecPerKm && (
          <div className="hidden md:block">
            <p className="font-medium text-foreground/80">
              {formatPace(a.paceSecPerKm)}
            </p>
            <p className="text-xs text-subtle">{t.activities.row.pace}</p>
          </div>
        )}
        {a.avgHeartRate && (
          <div className="hidden lg:block">
            <p className="font-medium text-foreground/80">
              {a.avgHeartRate} <span className="text-xs font-normal">{t.units.bpm}</span>
            </p>
            <p className="text-xs text-subtle">{t.activities.row.avgHr}</p>
          </div>
        )}
      </div>
    </>
  )
}
