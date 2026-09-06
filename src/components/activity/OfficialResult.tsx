import { Flag } from 'lucide-react'
import { topPercentile, type OfficialRaceResult } from '@/domain/activity/raceResult'
import { formatDistance, formatDuration, formatPace } from '@/lib/formatters'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { t } from '@/i18n'

interface Props {
  result: OfficialRaceResult
  garminDistanceKm: number
  garminDurationSeconds: number
  isPersonalBest?: boolean
}

export function OfficialResult({ result, garminDistanceKm, garminDurationSeconds, isPersonalBest = false }: Props) {
  const s = t.activity.officialResult
  const distanceKm = result.distanceMeters / 1_000
  const percentile = topPercentile(result.overallPlace, result.finisherCount)

  return (
    <GlassSurface variant="card" className="p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground/80">{s.title}</h3>
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-amber-100 dark:bg-amber-900/30">
          <Flag size={15} className="text-amber-600 dark:text-amber-400" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {formatDistance(distanceKm)} {t.units.km}
            <span className="ml-1.5 font-normal text-subtle">
              {formatDuration(result.chipTimeSeconds)} · {formatPace(Math.round(result.chipTimeSeconds / distanceKm))}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-subtle">
            {result.overallPlace !== undefined && (
              <span className="font-medium text-foreground/70">
                {result.finisherCount === undefined
                  ? s.placingWithoutField(result.overallPlace)
                  : s.placing(result.overallPlace, result.finisherCount)}
              </span>
            )}
            {result.gunTimeSeconds !== undefined && (
              <span>{result.overallPlace !== undefined ? ' · ' : ''}{s.gun} {formatDuration(result.gunTimeSeconds)}</span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isPersonalBest && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-caption font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
              {t.activity.bestEfforts.prBadge}
            </span>
          )}
          {percentile !== null && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-caption font-bold text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">
              {s.topPercent(percentile)}
            </span>
          )}
        </div>
      </div>
      <p className="mt-2.5 border-t border-border/50 pt-2 text-xs text-subtle">
        {s.deviceNote(`${formatDistance(garminDistanceKm)} ${t.units.km}`, formatDuration(garminDurationSeconds))}
      </p>
    </GlassSurface>
  )
}
