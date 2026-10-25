'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { formatDate, formatKm } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { zoneColor, type SessionZone } from '@/lib/colors'
import { t } from '@/i18n'
import { AxisLabels, Card, CardHead, ChartScrub, EmptyWeek, Headline, Legend, LegendItem, Sentence, THIS_WEEK_BORDER } from './AnalyticsKit'
import { easyHardView, qualityView, smooth, zonesView, type PlanWeekInput, type QualityDot, type WeekRow } from './analyticsView'
import { heartRateView } from './trendView'
import { weekLabels } from './VolumeTab'

const bare = (iso: string) => formatDate(iso, { style: 'bare', year: 'never' })
const hours = (sec: number) => formatKm(sec / 3600, 1)

/** Heart-rate zones are categories: the one zone scale, Z1 to Z5. */
const ZONE_COLOR = ([1, 2, 3, 4, 5] as SessionZone[]).map(zoneColor)

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

/** In a stacked week Z3 and Z4 read as one colour, so each zone is named with its hours. */
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
      {/* "36 h in all. Weekly time dropped mid-August, then climbed back from Aug 31. Hard time stayed under 25 min a week." */}
      <p className="text-[12.5px] leading-[1.45] text-[var(--text-2)] text-pretty" data-testid="zones-summary">
        {s.summaryHours(formatKm(view.totalHours))}
        {view.total === 'recovered' && view.recoveredAfter && view.backFrom
          ? s.summaryRecovered(
              s.partOfMonth(Number(view.recoveredAfter.slice(8, 10)), new Date(`${view.recoveredAfter}T12:00:00Z`).toLocaleDateString(t.locale, { month: 'long', timeZone: 'UTC' })),
              bare(view.backFrom),
            )
          : (s.summaryTotal[view.total] ?? '')}
        {view.hard && (narrow ? s.summaryHardUnder(Math.ceil((view.hard.hi + 1) / 5) * 5) : s.summaryHardRange(range!))}
      </p>
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
                  // Zone colours at full strength in every week, never faded: the week under way is marked by its outline.
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

/** Each week in its slot, as the bars beside it: a missing week is stepped over. */
function slotPath(values: (number | null)[], lo: number, hi: number, w: number, h: number): string {
  let d = ''
  values.forEach((v, i) => {
    if (v === null) return
    d += `${d ? 'L' : 'M'}${(((i + 0.5) / values.length) * w).toFixed(1)},${(h - ((v - lo) / (hi - lo)) * h).toFixed(1)}`
  })
  return d
}

const BPM_STEP = 5
const FELT_H = 20
const FELT_FILL = 'color-mix(in srgb, var(--band) 45%, transparent)'

function HeartRateCard({ rows, live, onShift }: { rows: WeekRow[]; live: boolean; onShift: (step: 1 | -1) => void }) {
  const s = t.analytics.charts.hrTrend
  const names = t.analytics.charts.paceTrend
  const view = heartRateView(rows)
  if (!view) return null
  const W = 1000
  const H = 96
  // The lines as drawn, so the scale fits what is on the chart; the readout keeps each week's own figure.
  const easyLine = smooth(view.easy)
  const hardLine = smooth(view.hard)
  const bpm = [...easyLine, ...hardLine].filter((v): v is number => v !== null)
  const lo = Math.floor((Math.min(...bpm) - 2) / BPM_STEP) * BPM_STEP
  // An even number of steps, so the middle line is a round figure too.
  const hi = lo + Math.max(2, Math.ceil((Math.max(...bpm) + 2 - lo) / (2 * BPM_STEP)) * 2) * BPM_STEP
  const ticks = [lo, (lo + hi) / 2, hi]
  const felt = view.felt.filter((v): v is number => v !== null)
  const feltLo = Math.min(...felt)
  const feltHi = Math.max(...felt)
  // From 0 °C, so a bar's height reads as warmth, not as its place between the window's extremes.
  const feltBase = Math.min(0, feltLo)
  const reading = view.trend === 'flat' ? s.reading.flat : s.reading[view.trend](Math.round(Math.abs(view.easyShift!.delta!)))
  const easyNow = view.easyShift ? Math.round(view.easyShift.now) : null
  return (
    <Card testId="heart-rate-card">
      <CardHead title={s.title} caption={t.units.bpm} about={s.footnote} />
      <Sentence testId="heart-rate-sentence">{reading}</Sentence>
      <div className="flex gap-2 py-1.5">
        <div className="relative w-8 shrink-0 text-[11px] leading-none text-muted-foreground" style={{ height: H }} aria-hidden>
          {ticks.map((v) => (
            <span key={v} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - ((v - lo) / (hi - lo)) * 100}%` }}>
              {v}
            </span>
          ))}
        </div>
        <ChartScrub
          className="min-w-0 flex-1"
          count={rows.length}
          onShift={onShift}
          readout={(i) =>
            [
              t.analytics.cards.scrubWeek(bare(rows[i]!.week)),
              view.easy[i] != null && `${names.easy} ${Math.round(view.easy[i]!)}`,
              view.hard[i] != null && `${names.workout} ${Math.round(view.hard[i]!)}`,
              view.felt[i] != null && t.analytics.charts.efficiency.felt(Math.round(view.felt[i]!)),
            ]
              .filter(Boolean)
              .join(' · ')
          }
        >
          <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block overflow-visible" aria-hidden data-testid="heart-rate-lines">
            {ticks.map((v) => (
              <line key={v} x1="0" x2={W} y1={H - ((v - lo) / (hi - lo)) * H} y2={H - ((v - lo) / (hi - lo)) * H} stroke="var(--line-2)" vectorEffect="non-scaling-stroke" />
            ))}
            <path d={slotPath(hardLine, lo, hi, W, H)} fill="none" stroke="var(--zone-4)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <path d={slotPath(easyLine, lo, hi, W, H)} fill="none" stroke="var(--zone-2)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
          {felt.length > 0 && (
            // Under the lines, on its own scale: the warm weeks a higher heart rate may owe to the weather.
            <div className="mt-2 grid items-end" style={{ height: FELT_H, gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))`, gap: rows.length > 20 ? 1 : 4 }} data-testid="felt-strip">
              {view.felt.map((c, i) => (
                <span key={rows[i]!.week} className="rounded-[2px]" style={{ height: c === null ? 0 : Math.max(2, ((c - feltBase) / Math.max(1, feltHi - feltBase)) * FELT_H), background: FELT_FILL }} />
              ))}
            </div>
          )}
        </ChartScrub>
      </div>
      <AxisLabels className="ml-10" labels={weekLabels(rows.map((r) => r.week), live)} />
      <Legend className="gap-x-4">
        {easyNow !== null && (
          <LegendItem swatch="dot" color="var(--zone-2)">
            {names.easy} <b className="font-semibold text-foreground">{easyNow}</b>
          </LegendItem>
        )}
        {view.hardNow !== null && (
          <LegendItem swatch="dot" color="var(--zone-4)">
            {names.workout} <b className="font-semibold text-foreground">{Math.round(view.hardNow)}</b>
          </LegendItem>
        )}
        {felt.length > 0 && (
          <LegendItem swatch="square" color={FELT_FILL}>
            {s.felt(`${Math.round(feltLo)}–${Math.round(feltHi)}${t.units.celsius}`)}
          </LegendItem>
        )}
      </Legend>
    </Card>
  )
}

