'use client'

import { useState } from 'react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import type { AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import type { ZoneShare } from '@/application/usecases/GetAnalyticsData'
import { formatDurationWords } from '@/lib/formatters'
import { ZONE_COLOR_CLASSES } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

type Bounds = [number, number, number, number, number]
type View = 'week' | 'recent'

const DEFAULT_LTHR = 170
const ZONE_PERCENTS = [0.65, 0.80, 0.89, 0.95, 1.00]

function defaultBounds(lthr: number): Bounds {
  return ZONE_PERCENTS.map((p) => Math.round(lthr * p)) as Bounds
}

function totalSeconds(zoneTime: ZoneShare[]): number {
  return zoneTime.reduce((sum, z) => sum + z.seconds, 0)
}

interface Props {
  athlete: AthleteProfile
  weeklyZoneTime: ZoneShare[]
  recentZoneTime: ZoneShare[]
}

export function ProfileHrZones({ athlete, weeklyZoneTime, recentZoneTime }: Props) {
  const s = t.profile.hrZones
  const lthr = athlete.lthrBpm ?? DEFAULT_LTHR
  const bounds = athlete.hrZoneBoundsBpm ?? defaultBounds(lthr)

  const [manualView, setManualView] = useState<View | null>(null)
  const weekHasData = totalSeconds(weeklyZoneTime) > 0
  const view = manualView ?? (weekHasData ? 'week' : 'recent')
  const isAutoFallback = manualView === null && !weekHasData
  const zoneTime = view === 'week' ? weeklyZoneTime : recentZoneTime

  // Garmin gives us a floor per zone and ends each range one bpm below the next
  // floor; zone 5 stays open-ended.
  const zones = [
    { zone: 5, min: bounds[4], max: null },
    { zone: 4, min: bounds[3], max: bounds[4] - 1 },
    { zone: 3, min: bounds[2], max: bounds[3] - 1 },
    { zone: 2, min: bounds[1], max: bounds[2] - 1 },
    { zone: 1, min: bounds[0], max: bounds[1] - 1 },
  ]

  const timeByZone = new Map(zoneTime.map((z) => [z.zone, z]))
  const windowTotal = totalSeconds(zoneTime)
  const maxZoneSeconds = Math.max(0, ...zoneTime.map((z) => z.seconds))

  const dominant = zoneTime.reduce<ZoneShare | null>(
    (best, z) => (best === null || z.seconds > best.seconds ? z : best),
    null
  )

  const insight =
    windowTotal === 0
      ? s.noSessionsThisWeek
      : isAutoFallback
        ? s.emptyWeekFallback
        : dominant === null
          ? s.noSessionsThisWeek
          : dominant.percent >= 70 && (timeByZone.get(4)?.percent ?? 0) < 12
            ? s.insight.polarized(dominant.percent, t.activity.zones.labels[dominant.zone] ?? '')
            : s.insight.dominant(dominant.percent, t.activity.zones.labels[dominant.zone] ?? '')

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">{s.title}</h2>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <span>{s.lthr}</span>
          <span className="text-xs font-bold text-accent-text">{lthr}</span>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setManualView('recent')}
          className={cn(
            'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
            view === 'recent' ? 'bg-accent text-accent-foreground' : 'text-subtle'
          )}
        >
          {s.recentWeeks}
        </button>
        <button
          type="button"
          onClick={() => setManualView('week')}
          className={cn(
            'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
            view === 'week' ? 'bg-accent text-accent-foreground' : 'text-subtle'
          )}
        >
          {s.thisWeek}
        </button>
      </div>

      <div className="flex flex-col gap-3.5">
        {zones.map(({ zone, min, max }) => {
          const time = timeByZone.get(zone)
          const barPercent = time && maxZoneSeconds > 0 ? Math.max(4, Math.round((time.seconds / maxZoneSeconds) * 100)) : 0
          const isDominant = dominant?.zone === zone

          return (
            <div key={zone}>
              <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                <span className="text-foreground/80">
                  {t.activity.zones.labels[zone]}
                  {' · '}
                  {max === null ? <>&ge; {min}</> : <>{min}–{max}</>}
                </span>
                <span className={isDominant ? 'font-semibold text-foreground' : 'tabular-nums text-muted-foreground'}>
                  {time ? formatDurationWords(time.seconds) : `0 ${t.units.min}`}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-foreground/[0.06]">
                <div
                  className={cn('h-full rounded-full transition-all', ZONE_COLOR_CLASSES[zone]?.bg)}
                  style={{ width: `${barPercent}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 border-t border-foreground/[0.06] pt-3.5 text-xs leading-snug text-muted-foreground">
        {insight}
      </div>
    </GlassSurface>
  )
}
