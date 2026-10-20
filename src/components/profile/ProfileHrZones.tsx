'use client'

import { useState } from 'react'
import { cardClass } from '@/components/ui/Card'
import { SegmentedTabs, useSegmentedTabs } from '@/components/ui/SegmentedTabs'
import type { AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import type { ZoneShare } from '@/application/usecases/GetAnalyticsData'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import { intensityMix } from '@/domain/training/intensityMix'
import { formatClock as fmt, formatPercent } from '@/lib/formatters'
import { t } from '@/i18n'

type Bounds = [number, number, number, number, number]
type View = 'week' | 'recent'

const VIEWS = ['week', 'recent'] as const
const HR_PERCENTS = [0.65, 0.8, 0.89, 0.95, 1.0]

/**
 * Zone, HR, share and time: one grid for the header and every row (App Fixes
 * 1e). The share moved out from under the bar, where a zone of 1 % had no
 * room to print it; each zone's pace range reads under its name, so the
 * table keeps it without a fifth column.
 */
const ROW_GRID = 'grid grid-cols-[minmax(0,1fr)_3.75rem_2.5rem_3.5rem] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_90px_60px_70px] sm:gap-3'

/** No zone with time in it draws narrower than this share of the bar (3.0 1j), so 1 % still shows. */
const MIN_SEGMENT_PCT = 3

/** "22 min" under an hour, "8 h 37" over: the table's time column (v4.17). */
export function zoneTimeLabel(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  return minutes < 60 ? `${minutes} ${t.units.min}` : `${Math.floor(minutes / 60)} ${t.units.hour} ${String(minutes % 60).padStart(2, '0')}`
}

/** The window's time, "19 h 11 min", or "42 min" under the hour. */
export function windowTotalLabel(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  const h = Math.floor(minutes / 60)
  return h > 0 ? `${h} ${t.units.hour} ${minutes % 60} ${t.units.min}` : `${minutes} ${t.units.min}`
}

export interface ZoneSegment {
  zone: number
  /** Its share of the window, for the label under it: at least 1 %, never a 0 % beside a segment. */
  pct: number
  /** Its width: the share, floored at MIN_SEGMENT_PCT. */
  flex: number
}

/** Z1 to Z5 as the bar draws them: the zones with time, each as wide as its share (3.0 1j). */
export function zoneSegments(zoneTime: ZoneShare[]): ZoneSegment[] {
  const total = zoneTime.reduce((sum, z) => sum + z.seconds, 0)
  if (total <= 0) return []
  const byZone = new Map(zoneTime.map((z) => [z.zone, z.seconds]))
  return [1, 2, 3, 4, 5]
    .map((zone) => ({ zone, share: ((byZone.get(zone) ?? 0) / total) * 100 }))
    .filter((z) => z.share > 0)
    .map(({ zone, share }) => ({ zone, pct: Math.max(1, Math.round(share)), flex: Math.max(MIN_SEGMENT_PCT, share) }))
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
 * One zone table under one Week / 4 weeks toggle (C2, v4.4; 3.0 1j), four
 * weeks first: the hard share and the verdict Analytics gives the same time
 * as the headline, the window's total and the 80/20 target under it, one bar
 * of Z1-Z5 with each share under its segment, then zone, pace, HR and time
 * as tabular columns.
 */
export function ProfileHrZones({ athlete, weeklyZoneTime, recentZoneTime, paceZones }: Props) {
  const s = t.profile.trainingZones
  const [view, setView] = useState<View>('recent')
  const tabs = useSegmentedTabs<View>({ ids: VIEWS, value: view, onChange: setView })
  const lthr = athlete.lthrBpm
  const bounds = athlete.hrZoneBoundsBpm ?? (lthr !== undefined ? defaultBounds(lthr) : null)

  if (bounds === null) return null

  const zoneTime = view === 'week' ? weeklyZoneTime : recentZoneTime

  const paceByHrZone = new Map((paceZones?.zones ?? []).map((zone) => [zone.hrZone, zone]))
  const easyZone = paceByHrZone.get(2)
  const warmupPaceSecPerKm = easyZone ? easyZone.paceMaxSecPerKm + 1 : null

  // Z1 at the top, as the bar above reads left to right and every zone list
  // in the app runs (design review, Oct 2026: one order everywhere).
  const zones = [
    { zone: 1, min: bounds[0], max: bounds[1] - 1, pace: undefined },
    { zone: 2, min: bounds[1], max: bounds[2] - 1, pace: paceByHrZone.get(2) },
    { zone: 3, min: bounds[2], max: bounds[3] - 1, pace: paceByHrZone.get(3) },
    { zone: 4, min: bounds[3], max: bounds[4] - 1, pace: paceByHrZone.get(4) },
    { zone: 5, min: bounds[4], max: null as number | null, pace: paceByHrZone.get(5) },
  ]

  const timeByZone = new Map(zoneTime.map((z) => [z.zone, z]))
  const windowTotal = totalSeconds(zoneTime)

  // One split and one verdict with Analytics > Intensity (design review, Oct
  // 2026): this card read "Hard 7 %" in amber against its own 10-15 % target
  // while Intensity read the same time "In range".
  const mix = intensityMix(Object.fromEntries(zoneTime.map((z) => [z.zone, z.seconds])))
  const segments = zoneSegments(zoneTime)

  const emptyLine = view === 'week' ? s.noSessionsThisWeek : s.noSessionsRecent

  // The week under way is not a week's split yet: no verdict, no colour.
  const verdict = mix === null ? null : view === 'week' ? s.soFar : s.verdict[mix.status]
  const verdictTone = mix === null || view === 'week' ? 'text-muted-foreground' : mix.status === 'inRange' ? 'text-[var(--pos)]' : 'text-[var(--warn)]'

  return (
    <section className={cardClass({ className: 'flex flex-col gap-3.5 rounded-[18px]' })}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-foreground">{s.title}</h2>
        <SegmentedTabs
          tabs={tabs}
          label={s.viewLabel}
          size="sm"
          items={[
            { id: 'week', label: s.week, ariaLabel: s.weekSpoken },
            { id: 'recent', label: s.fourWeeks, ariaLabel: s.fourWeeksSpoken },
          ]}
        />
      </div>

      <div {...tabs.panelProps} className="flex flex-col gap-3.5 outline-none">
        {windowTotal === 0 || mix === null ? (
          <p className="text-[13px] text-muted-foreground">{emptyLine}</p>
        ) : (
          <>
            <div>
              <p className="text-[19px] font-semibold leading-tight text-foreground" data-testid="zone-hard-share">
                {s.hard(formatPercent(mix.hardPct))} · <span className={verdictTone} data-testid="zone-verdict">{verdict}</span>
              </p>
              <p className="mt-1 text-[12.5px] text-muted-foreground" data-testid="zone-total">
                {s.totalLine(windowTotalLabel(windowTotal))}
              </p>
            </div>
            {/* Z1 to Z5 as one bar, 3 pt apart, each as wide as its share and
                no narrower than 3 %. The shares are read in the table under
                it, where a 1 % zone has room for its number (App Fixes 1e). */}
            <div className="flex gap-[3px]" data-testid="zone-stack">
              {segments.map((z) => (
                <div key={z.zone} data-zone={z.zone} className="flex min-w-0 flex-col" style={{ flexGrow: z.flex, flexBasis: 0 }}>
                  <span className="h-2 w-full rounded-full" style={{ background: `var(--zone-${z.zone})` }} />
                </div>
              ))}
            </div>
          </>
        )}

        <div>
          <div
            className={`${ROW_GRID} pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground`}
            data-testid="zone-columns"
          >
            <span>{s.columnZone}</span>
            <span className="whitespace-nowrap text-right">
              <span className="sm:hidden">{s.columnHrShort}</span>
              <span className="hidden sm:inline">{s.columnHr}</span>
            </span>
            <span className="text-right">{s.columnShare}</span>
            <span className="text-right">{s.columnTime}</span>
          </div>

          {zones.map(({ zone, min, max, pace }) => {
            const seconds = timeByZone.get(zone)?.seconds ?? 0
            const share = segments.find((z) => z.zone === zone)?.pct ?? null
            const paceLabel =
              zone === 1
                ? warmupPaceSecPerKm !== null
                  ? `≥ ${fmt(warmupPaceSecPerKm)}`
                  : '-'
                : pace
                  ? `${fmt(pace.paceMinSecPerKm)}–${fmt(pace.paceMaxSecPerKm)}`
                  : '-'

            return (
              <div key={zone} className={`${ROW_GRID} min-h-[38px] border-t border-border py-1.5`} data-testid={`zone-row-${zone}`}>
                <span className="flex min-w-0 items-center gap-2 text-[13px] text-foreground">
                  <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ background: `var(--zone-${zone})` }} />
                  {/* Wraps on a narrow phone rather than "Z4 Thres…" (v4.17.2). */}
                  <span className="flex min-w-0 flex-col">
                    <span className="min-w-0">
                      <b className="font-semibold">{t.trainingZones.zoneNumber(zone)}</b> {t.zoneLabels[zone]}
                    </span>
                    {paceLabel !== '-' && (
                      <span className="text-[11px] tabular-nums text-muted-foreground" data-testid="zone-pace">
                        {paceLabel} {t.units.perKm}
                      </span>
                    )}
                  </span>
                </span>
                <span className="text-right text-xs tabular-nums text-[var(--text-2)]">{bpmRangeLabel(min, max)}</span>
                <span className="text-right text-xs tabular-nums text-[var(--text-2)]" data-testid="zone-pct">
                  {share === null ? '-' : formatPercent(share)}
                </span>
                <span className="text-right text-xs font-semibold tabular-nums text-foreground">{zoneTimeLabel(seconds)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
