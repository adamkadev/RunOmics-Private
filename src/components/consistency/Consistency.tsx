'use client'

import { useState } from 'react'
import { cardClass } from '@/components/ui/Card'
import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import { SegmentedTabs, useSegmentedTabs } from '@/components/ui/SegmentedTabs'
import { formatDate, formatDecimal, formatWeekdayLong } from '@/lib/formatters'
import { useUrlParam } from '@/lib/useUrlParam'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { CONSISTENCY_RANGES, DEFAULT_RANGE, parseRange, type ConsistencyRange, type ConsistencyView, type ConsistencyWeek } from './consistencyView'
import { WeekSheet } from './WeekSheet'

const CARD_TITLE = 'text-[15px] font-semibold text-foreground'
/** A weekday's accent, a step under the anchor's: the ramp's mid tint. */
export const ACCENT_DIM = 'color-mix(in srgb, var(--accent) var(--level-mid), transparent)'

/** 2024-01-01 was a Monday. */
function weekdayName(index: number): string {
  return formatWeekdayLong(`2024-01-0${index + 1}`)
}

function StreakCard({ view }: { view: ConsistencyView }) {
  const c = t.consistency
  const { runs, planned } = view.thisWeek
  const circles = Math.min(7, Math.max(view.target, runs))
  return (
    <section className={cardClass({ className: 'flex flex-col gap-3.5' })} data-testid="consistency-streak">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className={cn(EYEBROW_CLASS, 'text-accent-text')}>{c.streakEyebrow}</span>
          <p className="flex items-baseline gap-1.5">
            <span className="text-[44px] font-bold leading-[1.05] tracking-[-0.03em] tabular-nums text-foreground" data-testid="streak-weeks">
              {view.streakWeeks}
            </span>
            <span className="text-[17px] font-medium text-muted-foreground">{c.weeks(view.streakWeeks)}</span>
          </p>
          <span className="text-[12.5px] text-muted-foreground">{c.streakRule(view.target, view.bestStreakWeeks)}</span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 pt-0.5" data-testid="consistency-this-week">
          <span className="text-xs text-muted-foreground">{c.thisWeek}</span>
          <span className="flex gap-[5px]" role="img" aria-label={c.thisWeekLabel(runs, view.target)}>
            {Array.from({ length: circles }, (_, i) => (
              <span
                key={i}
                data-filled={i < runs || undefined}
                className={cn('box-border size-3.5 rounded-full', i < runs ? 'bg-accent' : 'border-[1.5px] border-dashed border-accent')}
              />
            ))}
          </span>
          <span className="text-xs text-foreground" aria-hidden>
            {c.thisWeekRuns(runs, view.target)}
            {planned > 0 && ` · ${c.planned(planned)}`}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 border-t border-border pt-3" data-testid="consistency-stats">
        <p className="flex flex-col gap-0.5">
          <span className="text-[17px] font-semibold tabular-nums text-foreground">
            {view.weeksOnTarget}
            <span className="font-medium text-subtle">/{view.weeksCounted}</span>
          </span>
          <span className="text-[11.5px] text-muted-foreground">{c.weeksOnTarget}</span>
        </p>
        <p className="flex flex-col gap-0.5">
          <span className="text-[17px] font-semibold tabular-nums text-foreground">{formatDecimal(view.runsPerWeek, 1)}</span>
          <span className="text-[11.5px] text-muted-foreground">{c.runsPerWeek}</span>
        </p>
        <p className="flex flex-col gap-0.5">
          <span className="text-[17px] font-semibold tabular-nums text-foreground">{view.runs}</span>
          <span className="text-[11.5px] text-muted-foreground">{c.runs(view.runs)}</span>
        </p>
      </div>
    </section>
  )
}

/** The chart's width in its own units: 27 columns of a 9-unit dot, 3 apart. */
const CHART_W = 324
/** Room around the dots for the tapped week's outline. */
const PAD = 4

/** `step` is the distance between columns, `pitch` between rows. */
export function dotGeometry(columns: number): { dot: number; step: number; pitch: number } {
  const dot = Math.min(9, CHART_W / Math.max(1, columns) - 2)
  const step = columns > 1 ? (CHART_W - dot) / (columns - 1) : 0
  return { dot, step, pitch: dot + dot / 3 }
}

