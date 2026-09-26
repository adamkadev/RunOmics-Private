'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { formatDate, formatKm } from '@/lib/formatters'
import { t } from '@/i18n'
import { AxisLabels, BoldSentence, Card, CardHead, ChartScrub, Headline, Legend, LegendItem } from './AnalyticsKit'
import { easyHardView, qualityView, zonesView, type PlanWeekInput, type QualityDot, type WeekRow } from './analyticsView'
import { weekLabels } from './VolumeTab'

const bare = (iso: string) => formatDate(iso, { style: 'bare', year: 'never' })
const hours = (sec: number) => formatKm(sec / 3600, 1)

const ZONE_COLOR = ['var(--zone-1)', 'var(--zone-2)', 'var(--zone-3)', 'var(--zone-4)', 'var(--zone-5)']

/** The split's 80/20 target, ticked on the bar. */
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
    <Card testId="easy-hard-card">
      <CardHead title={s.title} caption={s.caption} about={s.about} />
      <Headline
        value={`${view.easyPct} / ${100 - view.easyPct}`}
        note={status}
        noteStyle={view.status === 'inRange' ? undefined : { color: 'var(--tone-caution)', fontWeight: 600 }}
      />
      <div className="relative flex h-4 gap-0.5" data-testid="easy-hard-bar">
        {shown.map((p, i) => (
          <div
            key={p.label}
            style={{
              flex: p.sec,
              background: p.color,
              borderRadius: shown.length === 1 ? 5 : i === 0 ? '5px 0 0 5px' : i === shown.length - 1 ? '0 5px 5px 0' : 0,
            }}
          />
        ))}
        <div className="absolute -inset-y-[5px] w-0.5 rounded-[1px] bg-foreground" style={{ left: `${EASY_TARGET_PCT}%` }} aria-hidden />
      </div>
      <div className="grid grid-cols-3 gap-2 text-[12px] text-muted-foreground">
        {parts.map((p) => (
          <span key={p.label} className="flex flex-col gap-[3px]">
            <LegendItem swatch="dot" color={p.color}>{p.label}</LegendItem>
            <b className="text-[14px] tabular-nums text-foreground">{s.part(hours(p.sec), p.pct)}</b>
          </span>
        ))}
      </div>
    </Card>
  )
}

function ZonesCard({ rows, live, onShift }: { rows: WeekRow[]; live: boolean; onShift: (step: 1 | -1) => void }) {
  const s = t.analytics.cards.zones
  const view = zonesView(rows)
  if (!view) return null
  const H = 120
  const range = view.hard ? (view.hard.lo === view.hard.hi ? `${view.hard.hi}` : `${view.hard.lo}–${view.hard.hi}`) : null
  const narrow = view.hard !== null && view.hard.hi - view.hard.lo <= 15
  return (
    <Card testId="zones-card">
      <CardHead title={s.title} caption={s.caption} about={s.about} />
      {range && <BoldSentence parts={(narrow ? s.stayed : s.ranged)(range, s.total[view.total]!)} />}
      <ChartScrub
        count={rows.length}
        onShift={onShift}
        readout={(i) => `${t.analytics.cards.scrubWeek(bare(rows[i]!.week))} · ${formatKm(view.weeks[i]!.hours.reduce((a, b) => a + b, 0), 1)} h`}
      >
        <div className="grid items-end" style={{ height: H, gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))`, gap: rows.length > 20 ? 2 : 5 }} data-testid="zone-bars">
          {view.weeks.map((week, i) => (
            <div key={rows[i]!.week} className="flex flex-col-reverse gap-px" style={{ height: H, opacity: week.current && live ? 0.55 : 1 }}>
              {week.hours.map((h, z) => (
                <div
                  key={z}
                  style={{
                    height: Math.max(0, (h / view.yMax) * H - (h ? 1 : 0)),
                    background: ZONE_COLOR[z],
                    borderRadius: z === 0 ? '0 0 3px 3px' : 1,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </ChartScrub>
      <AxisLabels labels={weekLabels(rows.map((r) => r.week), live)} />
      <Legend className="gap-x-3">
        {ZONE_COLOR.map((color, z) => (
          <LegendItem key={z} swatch="square" color={color}>
            Z{z + 1}
          </LegendItem>
        ))}
      </Legend>
    </Card>
  )
}

const DOT_STYLE: Record<QualityDot, React.CSSProperties> = {
  threshold: { background: 'var(--zone-4)' },
  intervals: { background: 'var(--zone-5)' },
  missed: { border: '1.5px dashed var(--muted-foreground)' },
}

function QualityCard({ rows, plan }: { rows: WeekRow[]; plan: PlanWeekInput[] }) {
  const s = t.analytics.cards.quality
  const view = qualityView(rows, plan)
  if (!view || view.avg === null) return null
  return (
    <Card testId="quality-card">
      <CardHead title={s.title} caption={s.caption} about={s.about} />
      <Headline size={24} value={formatKm(view.avg, 1)} note={`${s.avg}${view.planAsks !== null ? s.planAsks(view.planAsks) : s.perWeek}`} />
      <div className="grid gap-[5px]" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }} data-testid="quality-dots">
        {view.weeks.map((dots, i) => (
          <div key={rows[i]!.week} className="flex flex-col items-center gap-1">
            {dots.map((dot, j) => (
              <span key={j} data-dot={dot} className="box-border block size-2.5 rounded-full" style={DOT_STYLE[dot]} />
            ))}
          </div>
        ))}
      </div>
      <Legend>
        <LegendItem swatch="dot" color="var(--zone-4)">{s.threshold}</LegendItem>
        <LegendItem swatch="dot" color="var(--zone-5)">{s.intervals}</LegendItem>
        {view.weeks.some((w) => w.includes('missed')) && <LegendItem swatch="dashRing" color="var(--muted-foreground)">{s.missed}</LegendItem>}
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
    <div className="flex flex-col gap-3">
      <EasyHardCard rows={rows} />
      <ZonesCard rows={rows} live={live} onShift={onShift} />
      <QualityCard rows={rows} plan={plan} />
      {/* An outline, no fill: a way out to the zone table, not data. */}
      <Link href="/athlete" className="flex items-center justify-between gap-3 rounded-card border border-[var(--divider)] px-4 py-3.5" data-testid="zone-ranges-link">
        <span className="flex min-w-0 flex-col gap-[3px]">
          <span className="font-display text-[15px] font-semibold leading-[1.2] text-foreground">{s.title}</span>
          <span className="truncate text-[12px] text-muted-foreground">{s.subtitle}</span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </div>
  )
}
