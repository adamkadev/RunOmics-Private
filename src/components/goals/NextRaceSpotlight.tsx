import { Flag, MapPin } from 'lucide-react'
import type { NextRaceSpotlight as NextRaceSpotlightData } from '@/application/usecases/GetGoalsData'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { formatDate, formatDuration } from '@/lib/formatters'
import { STATUS } from '@/lib/statusColors'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { shortDist } from './YearView'

function gapDisplay(gapSeconds: number | null): { label: string; className: string } {
  if (gapSeconds === null) return { label: '-', className: 'text-subtle' }
  if (gapSeconds <= 0) return { label: `-${formatDuration(Math.abs(gapSeconds))}`, className: STATUS.success.text }
  return { label: `+${formatDuration(gapSeconds)}`, className: STATUS.warning.text }
}

export function NextRaceSpotlight({ spotlight }: { spotlight: NextRaceSpotlightData }) {
  const { race, daysUntil, predictedSeconds, gapSeconds } = spotlight
  const s = t.goals.nextRace
  const gap = gapDisplay(gapSeconds)

  return (
    <GlassSurface
      variant="card"
      className="rounded-2xl p-5"
      style={{ background: 'rgba(245,158,11,0.07)', borderColor: 'rgba(245,158,11,0.28)' }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
          <Flag size={13} />
          {s.title}
        </span>
        <span className="shrink-0 text-xs font-bold tabular-nums text-amber-600 dark:text-amber-400">
          {t.goals.daysUntil(daysUntil)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg font-bold text-foreground">{race.name}</span>
        <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-xs font-medium text-foreground/70">
          {shortDist(race.distance)}
        </span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-subtle">
        <span>{formatDate(race.date)}</span>
        {race.location && (
          <span className="flex items-center gap-1">
            <MapPin size={12} />
            {race.location}
          </span>
        )}
      </div>

      {(race.targetSeconds || predictedSeconds !== null) && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-black/[0.15] p-2.5 text-center">
            <div className="text-[10px] text-subtle">{s.target}</div>
            <div className="mt-0.5 text-sm font-bold text-foreground">
              {race.targetSeconds ? formatDuration(race.targetSeconds) : '-'}
            </div>
          </div>
          <div className="rounded-xl bg-black/[0.15] p-2.5 text-center">
            <div className="text-[10px] text-subtle">{s.predicted}</div>
            <div className="mt-0.5 text-sm font-bold text-foreground">
              {predictedSeconds !== null ? formatDuration(predictedSeconds) : '-'}
            </div>
          </div>
          <div className="rounded-xl bg-black/[0.15] p-2.5 text-center">
            <div className="text-[10px] text-subtle">{s.gap}</div>
            <div className={cn('mt-0.5 text-sm font-bold', gap.className)}>{gap.label}</div>
          </div>
        </div>
      )}
    </GlassSurface>
  )
}
