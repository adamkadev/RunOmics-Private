'use client'

import { useState } from 'react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { SegmentedTabs, useSegmentedTabs } from '@/components/ui/SegmentedTabs'
import type { AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import type { ZoneShare } from '@/application/usecases/GetAnalyticsData'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import { formatClock as fmt, formatDurationCompact } from '@/lib/formatters'
import { t } from '@/i18n'

type Bounds = [number, number, number, number, number]
type View = 'week' | 'recent'

const VIEWS = ['week', 'recent'] as const
const HR_PERCENTS = [0.65, 0.8, 0.89, 0.95, 1.0]
const HIGH_INTENSITY_ZONES = [4, 5]

/** Zone, pace, HR and time: one grid for the header and every row. */
const ROW_GRID = 'grid grid-cols-[minmax(0,1fr)_4.75rem_3.625rem_2.75rem] items-center gap-1.5'

/** The 10-15% hard-work target, as a bracket under the bar (v4.4.1): Z4-Z5
 *  sit on its right, so the Z3/Z4 edge should fall between 85% and 90%.
 *  Ticks on the bar itself read as zone borders. */
const TARGET_SPAN = { from: 85, to: 90 }

/** Under this share of the window a zone is not drawn, and leaves no gap. */
const MIN_SEGMENT_SHARE = 0.01

/** "16′" under an hour, "1h44" over: the table's time column (C2). */
function zoneTimeLabel(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  return minutes < 60 ? `${minutes}′` : formatDurationCompact(seconds)
}

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
 * One zone table under one Week / 4 weeks toggle (C2, v4.4): the window's
 * time and its Z4-Z5 share against the 10-15% target over one stacked Z1-Z5
 * bar, then zone, pace, HR and time as tabular columns. The stacked bar
 * replaced a progress bar per row.
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

  const highIntensitySeconds = HIGH_INTENSITY_ZONES.reduce(
    (sum, zone) => sum + (timeByZone.get(zone)?.seconds ?? 0),
    0
  )
  const highIntensityPct = windowTotal > 0 ? Math.round((highIntensitySeconds / windowTotal) * 100) : null

  const emptyLine = view === 'week' ? s.noSessionsThisWeek : s.noSessionsRecent
  const stacked = [1, 2, 3, 4, 5]
    .map((zone) => ({ zone, seconds: timeByZone.get(zone)?.seconds ?? 0 }))
    .filter((z) => windowTotal > 0 && z.seconds / windowTotal >= MIN_SEGMENT_SHARE)

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

      <div {...tabs.panelProps} className="mt-3 outline-none">
        {windowTotal === 0 ? (
          <p className="text-footnote text-muted-foreground">{emptyLine}</p>
        ) : (
          <>
            {/* The window's time, and its hard share against the target. */}
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-display text-title2 font-bold leading-none tabular-nums text-foreground" data-testid="zone-total">
                {formatDurationCompact(windowTotal)}
              </span>
              {highIntensityPct !== null && (
                <span className="text-footnote tabular-nums text-muted-foreground" data-testid="zone-hard-share">
                  {s.hardShare(highIntensityPct)}
                </span>
              )}
            </div>
            {/* Z1 to Z5 as one stacked bar, 2 pt apart; nothing drawn on it. */}
            <div className="mt-2" data-testid="zone-stack">
              <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-[4px]">
                {stacked.map((z) => (
                  <span
                    key={z.zone}
                    data-zone={z.zone}
                    className="h-full"
                    style={{ flexGrow: z.seconds, flexBasis: 0, background: `var(--zone-${z.zone})` }}
                  />
                ))}
              </div>
              {/* The target under the bar: a bracket over 85-90% of its width. */}
              <div className="relative mt-1 h-5" data-testid="zone-target">
                <span
                  aria-hidden
                  data-testid="zone-target-bracket"
                  className="absolute top-0 h-1.5 rounded-b-[2px] border-x-2 border-b-2 border-muted-foreground"
                  style={{ left: `${TARGET_SPAN.from}%`, width: `${TARGET_SPAN.to - TARGET_SPAN.from}%` }}
                />
                <span
                  className="absolute top-2 -translate-x-1/2 text-caption leading-none text-muted-foreground"
                  style={{ left: `${(TARGET_SPAN.from + TARGET_SPAN.to) / 2}%` }}
                >
                  {s.target}
                </span>
              </div>
            </div>
            {isAutoFallback && <p className="mt-2 text-xs leading-snug text-subtle">{s.emptyWeekFallback}</p>}
          </>
        )}

        <div
          className={`${ROW_GRID} mt-4 border-b border-border pb-2 text-caption uppercase tracking-[0.06em] text-muted-foreground`}
          data-testid="zone-columns"
        >
          <span>{s.columnZone}</span>
          <span>{s.columnPace}</span>
          <span>{s.columnHr}</span>
          <span className="text-right">{s.columnTime}</span>
        </div>

        {zones.map(({ zone, min, max, pace }) => {
          const seconds = timeByZone.get(zone)?.seconds ?? 0
          const paceLabel =
            zone === 1
              ? warmupPaceSecPerKm !== null
                ? `${fmt(warmupPaceSecPerKm)} +`
                : '-'
              : pace
                ? `${fmt(pace.paceMinSecPerKm)}–${fmt(pace.paceMaxSecPerKm)}`
                : '-'

          return (
            <div key={zone} className="border-b border-border py-2.5 last:border-b-0" data-testid={`zone-row-${zone}`}>
              <div className={`${ROW_GRID} text-footnote`}>
                <span className="flex min-w-0 items-center gap-2 font-semibold text-foreground">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: `var(--zone-${zone})` }} />
                  <span className="truncate">
                    {t.trainingZones.zoneNumber(zone)} {t.zoneLabels[zone]}
                  </span>
                </span>
                <span className="tabular-nums text-foreground">{paceLabel}</span>
                <span className="tabular-nums text-muted-foreground">{bpmRangeLabel(min, max)}</span>
                <span className="text-right font-bold tabular-nums text-foreground">{zoneTimeLabel(seconds)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </GlassSurface>
  )
}
