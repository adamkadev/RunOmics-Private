import { cardClass } from '@/components/ui/Card'
import { Stat, StatGrid } from '@/components/ui/Stat'
import { CardTitle, EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import { shortDist } from '@/components/goals/shortDistance'
import { MINUS, formatClock, formatDate, formatDelta, formatDuration, formatPace } from '@/lib/formatters'
import { deltaColor } from '@/lib/deltaTone'
import { linePath } from '@/lib/linePath'
import { cn } from '@/lib/utils'
import { closingPace, daysBetween, evenSplit, pacingCheckpoints, predictionChange, type PredictionPoint } from '@/domain/race/pacing'
import { RACE_TREND_DAYS, type RacePageData } from '@/application/usecases/GetRacePage'
import { formBand } from '@/domain/training/formBand'
import type { FormForecast, FormPoint } from '@/domain/training/formForecast'
import { t } from '@/i18n'

const bare = (iso: string) => formatDate(iso, { style: 'bare', year: 'never' })

function signed(seconds: number): string {
  const rounded = Math.round(seconds)
  const abs = Math.abs(rounded)
  return `${rounded < 0 ? MINUS : rounded > 0 ? '+' : ''}${abs < 60 ? `${abs} s` : formatClock(abs)}`
}

function TrendLine({ points, target }: { points: PredictionPoint[]; target: number | null }) {
  const values = points.map((p) => p.seconds)
  const lo = Math.min(...values, target ?? Infinity)
  const hi = Math.max(...values, target ?? -Infinity)
  // By date, not by index: a gap in Garmin's series keeps its width.
  const first = points[0]!.date
  const byDay: (number | null)[] = Array.from({ length: daysBetween(first, points.at(-1)!.date) + 1 }, () => null)
  for (const p of points) byDay[daysBetween(first, p.date)] = -p.seconds
  const pad = (hi - lo) * 0.15 || 5
  const W = 1000
  const H = 64
  // Faster is up: a smaller time sits higher.
  const y = (s: number) => H - ((hi + pad - s) / (hi - lo + 2 * pad)) * H
  return (
    <div className="flex flex-col gap-1">
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block" aria-hidden>
        {target !== null && (
          <line x1={0} x2={W} y1={y(target)} y2={y(target)} stroke="var(--accent)" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        )}
        <path d={linePath(byDay, -(hi + pad), -(lo - pad), W, H)} fill="none" stroke="var(--foreground)" strokeWidth="1.75" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{bare(points[0]!.date)}</span>
        <span>{bare(points.at(-1)!.date)}</span>
      </div>
    </div>
  )
}

function FormLine({ points }: { points: FormPoint[] }) {
  const values = points.map((p) => p.tsb)
  const pad = 5
  const lo = Math.min(...values, 0) - pad
  const hi = Math.max(...values, 0) + pad
  const W = 1000
  const H = 64
  const todayIndex = points.findLastIndex((p) => !p.planned)
  const done = values.map((v, i) => (i <= todayIndex ? v : null))
  const ahead = values.map((v, i) => (i >= todayIndex ? v : null))
  const zero = H - ((0 - lo) / (hi - lo)) * H
  return (
    <div className="flex flex-col gap-1">
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block" aria-hidden data-testid="race-form-line">
        <line x1={0} x2={W} y1={zero} y2={zero} stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <path d={linePath(done, lo, hi, W, H)} fill="none" stroke="var(--foreground)" strokeWidth="1.75" vectorEffect="non-scaling-stroke" />
        <path d={linePath(ahead, lo, hi, W, H)} fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{bare(points[0]!.date)}</span>
        <span>{t.race.formRaceDay}</span>
      </div>
    </div>
  )
}

function RaceDayForm({ form }: { form: FormForecast }) {
  const r = t.race
  const readiness = t.dashboard.readiness
  return (
    <section className={cardClass({ className: 'flex flex-col gap-3' })} data-testid="race-form" data-state={form.kind}>
      <CardTitle as="h2">{r.formTitle}</CardTitle>
      {form.kind === 'forecast' ? (
        <>
          <StatGrid columns={3}>
            <Stat
              label={readiness.formLabel}
              value={<span data-testid="race-form-tsb">{formatDelta(Math.round(form.raceDay.tsb))}</span>}
              meaning={t.formBand[formBand(form.raceDay.tsb)]}
            />
            <Stat label={readiness.ctl} value={Math.round(form.raceDay.ctl)} />
            <Stat label={readiness.atl} value={Math.round(form.raceDay.atl)} />
          </StatGrid>
          {form.points.length >= 2 && <FormLine points={form.points} />}
          <p className="text-[12px] text-muted-foreground text-pretty">
            {r.formToday(formatDelta(Math.round(form.tsbToday)))} {r.formCaption}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground text-pretty" data-testid="race-form-unavailable">
          {form.kind === 'shortHistory'
            ? r.formShortHistory(form.runningDays, form.neededDays)
            : form.plannedThrough
              ? r.formPlanShort(formatDate(form.plannedThrough))
              : r.formNoPlan}
        </p>
      )}
    </section>
  )
}

export function RaceView({ data }: { data: RacePageData }) {
  const r = t.race
  const { race, distanceKm, daysUntil, predictedSeconds, targetSeconds, pb, trend, estimate, form } = data
  const predicted = estimate ? r.estimated : r.predicted
  const gap = predictedSeconds !== null && targetSeconds !== null ? predictedSeconds - targetSeconds : null
  const closing = gap !== null ? closingPace(gap, daysUntil) : null
  const change = predictionChange(trend, RACE_TREND_DAYS)
  const changePerWeek = change && change.weeks > 1 && Math.round(change.perWeek) !== 0 ? signed(change.perWeek) : null
  const columns = [
    ...(targetSeconds !== null ? [{ label: r.target, seconds: targetSeconds }] : []),
    ...(predictedSeconds !== null ? [{ label: predicted, seconds: predictedSeconds }] : []),
  ]
  const dash = '—'

  return (
    <div className="flex flex-col gap-3.5">
      <header className="flex flex-col gap-1">
        <span className={cn(EYEBROW_CLASS, 'text-accent-text')} data-testid="race-eyebrow">
          {shortDist(race.distance)} · {formatDate(race.date, { style: 'bare' })} · {t.profile.hub.inDays(daysUntil)}
        </span>
        <h1 className="break-words text-display text-foreground text-pretty">{race.name}</h1>
        {race.location && <p className="text-sm text-muted-foreground">{race.location}</p>}
      </header>

      <section className={cardClass({ className: 'flex flex-col gap-3' })} data-testid="race-stand">
        <CardTitle as="h2">{r.standTitle}</CardTitle>
        <StatGrid columns={3}>
          <Stat label={predicted} value={predictedSeconds !== null ? formatDuration(predictedSeconds) : dash} />
          <Stat label={r.target} value={targetSeconds !== null ? formatDuration(targetSeconds) : dash} />
          <Stat label={r.best} value={pb ? formatDuration(pb.seconds) : dash} meaning={pb?.date ? bare(pb.date) : undefined} />
        </StatGrid>
        {gap !== null && (
          <p className="text-sm text-pretty" data-testid="race-gap">
            <b style={{ color: gap > 0 ? 'var(--warn)' : 'var(--pos)' }}>{(gap > 0 ? r.toFind : r.inHand)(formatClock(Math.abs(gap)))}</b>
            {closing && <span className="text-muted-foreground"> {r.perWeek(closing.perWeek, closing.weeks)}</span>}
          </p>
        )}
        {estimate && (
          <p className="text-[12px] text-muted-foreground text-pretty" data-testid="race-estimate">
            {r.estimatedBy(t.records.distances[estimate.effort] ?? estimate.effort, formatDate(estimate.date))}
          </p>
        )}
      </section>

      <RaceDayForm form={form} />

      {trend.length >= 2 && (
        <section className={cardClass({ className: 'flex flex-col gap-2' })} data-testid="race-trend">
          <CardTitle as="h2">{estimate ? r.trendTitleEstimated : r.trendTitle}</CardTitle>
          <TrendLine points={trend} target={targetSeconds} />
          {change && (
            <p className="text-sm" style={{ color: deltaColor('race', change.seconds, { value: trend.at(-1)!.seconds }) }} data-testid="race-trend-change">
              {Math.round(change.seconds) === 0 ? r.trendFlat(change.weeks) : r.trendChange(signed(change.seconds), change.weeks, changePerWeek)}
            </p>
          )}
        </section>
      )}

      {columns.length > 0 && (
        <section className={cardClass({ className: 'flex flex-col gap-2' })} data-testid="race-pacing">
          <CardTitle as="h2">{r.pacingTitle}</CardTitle>
          <p className="text-xs text-muted-foreground text-pretty">{r.pacingCaption}</p>
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th scope="col" className="py-1.5 text-left font-normal">{r.split}</th>
                {columns.map((c) => <th key={c.label} scope="col" className="py-1.5 text-right font-normal">{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <th scope="row" className="py-2 text-left font-normal text-muted-foreground">{r.pace}</th>
                {columns.map((c) => <td key={c.label} className="py-2 text-right font-semibold text-foreground">{formatPace(c.seconds / distanceKm)}</td>)}
              </tr>
              {pacingCheckpoints(distanceKm).map((km) => (
                <tr key={km} className="border-t border-border" data-testid="race-split">
                  <th scope="row" className="py-2 text-left font-normal text-foreground">{km === distanceKm ? r.finish : `${km} ${t.units.km}`}</th>
                  {columns.map((c) => <td key={c.label} className="py-2 text-right text-foreground">{formatDuration(evenSplit(c.seconds, distanceKm, km))}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
