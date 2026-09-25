import type { ProfilePeriodStats } from '@/application/usecases/GetProfileData'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ListRow } from '@/components/ui/ListRow'
import { metricDeltaColor } from '@/lib/colors'
import { formatDelta, formatKm } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import type { HubRow } from './progressHub'

const HOURS = (stats: ProfilePeriodStats) => Math.round(stats.durationSeconds / 3600)

function YearStat({ value, unit, delta }: { value: number; unit: string; delta: number | null }) {
  return (
    <div className="min-w-0">
      <div className="text-xl font-bold tabular-nums text-foreground">
        {formatKm(value)}
        <span className="text-caption font-normal text-muted-foreground"> {unit}</span>
      </div>
      {delta !== null && (
        <div className="text-xs tabular-nums" style={{ color: metricDeltaColor(delta, 'up', 0) }}>
          {formatDelta(Math.round(delta))}
        </div>
      )}
    </div>
  )
}

/** Year-to-date volume, against the same date last year. */
export function ProgressYearCard({ ytd, prevYear, year }: { ytd: ProfilePeriodStats; prevYear: ProfilePeriodStats | null; year: number }) {
  const h = t.profile.hub
  const delta = (pick: (s: ProfilePeriodStats) => number) => (prevYear ? pick(ytd) - pick(prevYear) : null)
  return (
    <GlassSurface variant="card" className="px-4.5 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-foreground">{h.yearSoFar(year)}</span>
        {prevYear && <span className="text-xs text-muted-foreground">{h.vsSameDate(year - 1)}</span>}
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-2.5">
        <YearStat value={Math.round(ytd.distanceKm)} unit={t.units.km} delta={delta((s) => s.distanceKm)} />
        <YearStat value={HOURS(ytd)} unit={t.units.hour} delta={delta(HOURS)} />
        <YearStat value={ytd.sessionCount} unit={h.runs} delta={delta((s) => s.sessionCount)} />
      </div>
    </GlassSurface>
  )
}

/** Progress as a hub: the year so far, then a row per sub-page. */
export function ProgressHub({ rows, ytd, prevYear, year }: { rows: HubRow[]; ytd: ProfilePeriodStats; prevYear: ProfilePeriodStats | null; year: number }) {
  return (
    <div className="space-y-3.5">
      <h1 className="px-1 font-display text-title1 font-bold tracking-tight text-foreground">{t.nav.items.profile}</h1>
      <ProgressYearCard ytd={ytd} prevYear={prevYear} year={year} />
      <GlassSurface variant="card" className="overflow-hidden">
        <nav aria-label={t.nav.items.profile}>
          {rows.map((row, i) => (
            <ListRow
              key={row.key}
              href={row.href}
              title={row.title}
              status={row.status}
              tone={row.tone}
              className={cn(i > 0 && 'border-t border-border')}
            />
          ))}
        </nav>
      </GlassSurface>
    </div>
  )
}