function RunsPerWeek({ view, selected, onSelect }: { view: ConsistencyView; selected: string | null; onSelect: (week: string) => void }) {
  const c = t.consistency
  const { weeks, target } = view
  const { dot, step, pitch } = dotGeometry(weeks.length)
  const rows = Math.max(target + 1, ...weeks.map((week) => week.runs + week.planned))
  const height = rows * pitch - pitch + dot
  const gap = pitch - dot
  const x = (i: number) => i * step
  const y = (k: number) => height - k * pitch - dot
  const pct = (units: number) => `${((units + PAD) / (CHART_W + 2 * PAD)) * 100}%`
  const streak = weeks.flatMap((week, i) => (week.inStreak ? [i] : []))
  const short = (week: ConsistencyWeek) => formatDate(week.start, { style: 'bare', year: 'never' })
  // A row of its own under the runs: stacked on them, a session would read as a run toward the target.
  const withOthers = weeks.some((week) => week.others > 0)

  return (
    <section className={cardClass({ className: 'flex flex-col gap-2.5' })} data-testid="consistency-weeks">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={CARD_TITLE}>{c.perWeek}</h2>
        <span className="shrink-0 text-xs text-muted-foreground">{c.target(target)}</span>
      </div>
      <svg
        viewBox={`${-PAD} ${-PAD} ${CHART_W + 2 * PAD} ${height + 2 * PAD}`}
        className="block h-auto w-full overflow-visible"
        data-testid="runs-chart"
      >
        <line
          x1={-PAD}
          x2={CHART_W + PAD}
          y1={height - target * pitch + gap / 2}
          y2={height - target * pitch + gap / 2}
          stroke="var(--line-2)"
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
          data-testid="target-line"
        />
        {weeks.map((week, i) => {
          const fill = week.onTarget || week.current ? 'var(--accent)' : 'var(--band)'
          const open = () => onSelect(week.start)
          return (
            <g
              key={week.start}
              role="button"
              tabIndex={0}
              aria-label={week.others > 0 ? `${c.weekLabel(short(week), week.runs)}, ${t.crossTraining.count(week.others)}` : c.weekLabel(short(week), week.runs)}
              onClick={open}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                open()
              }}
              className="cursor-pointer outline-none [&:focus-visible>rect:first-child]:stroke-[var(--ring)]"
              data-testid="week-column"
              data-week={week.start}
              data-on-target={week.onTarget || undefined}
            >
              {/* The whole column is the target, not only its dots. */}
              <rect
                x={x(i) - Math.max(step - dot, 0) / 2 - 1}
                y={-PAD}
                width={Math.max(step, dot) + 2}
                height={height + 2 * PAD}
                rx={3}
                fill="transparent"
                stroke={selected === week.start ? 'var(--muted-foreground)' : 'transparent'}
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
                data-testid={selected === week.start ? 'week-selected' : undefined}
              />
              {Array.from({ length: week.runs }, (_, k) => (
                <rect key={`r${k}`} x={x(i)} y={y(k)} width={dot} height={dot} rx={dot / 3} fill={fill} data-testid="run-dot" />
              ))}
              {Array.from({ length: week.planned }, (_, k) => (
                <rect
                  key={`p${k}`}
                  x={x(i) + 0.5}
                  y={y(week.runs + k) + 0.5}
                  width={dot - 1}
                  height={dot - 1}
                  rx={dot / 3}
                  fill="none"
                  stroke="var(--accent)"
                  strokeDasharray="2 2"
                  vectorEffect="non-scaling-stroke"
                  data-testid="planned-dot"
                />
              ))}
            </g>
          )
        })}
      </svg>
      {withOthers && (
        <svg viewBox={`${-PAD} 0 ${CHART_W + 2 * PAD} ${dot}`} className="block h-auto w-full overflow-visible" aria-hidden data-testid="others-row">
          {weeks.map((week, i) =>
            week.others > 0 ? <circle key={week.start} cx={x(i) + dot / 2} cy={dot / 2} r={dot / 3} fill="var(--zone-1)" data-testid="other-mark" /> : null,
          )}
        </svg>
      )}
      <div className="relative h-[3px]" aria-hidden>
        {streak.length > 0 && (
          <span
            className="absolute inset-y-0 rounded-full bg-accent"
            data-testid="streak-underline"
            style={{ left: pct(x(streak[0]!)), right: `calc(100% - ${pct(x(streak.at(-1)!) + dot)})` }}
          />
        )}
      </div>
      <div className="relative h-4 text-caption leading-4 text-muted-foreground" aria-hidden data-testid="month-labels">
        {weeks.map((week, i) =>
          week.month ? (
            <span key={week.start} className="absolute whitespace-nowrap" style={{ left: pct(x(i)) }}>
              {formatDate(week.month, { precision: 'month', year: 'never' }).replace(/\.$/, '')}
            </span>
          ) : null,
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground" data-testid="consistency-legend">
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="flex items-center gap-1">
            <span aria-hidden className="size-2 rounded-[2px] bg-accent" />
            {c.legend.onTarget(target)}
          </span>
          <span className="flex items-center gap-1">
            <span aria-hidden className="size-2 rounded-[2px] bg-[var(--band)]" />
            {c.legend.under}
          </span>
          <span className="flex items-center gap-1">
            <span aria-hidden className="box-border size-2 rounded-[2px] border border-dashed border-accent" />
            {c.legend.planned}
          </span>
          {withOthers && (
            <span className="flex items-center gap-1">
              <span aria-hidden className="size-1.5 rounded-full bg-[var(--zone-1)]" />
              {t.crossTraining.legend}
            </span>
          )}
        </span>
        <span className="text-accent-text">— {c.legend.streak}</span>
      </div>
    </section>
  )
}

