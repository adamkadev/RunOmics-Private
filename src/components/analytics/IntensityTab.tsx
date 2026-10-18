'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { formatDate, formatKm } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { zoneColor, type SessionZone } from '@/lib/colors'
import { t } from '@/i18n'
import { AxisLabels, BoldSentence, Card, CardHead, ChartScrub, EmptyWeek, Headline, Legend, LegendItem, THIS_WEEK_BORDER } from './AnalyticsKit'
import { easyHardView, qualityView, zonesView, type PlanWeekInput, type QualityDot, type WeekRow } from './analyticsView'
import { weekLabels } from './VolumeTab'

const bare = (iso: string) => formatDate(iso, { style: 'bare', year: 'never' })
const hours = (sec: number) => formatKm(sec / 3600, 1)

/** Heart-rate zones are categories: the one zone scale, Z1 to Z5. */
const ZONE_COLOR = ([1, 2, 3, 4, 5] as SessionZone[]).map(zoneColor)

/** The split's 80/20 target, marked on the bar. */
const EASY_TARGET_PCT = 80

function EasyHardCard({ rows }: { rows: WeekRow[] }) {
  const s = t.analytics.cards.easyHard
  const view = easyHardView(rows)
  if (!view) return null
  const status = view.status === 'inRange' ? s.inRange : view.status === 'tooModerate' ? s.tooModerate : s.tooHard
  const parts = [
    { label: s.easy, sec: view.easySec, pct: view.easyPct, color: ZONE_COLOR[1]! },
    { label: s.moderate, sec: view.moderateSec, pct: view.moderatePct, color: ZONE_COLOR[2]! },
    { label: s.hard, sec: view.hardSec, pct: view.hardPct, color: ZONE_COLOR[3]! },
  ]
  const shown = parts.filter((p) => p.sec > 0)
  return (
    <Card className="gap-3.5" testId="easy-hard-card">
      <CardHead title={s.title} caption={s.caption} about={s.about} />
      {/* In range is good news; off the 80/20 target a caution. */}
      <Headline value={`${view.easyPct} / ${100 - view.easyPct}`} note={status} noteStyle={{ color: view.status === 'inRange' ? 'var(--pos)' : 'var(--warn)' }} />
      <div className="relative flex h-3 gap-[3px]" data-testid="easy-hard-bar">
        {shown.map((p) => (
          <div key={p.label} className="rounded-full" style={{ flex: p.sec, background: p.color }} />
        ))}
        <div className="absolute -inset-y-[5px] w-0.5 -translate-x-1/2 rounded-[1px] bg-foreground" style={{ left: `${EASY_TARGET_PCT}%` }} aria-hidden data-testid="easy-target" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {parts.map((p) => (
          <span key={p.label} className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span aria-hidden className="size-[7px] shrink-0 rounded-[2px]" style={{ background: p.color }} />
              {p.label}
            </span>
            <b className="text-[15px] font-semibold text-foreground">{s.part(hours(p.sec), p.pct)}</b>
          </span>
        ))}
      </div>
    </Card>
  )
}

/**
 * The zones' key, a figure under each (design review, Oct 2026): in a stacked
 * week Z3 and Z4 read as one colour, so each zone is named with its hours -
 * the window's, or the held week's while a finger is on the chart - and
 * every segment can be read in words, not by its colour alone.
 */
function ZoneKey({ zoneHours, held }: { zoneHours: number[]; held: boolean }) {
  return (
    <div className="grid grid-cols-5 gap-2" data-testid="zone-key" data-held={held || undefined}>
      {ZONE_COLOR.map((color, z) => (
        <span key={z} className="flex min-w-0 flex-col gap-0.5 text-xs text-muted-foreground" data-testid="zone-key-item">
          <LegendItem swatch="square" color={color}>
            {t.trainingZones.zoneNumber(z + 1)}
          </LegendItem>
          {/* A decimal under 100 h and none above, as distances: a year's Z2 fits its fifth of a phone. */}
          <b className="whitespace-nowrap text-[13px] font-semibold tabular-nums text-foreground">
            {t.analytics.cards.period.hours(formatKm(zoneHours[z]!, zoneHours[z]! >= 100 ? 0 : 1))}
          </b>
        </span>
      ))}
    </div>
  )
}

