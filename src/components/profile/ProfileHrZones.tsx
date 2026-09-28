'use client'

import { useState } from 'react'
import { cardClass } from '@/components/ui/Card'
import { Unit } from '@/components/ui/Stat'
import { SegmentedTabs, useSegmentedTabs } from '@/components/ui/SegmentedTabs'
import type { AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import type { ZoneShare } from '@/application/usecases/GetAnalyticsData'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import { formatClock as fmt } from '@/lib/formatters'
import { t } from '@/i18n'

type Bounds = [number, number, number, number, number]
type View = 'week' | 'recent'

const VIEWS = ['week', 'recent'] as const
const HR_PERCENTS = [0.65, 0.8, 0.89, 0.95, 1.0]
const HIGH_INTENSITY_ZONES = [4, 5]

/** Zone, pace, HR and time: one grid for the header and every row, the prototype's widths from sm up. */
const ROW_GRID = 'grid grid-cols-[minmax(0,1fr)_4.75rem_3.75rem_3.5rem] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_110px_90px_70px] sm:gap-3'

/** The hard-work target: 10-15% of the time in Z4-Z5. Outside it is a caution (v4.17). */
const HARD_TARGET = { from: 10, to: 15 }

/** Under this share of the window a zone is not drawn, and leaves no gap. */
const MIN_SEGMENT_SHARE = 0.01

/** "22 min" under an hour, "8 h 37" over: the table's time column (v4.17). */
export function zoneTimeLabel(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  return minutes < 60 ? `${minutes} ${t.units.min}` : `${Math.floor(minutes / 60)} ${t.units.hour} ${String(minutes % 60).padStart(2, '0')}`
}

/** The window's time, "13 h 39 min", its units inline and muted. */
function WindowTotal({ seconds }: { seconds: number }) {
  const minutes = Math.round(seconds / 60)
  const h = Math.floor(minutes / 60)
  return (
    <span className="text-2xl font-semibold leading-tight text-foreground" data-testid="zone-total">
      {h > 0 && (
        <>
          {h}
          <Unit>{t.units.hour}</Unit>{' '}
        </>
      )}
      {minutes % 60}
      <Unit>{t.units.min}</Unit>
    </span>
  )
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

  const hardTone = highIntensityPct === null ? 'text-muted-foreground' : highIntensityPct < HARD_TARGET.from || highIntensityPct > HARD_TARGET.to ? 'text-[var(--warn)]' : 'text-[var(--pos)]'

  return (
    <section className={cardClass({ className: 'flex flex-col gap-3.5' })}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-foreground">{s.title}</h2>
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

      <div {...tabs.panelProps} className="flex flex-col gap-3.5 outline-none">
        {windowTotal === 0 ? (
          <p className="text-[13px] text-muted-foreground">{emptyLine}</p>
        ) : (
          <>
            {/* The window's time, and its hard share against the target: warn outside it (v4.17). */}
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <WindowTotal seconds={windowTotal} />
              {highIntensityPct !== null && (
                <span className={`text-xs ${hardTone}`} data-testid="zone-hard-share">
                  {s.hardShare(highIntensityPct)}
                </span>
              )}
            </div>
            {/* Z1 to Z5 as one bar of rounded segments, 3 pt apart, in the zone colours. */}
            <div className="flex h-2.5 gap-[3px]" data-testid="zone-stack">
              {stacked.map((z) => (
                <span
                  key={z.zone}
                  data-zone={z.zone}
                  className="h-full rounded-full"
                  style={{ flexGrow: z.seconds, flexBasis: 0, background: `var(--zone-${z.zone})` }}
                />
              ))}
            </div>
            {isAutoFallback && <p className="-mt-1 text-xs leading-snug text-muted-foreground">{s.emptyWeekFallback}</p>}
          </>
        )}

        <div>
          <div
            className={`${ROW_GRID} pb-2.5 pt-1.5 text-[11px] uppercase tracking-[0.06em] text-muted-foreground`}
            data-testid="zone-columns"
          >
            <span>{s.columnZone}</span>
            <span className="whitespace-nowrap text-right">{s.columnPace}</span>
            <span className="whitespace-nowrap text-right">
              <span className="sm:hidden">{s.columnHrShort}</span>
              <span className="hidden sm:inline">{s.columnHr}</span>
            </span>
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
              <div key={zone} className={`${ROW_GRID} border-t border-border py-2.5 text-[13px] sm:text-sm`} data-testid={`zone-row-${zone}`}>
                <span className="flex min-w-0 items-center gap-2 text-foreground">
                  <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ background: `var(--zone-${zone})` }} />
                  {/* Wraps on a narrow phone rather than "Z4 Thres…" (v4.17.2). */}
                  <span className="min-w-0">
                    <b className="font-semibold">{t.trainingZones.zoneNumber(zone)}</b> {t.zoneLabels[zone]}
                  </span>
                </span>
                <span className="text-right text-[var(--text-2)]">{paceLabel}</span>
                <span className="text-right text-[var(--text-2)]">{bpmRangeLabel(min, max)}</span>
                <span className="text-right font-semibold text-foreground">{zoneTimeLabel(seconds)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