const WEEKDAY_BAR_PX = 70
const STUB_SHARE = 0.1

function RunningWeek({ view }: { view: ConsistencyView }) {
  const c = t.consistency
  const narrow = new Intl.DateTimeFormat(t.locale, { weekday: 'narrow', timeZone: 'UTC' })
  const most = Math.max(1, ...view.weekdays)
  return (
    <section className={cardClass({ className: 'flex flex-col gap-2.5' })} data-testid="consistency-weekdays">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={CARD_TITLE}>{c.runningWeek}</h2>
        <span className="shrink-0 text-xs text-muted-foreground">{c.weeksRan(view.weeksCounted)}</span>
      </div>
      <ul className="grid grid-cols-7 items-end gap-2">
        {view.weekdays.map((weeks, i) => {
          const anchor = i === view.anchor
          const stub = weeks <= view.weeksCounted * STUB_SHARE
          return (
            <li key={i} className="flex flex-col items-center gap-[5px]" aria-label={c.weekdayLabel(weekdayName(i), weeks)} data-testid="weekday">
              <span aria-hidden className="text-[11px] font-semibold tabular-nums text-foreground">{weeks}</span>
              <span
                aria-hidden
                data-testid="weekday-bar"
                data-anchor={anchor || undefined}
                data-stub={stub || undefined}
                className={cn('block w-full max-w-[30px]', stub ? 'rounded-full' : 'rounded-md')}
                style={{
                  height: stub ? 4 : Math.max(8, Math.round((weeks / most) * WEEKDAY_BAR_PX)),
                  background: stub ? 'var(--line-2)' : anchor ? 'var(--accent)' : ACCENT_DIM,
                }}
              />
              <span aria-hidden className={cn('text-[11.5px]', anchor ? 'font-semibold text-accent-text' : 'text-muted-foreground')}>
                {narrow.format(new Date(Date.UTC(2024, 0, 1 + i)))}
              </span>
            </li>
          )
        })}
      </ul>
      {view.anchor !== null && (
        <p className="text-[12.5px] leading-[1.45] text-muted-foreground" data-testid="weekday-sentence">
          <b className="font-semibold text-foreground">{c.anchor(weekdayName(view.anchor))}</b>
          {c.anchorWeeks(view.weekdays[view.anchor]!, view.weeksCounted)}
          {view.restDay !== null && ` ${c.restDay(weekdayName(view.restDay))}`}
        </p>
      )}
    </section>
  )
}

export function Consistency({ views, today }: { views: Record<ConsistencyRange, ConsistencyView>; today: string }) {
  const c = t.consistency
  const [rangeParam, setRangeParam] = useUrlParam('range')
  const range = parseRange(rangeParam)
  const setRange = (next: ConsistencyRange) => setRangeParam(next === DEFAULT_RANGE ? null : next)
  const tabs = useSegmentedTabs({ ids: CONSISTENCY_RANGES, value: range, onChange: setRange })
  const [week, setWeek] = useState<string | null>(null)
  const view = views[range]

  return (
    <>
      <header className="mb-1.5 flex items-center justify-between gap-3">
        <h1 className="min-w-0 text-display text-foreground">{t.pages.consistency.title}</h1>
        <SegmentedTabs
          tabs={tabs}
          label={c.rangeLabel}
          size="sm"
          barMirror
          items={CONSISTENCY_RANGES.map((id) => ({ id, label: c.ranges[id], ariaLabel: c.rangesSpoken[id] }))}
        />
      </header>
      <div {...tabs.panelProps} className="flex flex-col gap-3.5 outline-none">
        {view.weeks.length === 0 ? (
          <section className={cardClass({ dashed: true, className: 'py-10 text-center' })}>
            <p className="text-sm text-subtle">{c.empty}</p>
          </section>
        ) : (
          <>
            <StreakCard view={view} />
            <RunsPerWeek view={view} selected={week} onSelect={setWeek} />
            <RunningWeek view={view} />
          </>
        )}
      </div>
      {week && <WeekSheet view={view} weekStart={week} today={today} onClose={() => setWeek(null)} />}
    </>
  )
}
