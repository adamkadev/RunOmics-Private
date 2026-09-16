'use client'

import { useState } from 'react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import type { AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import type { ZoneShare } from '@/application/usecases/GetAnalyticsData'
import { collapseUnusedZones, zoneRangeLabel } from '@/domain/activity/zoneRows'
import { formatDurationCompact } from '@/lib/formatters'
import { ZONE_COLOR_CLASSES } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

type Bounds = [number, number, number, number, number]
type View = 'week' | 'recent'

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
  const [manualView, setManualView] = useState<View | null>(null)
  const lthr = athlete.lthrBpm
  const bounds = athlete.hrZoneBoundsBpm ?? (lthr !== undefined ? defaultBounds(lthr) : null)

  if (bounds === null) return null

  const weekHasData = totalSeconds(weeklyZoneTime) > 0
  const view = manualView ?? (weekHasData ? 'week' : 'recent')
  const isAutoFallback = manualView === null && !weekHasData
  const zoneTime = view === 'week' ? weeklyZoneTime : recentZoneTime

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

  const rows = collapseUnusedZones(
    zones.map((z) => ({ zone: z.zone, used: (timeByZone.get(z.zone)?.seconds ?? 0) > 0, data: z })),
  )

  const unusedLabel = view === 'week' ? s.unusedThisWeek : s.unusedRecent

  const note =
    windowTotal === 0 ? s.noSessionsThisWeek : isAutoFallback ? s.emptyWeekFallback : null

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-foreground">{s.title}</h2>
          {lthr !== undefined && <p className="mt-0.5 text-xs text-subtle">{s.subline(lthr)}</p>}
        </div>
        {windowTotal > 0 && (
          <span className="shrink-0 text-xs font-semibold text-muted-foreground">
            {s.total(formatDurationCompact(windowTotal))}
          </span>
        )}
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
        {rows.map((row) => {
          if (row.kind === 'unused') {
            return (
              <p key={`unused-${row.zones.join('-')}`} className="text-xs text-subtle">
                {unusedLabel(zoneRangeLabel(row.zones))}
              </p>
            )
          }

          const { zone, min, max } = row.data
          const time = timeByZone.get(zone)
          const barPercent = time && maxZoneSeconds > 0 ? Math.max(4, Math.round((time.seconds / maxZoneSeconds) * 100)) : 0

          return (
            <div key={zone}>
              <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                <span className="text-foreground/80">
                  {t.activity.zones.labels[zone]}
                  {' · '}
                  {max === null ? <>&ge; {min}</> : <>{min}–{max}</>}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {time ? formatDurationCompact(time.seconds) : `0${t.units.hour}00`}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full" style={{ background: 'rgba(148, 178, 220, 0.12)' }}>
                <div
                  className={cn('h-full rounded-full transition-all', ZONE_COLOR_CLASSES[zone]?.bg)}
                  style={{ width: `${barPercent}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {note && (
        <div className="mt-4 border-t border-foreground/[0.06] pt-3.5 text-xs leading-snug text-muted-foreground">
          {note}
        </div>
      )}
    </GlassSurface>
  )
}
