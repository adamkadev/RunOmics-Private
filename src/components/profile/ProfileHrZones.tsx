'use client'

import { useState } from 'react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { SegmentedTabs, useSegmentedTabs } from '@/components/ui/SegmentedTabs'
import type { AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import type { ZoneShare } from '@/application/usecases/GetAnalyticsData'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import { formatClock as fmt, formatDurationWords } from '@/lib/formatters'
import { t } from '@/i18n'

type Bounds = [number, number, number, number, number]
type View = 'week' | 'recent'

const VIEWS = ['week', 'recent'] as const
const HR_PERCENTS = [0.65, 0.8, 0.89, 0.95, 1.0]
const HIGH_INTENSITY_ZONES = [4, 5]

/** Zone, pace, HR and time: one grid for the header and every row. */
const ROW_GRID = 'grid grid-cols-[minmax(0,1fr)_4.75rem_3.625rem_2.75rem] items-center gap-1.5'

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

/**
 * One zone table under one Week / 4 weeks toggle. Pace and HR used to stack
 * in a single cell with no HR label, and time read "0h09"; each is now its
 * own labelled column and time is written the way the rest of the app writes
 * it ("9 min").
 */
export function ProfileHrZones({ athlete, weeklyZoneTime, recentZoneTime, paceZones }: Props) {
  const s = t.profile.trainingZones
  const [manualView, setManualView] = useState<View | null>(null)
  const lthr = athlete.lthrBpm
  const bounds = athlete.hrZoneBoundsBpm ?? (lthr !== undefined ? defaultBounds(lthr) : null)

  const weekHasData = totalSeconds(weeklyZoneTime) > 0
  const view = manualView ?? (weekHasData ? 'week' : 'recent')
  const tabs = useSegmentedTabs<View>({ ids: VIEWS, value: view, onChange: setManualView })

  if (bounds === null) return null

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

  const highIntensitySeconds = HIGH_INTENSITY_ZONES.reduce(
    (sum, zone) => sum + (timeByZone.get(zone)?.seconds ?? 0),
    0
  )
  const highIntensityPct = windowTotal > 0 ? Math.round((highIntensitySeconds / windowTotal) * 100) : null

  const totalLine =
    windowTotal === 0
      ? view === 'week'
        ? s.noSessionsThisWeek
        : s.noSessionsRecent
      : view === 'week'
        ? s.inZonesWeek(formatDurationWords(windowTotal))
        : s.inZonesRecent(formatDurationWords(windowTotal))

  const note =
    windowTotal === 0
      ? null
      : isAutoFallback
        ? s.emptyWeekFallback
        : highIntensityPct !== null
          ? s.highIntensityNote(highIntensityPct)
          : null

  return (
    <GlassSurface variant="card" className="rounded-card-sm px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-body font-semibold text-foreground">{s.title}</h2>
        <SegmentedTabs
          tabs={tabs}
          label={s.viewLabel}
          size="sm"
          items={[
            { id: 'week', label: s.week },
            { id: 'recent', label: s.fourWeeks },
          ]}
        />
      </div>

      <div {...tabs.panelProps} className="mt-2.5 outline-none">
        <div
          className={`${ROW_GRID} text-caption font-semibold uppercase tracking-wide text-subtle`}
          data-testid="zone-columns"
        >
          <span>{s.columnZone}</span>
          <span>{s.columnPace}</span>
          <span>{s.columnHr}</span>
          <span className="text-right">{s.columnTime}</span>
        </div>

        {zones.map(({ zone, min, max, pace }) => {
          const seconds = timeByZone.get(zone)?.seconds ?? 0
          const barPercent =
            seconds >= 30 && maxZoneSeconds > 0 ? Math.max(4, Math.round((seconds / maxZoneSeconds) * 100)) : 0

          const paceLabel =
            zone === 1
              ? warmupPaceSecPerKm !== null
                ? `${fmt(warmupPaceSecPerKm)} +`
                : '-'
              : pace
                ? `${fmt(pace.paceMinSecPerKm)}–${fmt(pace.paceMaxSecPerKm)}`
                : '-'

          return (
            <div key={zone} className="border-t border-foreground/[0.08] py-2" data-testid={`zone-row-${zone}`}>
              <div className={`${ROW_GRID} text-footnote`}>
                <span className="flex min-w-0 items-center gap-1.5 font-semibold text-foreground">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: `var(--zone-${zone})` }} />
                  <span className="truncate">
                    {t.trainingZones.zoneNumber(zone)} {s.zoneNames[zone]}
                  </span>
                </span>
                <span className="tabular-nums text-foreground">{paceLabel}</span>
                <span className="tabular-nums text-muted-foreground">{bpmRangeLabel(min, max)}</span>
                <span className="text-right font-semibold tabular-nums text-foreground">
                  {formatDurationWords(seconds)}
                </span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-sm bg-foreground/[0.08]">
                <div
                  className="h-full transition-all"
                  style={{ width: `${barPercent}%`, background: `var(--zone-${zone})` }}
                />
              </div>
            </div>
          )
        })}

        <p className="mt-1.5 text-xs text-muted-foreground">{totalLine}</p>
        {note && <p className="mt-1 text-xs leading-snug text-subtle">{note}</p>}
      </div>
    </GlassSurface>
  )
}