function weekSquare(dots: QualityDot[]): { state: 'done' | 'missed' | 'planned' | 'none'; count: number; style: React.CSSProperties } {
  const done = dots.filter((d) => d === 'done').length
  if (done > 0) return { state: 'done', count: done, style: { background: 'var(--zone-4)' } }
  if (dots.includes('missed')) return { state: 'missed', count: 0, style: { border: '1.5px dashed var(--warn)' } }
  if (dots.includes('planned')) return { state: 'planned', count: 0, style: { border: '1.5px dashed var(--zone-4)' } }
  return { state: 'none', count: 0, style: { background: 'var(--track)' } }
}

function QualityCard({ rows, live, plan }: { rows: WeekRow[]; live: boolean; plan: PlanWeekInput[] }) {
  const s = t.analytics.cards.quality
  const view = qualityView(rows, plan)
  if (!view || view.avg === null) return null
  const { totals } = view
  // "of 10 planned · 1 extra", beside the done count.
  const note = [totals.planned !== null ? s.ofPlanned(totals.planned) : null, totals.extra > 0 && totals.planned !== null ? s.extra(totals.extra) : null]
    .filter(Boolean)
    .join(' · ')
  const squares = view.weeks.map(weekSquare)
  return (
    <Card testId="quality-card">
      <CardHead
        title={s.title}
        caption={
          totals.missed > 0 ? (
            <span style={{ color: 'var(--warn)' }} data-testid="quality-missed">{s.missedCount(totals.missed)}</span>
          ) : (
            s.caption
          )
        }
        about={s.about}
      />
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1" data-testid="quality-done">
        <span className="text-[22px] font-bold tabular-nums text-foreground">
          {totals.done} <span className="text-[13px] font-normal text-muted-foreground">{s.doneNoPlan}</span>
        </span>
        {note && <span className="text-[12.5px] text-[var(--text-2)]">{note}</span>}
      </div>
      <ChartScrub
        count={rows.length}
        readout={(i) => s.readout(t.analytics.cards.scrubWeek(bare(rows[i]!.week)), view.weeks[i]!.filter((d) => d === 'done').length, view.planned[i] ?? null)}
      >
        <div className="grid" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))`, gap: rows.length > 20 ? 2 : 5 }} data-testid="quality-squares">
          {squares.map((sq, i) => (
            <span
              key={rows[i]!.week}
              data-state={sq.state}
              className={cn('box-border flex h-[22px] items-center justify-center text-[11px] font-semibold text-accent-foreground', rows.length > 20 ? 'rounded-[3px]' : 'rounded-[6px]')}
              style={sq.style}
            >
              {sq.count > 1 && rows.length <= 20 ? sq.count : null}
            </span>
          ))}
        </div>
      </ChartScrub>
      <AxisLabels labels={weekLabels(rows.map((r) => r.week), live)} />
      <Legend className="gap-x-3">
        <LegendItem swatch="square" color="var(--zone-4)">{s.done}</LegendItem>
        {totals.missed > 0 && (
          <span className="inline-flex items-center gap-[5px]">
            <span aria-hidden className="box-border size-[9px] rounded-[3px] border border-dashed border-[var(--warn)]" />
            {s.missed}
          </span>
        )}
        {squares.some((sq) => sq.state === 'planned') && (
          <span className="inline-flex items-center gap-[5px]">
            <span aria-hidden className="box-border size-[9px] rounded-[3px] border border-dashed border-[var(--zone-4)]" />
            {s.plannedLegend}
          </span>
        )}
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
      <HeartRateCard rows={rows} live={live} onShift={onShift} />
      <QualityCard rows={rows} live={live} plan={plan} />
      <Link
        href="/athlete"
        className="flex items-center gap-3.5 content-card rounded-[24px] bg-card shadow-[var(--card-edge)] p-4 transition-transform duration-100 ease-out active:scale-[0.98]"
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