function ZonesCard({ rows, live, onShift }: { rows: WeekRow[]; live: boolean; onShift: (step: 1 | -1) => void }) {
  const s = t.analytics.cards.zones
  const [held, setHeld] = useState<number | null>(null)
  const view = zonesView(rows)
  if (!view) return null
  const H = 130
  const range = view.hard ? (view.hard.lo === view.hard.hi ? `${view.hard.hi}` : `${view.hard.lo}–${view.hard.hi}`) : null
  const narrow = view.hard !== null && view.hard.hi - view.hard.lo <= 15
  return (
    <Card testId="zones-card">
      <CardHead title={s.title} caption={s.caption} about={s.about} />
      {range && (
        // Built from the weeks: a dip and a return reads as such, and the
        // window's hours (moved here from the range line) close it.
        <BoldSentence
          parts={(narrow ? s.stayed : s.ranged)(
            range,
            `${view.total === 'recovered' ? s.recovered(bare(view.recoveredAfter!)) : s.total[view.total]!}${s.hours(formatKm(view.totalHours))}`,
          )}
        />
      )}
      <ChartScrub
        count={rows.length}
        onShift={onShift}
        onActive={setHeld}
        readout={(i) => `${t.analytics.cards.scrubWeek(bare(rows[i]!.week))} · ${formatKm(view.weeks[i]!.hours.reduce((a, b) => a + b, 0), 1)} h`}
      >
        <div className="grid items-end" style={{ height: H, gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))`, gap: rows.length > 20 ? 2 : 6 }} data-testid="zone-bars">
          {view.weeks.map((week, i) => {
            const total = week.hours.reduce((sum, h) => sum + h, 0)
            const current = week.current && live
            return (
              <div key={rows[i]!.week} className="flex flex-col justify-end" style={{ height: H }}>
                {total > 0 ? (
                  // Zone colours at full strength in every week, never faded.
                  // The week under way takes the one "this week" mark, the
                  // dashed accent outline, around its stack (v4.17).
                  <div
                    data-current={current ? '' : undefined}
                    className="flex flex-col-reverse gap-px rounded-[3px]"
                    style={current ? { outline: THIS_WEEK_BORDER, outlineOffset: 2 } : undefined}
                  >
                    {week.hours.map((h, z) =>
                      h > 0 ? <div key={z} className="rounded-[2px]" style={{ height: Math.max(1, (h / view.yMax) * H - 1), background: ZONE_COLOR[z] }} /> : null,
                    )}
                  </div>
                ) : (
                  <EmptyWeek />
                )}
              </div>
            )
          })}
        </div>
      </ChartScrub>
      <div className="flex flex-col gap-2.5">
        <AxisLabels labels={weekLabels(rows.map((r) => r.week), live)} />
        <ZoneKey zoneHours={held !== null && view.weeks[held] ? view.weeks[held]!.hours : view.zoneHours} held={held !== null} />
      </div>
    </Card>
  )
}

/**
 * Threshold sessions a Z4 circle, intervals a Z5 diamond (v4.17.2) - two
 * neighbouring zones as two dots of one size read alike - and a planned one
 * not run a dashed ring. 12 px on a phone, 10 px from sm up; the diamond a
 * square turned 45°, 9 px from sm up. Each sits in a box the diamond's
 * diagonal fits, so a column of them never touches.
 */
const DOT_SHAPE: Record<QualityDot, { className: string; style: React.CSSProperties }> = {
  threshold: { className: 'size-3 rounded-full sm:size-2.5', style: { background: 'var(--zone-4)' } },
  intervals: { className: 'size-2.5 rotate-45 sm:size-[9px]', style: { background: 'var(--zone-5)' } },
  missed: { className: 'box-border size-3 rounded-full sm:size-2.5', style: { border: '1.5px dashed var(--muted-foreground)' } },
}

/** Under this share of what the plan asks, the average is a caution. */
const QUALITY_SHORT = 0.9

/** A dot's slot in a week's column, with the gap under it, in px: the plan's line sits on these. */
const DOT_SLOT_PX = 16

function QualityCard({ rows, live, plan }: { rows: WeekRow[]; live: boolean; plan: PlanWeekInput[] }) {
  const s = t.analytics.cards.quality
  const view = qualityView(rows, plan)
  if (!view || view.avg === null) return null
  const tone = view.planAsks === null ? undefined : view.avg >= view.planAsks * QUALITY_SHORT ? 'var(--pos)' : 'var(--warn)'
  return (
    <Card testId="quality-card">
      <CardHead title={s.title} caption={s.caption} about={s.about} />
      <Headline
        value={formatKm(view.avg, 1)}
        note={`${s.avg}${view.planAsks !== null ? s.planAsks(formatKm(view.planAsks, Number.isInteger(view.planAsks) ? 0 : 1)) : s.perWeek}`}
        noteStyle={tone ? { color: tone } : undefined}
      />
      <ChartScrub
        count={rows.length}
        readout={(i) => s.readout(t.analytics.cards.scrubWeek(bare(rows[i]!.week)), view.weeks[i]!.filter((d) => d !== 'missed').length, view.planned[i] ?? null)}
      >
        <div className="relative grid" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))`, gap: rows.length > 20 ? 2 : 6 }} data-testid="quality-dots">
          {/* What the plan asks a week, as a dashed line over that many dots,
              like the other weekly charts' plan marks (screen audit, Oct 2026). */}
          {view.planAsks !== null && view.planAsks > 0 && (
            <div
              aria-hidden
              data-testid="quality-plan-line"
              className="pointer-events-none absolute inset-x-0 z-[1] border-t border-dashed border-foreground"
              style={{ bottom: Math.min(4, view.planAsks) * DOT_SLOT_PX }}
            />
          )}
          {view.weeks.map((dots, i) => (
            <div key={rows[i]!.week} className="flex h-16 flex-col-reverse items-center gap-0.5">
              {dots.map((dot, j) => (
                <span key={j} className="flex size-3.5 shrink-0 items-center justify-center">
                  <span data-dot={dot} className={cn('block shrink-0', DOT_SHAPE[dot].className)} style={DOT_SHAPE[dot].style} />
                </span>
              ))}
            </div>
          ))}
        </div>
      </ChartScrub>
      {/* The weeks under the dots, as every other weekly chart has them: empty
          weeks read as gaps without them (screen audit, Oct 2026). */}
      <AxisLabels labels={weekLabels(rows.map((r) => r.week), live)} />
      <Legend className="gap-x-4">
        <LegendItem swatch="dot" color="var(--zone-4)">{s.threshold}</LegendItem>
        <LegendItem swatch="diamond" color="var(--zone-5)">{s.intervals}</LegendItem>
        {view.weeks.some((w) => w.includes('missed')) && <LegendItem swatch="dashCircle" color="var(--muted-foreground)">{s.missed}</LegendItem>}
        {view.planAsks !== null && view.planAsks > 0 && <LegendItem swatch="dash" color="var(--foreground)">{t.analytics.cards.weekly.plan}</LegendItem>}
      </Legend>
    </Card>
  )
}

export interface IntensityTabProps {
  rows: WeekRow[]
  live: boolean
  onShift: (step: 1 | -1) => void
  plan: PlanWeekInput[]
}

export function IntensityTab({ rows, live, onShift, plan }: IntensityTabProps) {
  const s = t.analytics.cards.zoneRanges
  return (
    <div className="flex flex-col gap-3.5">
      <EasyHardCard rows={rows} />
      <ZonesCard rows={rows} live={live} onShift={onShift} />
      <QualityCard rows={rows} live={live} plan={plan} />
      {/* A way out to the zone table on Athlete & zones, as a card row. */}
      <Link
        href="/athlete"
        className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-5 py-4 transition-colors hover:bg-[var(--surface-2)]"
        data-testid="zone-ranges-link"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-semibold leading-snug text-foreground">{s.title}</span>
          <span className="truncate text-xs text-muted-foreground">{s.subtitle}</span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </div>
  )
}
