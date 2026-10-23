import { Flag } from 'lucide-react'
import { topPercentile, type OfficialRaceResult } from '@/domain/activity/raceResult'
import { formatDistance, formatDuration, formatPace } from '@/lib/formatters'
import { cardClass } from '@/components/ui/Card'
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
    <section className={cardClass({ className: 'flex flex-col gap-3' })}>
      <h3 className="text-headline text-foreground">{s.title}</h3>
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-[var(--surface-2)]">
          <Flag size={15} className="text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {formatDistance(distanceKm)} {t.units.km}
            <span className="ml-1.5 font-normal text-muted-foreground">
              {formatDuration(result.chipTimeSeconds)} · {formatPace(Math.round(result.chipTimeSeconds / distanceKm))}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {result.overallPlace !== undefined && (
              <span className="font-medium text-[var(--text-2)]">
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
            // A record is good news: pos, not the caution gold.
            <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-caption font-semibold text-[var(--pos)]">
              {t.activity.bestEfforts.prBadge}
            </span>
          )}
          {percentile !== null && (
            <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-caption font-semibold text-muted-foreground">
              {s.topPercent(percentile)}
            </span>
          )}
        </div>
      </div>
      <p className="border-t border-border pt-2.5 text-xs text-muted-foreground">
        {s.deviceNote(`${formatDistance(garminDistanceKm)} ${t.units.km}`, formatDuration(garminDurationSeconds))}
      </p>
    </section>
  )
}
