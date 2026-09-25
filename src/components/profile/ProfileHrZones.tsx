'use client'

import { useState } from 'react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import type { AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import type { ZoneShare } from '@/application/usecases/GetAnalyticsData'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import { formatClock as fmt, formatDurationCompact } from '@/lib/formatters'
import { ZONE_COLOR_CLASSES } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

type Bounds = [number, number, number, number, number]
type View = 'week' | 'recent'

const HR_PERCENTS = [0.65, 0.8, 0.89, 0.95, 1.0]
const HIGH_INTENSITY_ZONES = [4, 5]

function defaultBounds(lthr: number): Bounds {
  return HR_PERCENTS.map((p) => Math.round(lthr * p)) as Bounds
}

function totalSeconds(zoneTime: ZoneShare[]): number {
  return zoneTime.reduce((sum, z) => sum + z.seconds, 0)
}

function bpmRangeLabel(min: number, max: number | null): string {
  return max === null ? `≥ ${min}` : `${min}–${max}`
}

interface Props {
  athlete: Pick<AthleteProfile, 'lthrBpm' | 'hrZoneBoundsBpm'>
  weeklyZoneTime: ZoneShare[]
  recentZoneTime: ZoneShare[]
  paceZones?: TrainingZonesData | null
}

export function ProfileHrZones({ athlete, weeklyZoneTime, recentZoneTime, paceZones }: Props) {
  const s = t.profile.trainingZones
  const [manualView, setManualView] = useState<View | null>(null)
  const lthr = athlete.lthrBpm
  const bounds = athlete.hrZoneBoundsBpm ?? (lthr !== undefined ? defaultBounds(lthr) : null)

  if (bounds === null) return null

  const weekHasData = totalSeconds(weeklyZoneTime) > 0
  const view = manualView ?? (weekHasData ? 'week' : 'recent')
  const isAutoFallback = manualView === null && !weekHasData
  const zoneTime = view === 'week' ? weeklyZoneTime : recentZoneTime

  const paceByHrZone = new Map((paceZones?.zones ?? []).map((zone) => [zone.hrZone, zone]))
  const easyZone = paceByHrZone.get(2)
  const warmupPaceSecPerKm = easyZone ? easyZone.paceMaxSecPerKm + 1 : null

  const zones = [
    { zone: 5, min: bounds[4], max: null as number | null, pace: paceByHrZone.get(5) },
    { zone: 4, min: bounds[3], max: bounds[4] - 1, pace: paceByHrZone.get(4) },
    { zone: 3, min: bounds[2], max: bounds[3] - 1, pace: paceByHrZone.get(3) },
    { zone: 2, min: bounds[1], max: bounds[2] - 1, pace: paceByHrZone.get(2) },
    { zone: 1, min: bounds[0], max: bounds[1] - 1, pace: undefined },
  ]

  const timeByZone = new Map(zoneTime.map((z) => [z.zone, z]))
  const windowTotal = totalSeconds(zoneTime)
  const maxZoneSeconds = Math.max(0, ...zoneTime.map((z) => z.seconds))

  const recentTotal = totalSeconds(recentZoneTime)
  const recentAvgPerWeek = Math.round(recentTotal / 4)
  const headerValue = view === 'week' ? windowTotal : recentAvgPerWeek
  const headerCaption = view === 'week' ? s.thisWeekCaption : s.avgPerWeek

  const highIntensitySeconds = HIGH_INTENSITY_ZONES.reduce(
    (sum, zone) => sum + (timeByZone.get(zone)?.seconds ?? 0),
    0
  )
  const highIntensityPct = windowTotal > 0 ? Math.round((highIntensitySeconds / windowTotal) * 100) : null

  const note =
    windowTotal === 0
      ? view === 'week'
        ? s.noSessionsThisWeek
        : s.noSessionsRecent
      : isAutoFallback
        ? s.emptyWeekFallback
        : highIntensityPct !== null
          ? s.highIntensityNote(highIntensityPct)
          : null

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-foreground">{s.title}</h2>
          {lthr !== undefined && (
            <p className="mt-0.5 text-xs text-subtle">
              {paceZones
                ? s.sublineWithThreshold(lthr, fmt(paceZones.thresholdPaceSecPerKm))
                : s.subline(lthr)}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-bold tabular-nums text-foreground">
            {formatDurationCompact(headerValue)}
            <span className="ml-1 text-caption font-normal text-subtle">{headerCaption}</span>
          </div>
          {view === 'recent' && windowTotal > 0 && (
            <div className="text-caption text-muted-foreground">
              {s.total(formatDurationCompact(recentTotal))}
            </div>
          )}
        </div>
      </div>

      <div className="mb-4 flex w-full gap-1 rounded-full bg-foreground/[0.04] p-1">
        <button
          type="button"
          onClick={() => setManualView('week')}
          className={cn(
            'flex-1 min-h-[44px] rounded-full py-1.5 text-xs font-semibold transition-colors',
            view === 'week' ? 'bg-accent text-accent-foreground' : 'text-foreground/55'
          )}
        >
          {s.thisWeek}
        </button>
        <button
          type="button"
          onClick={() => setManualView('recent')}
          className={cn(
            'flex-1 min-h-[44px] rounded-full py-1.5 text-xs font-semibold transition-colors',
            view === 'recent' ? 'bg-accent text-accent-foreground' : 'text-foreground/55'
          )}
        >
          {s.recentWeeks}
        </button>
      </div>

      {paceZones && (
        <div className="mb-2 flex items-center justify-between gap-2 text-caption font-semibold uppercase tracking-wide text-subtle-2">
          <span>{s.columnZone}</span>
          <span className="flex items-center gap-5">
            <span>{s.columnPace}</span>
            <span>{view === 'week' ? s.columnThisWeek : s.columnAvgWeek}</span>
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3.5">
        {zones.map(({ zone, min, max, pace }) => {
          const time = timeByZone.get(zone)
          const seconds = time?.seconds ?? 0
          const minutes = Math.round(seconds / 60)
          const barPercent =
            minutes > 0 && maxZoneSeconds > 0 ? Math.max(4, Math.round((seconds / maxZoneSeconds) * 100)) : 0
          const style = ZONE_COLOR_CLASSES[zone]
          const range = bpmRangeLabel(min, max)

          const paceLabel =
            zone === 1
              ? warmupPaceSecPerKm !== null
                ? `${fmt(warmupPaceSecPerKm)}+`
                : null
              : pace
                ? `${fmt(pace.paceMinSecPerKm)}–${fmt(pace.paceMaxSecPerKm)}`
                : null

          return (
            <div key={zone}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', style?.bg)} />
                  <span className="truncate font-semibold text-foreground/80">{s.zoneNames[zone]}</span>
                  <span className="shrink-0 font-mono text-caption font-semibold text-subtle-2">
                    {t.trainingZones.zoneNumber(zone)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-4">
                  {paceLabel ? (
                    <span className="text-right">
                      <div className="font-mono text-sm font-bold tabular-nums text-foreground">{paceLabel}</div>
                      <div className="font-mono text-caption tabular-nums text-subtle-2">{range}</div>
                    </span>
                  ) : (
                    <span className="font-mono text-xs tabular-nums text-foreground/80">{range}</span>
                  )}
                  <span className="w-11 shrink-0 text-right font-mono text-sm font-bold tabular-nums text-foreground">
                    {formatDurationCompact(seconds)}
                  </span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full" style={{ background: 'rgba(148, 178, 220, 0.12)' }}>
                <div
                  className={cn('h-full rounded-full transition-all', style?.bg)}
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
