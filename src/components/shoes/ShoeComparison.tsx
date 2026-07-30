import type { ShoeComparisonRow } from '@/application/usecases/GetShoeComparison'
import { formatCompactMonthYear, formatDistance, formatPace } from '@/lib/formatters'
import { t } from '@/i18n'

interface Props {
  rows: ShoeComparisonRow[]
}

type MetricRow = { label: string; value: (row: ShoeComparisonRow) => string }

const METRICS: MetricRow[] = [
  { label: t.shoes.comparison.metrics.sessions, value: (r) => `${r.sessionCount}` },
  { label: t.shoes.comparison.metrics.distance, value: (r) => `${formatDistance(r.totalKm)} ${t.units.km}` },
  { label: t.shoes.comparison.metrics.keyShare, value: (r) => `${r.keySessionPercent}${t.units.percent}` },
  { label: t.shoes.comparison.metrics.pace, value: (r) => (r.paceSecPerKm ? formatPace(r.paceSecPerKm) : '-') },
  { label: t.shoes.comparison.metrics.heartRate, value: (r) => (r.avgHeartRate ? `${r.avgHeartRate} ${t.units.bpm}` : '-') },
  { label: t.shoes.comparison.metrics.cadence, value: (r) => (r.cadenceSpm ? `${r.cadenceSpm} ${t.units.spm}` : '-') },
  { label: t.shoes.comparison.metrics.groundContact, value: (r) => (r.groundContactMs ? `${r.groundContactMs} ${t.units.ms}` : '-') },
  { label: t.shoes.comparison.metrics.oscillation, value: (r) => (r.verticalOscillationMm ? `${r.verticalOscillationMm} ${t.units.mm}` : '-') },
]

export function ShoeComparison({ rows }: Props) {
  if (rows.length < 2) return null

  return (
    <section className="space-y-2.5">
      <h2 className="widget-label text-muted-foreground">{t.shoes.comparison.title}</h2>

      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 bg-background px-3 py-2.5 text-left" />
              {rows.map((row) => (
                <th key={row.gearId} scope="col" className="px-3 py-2.5 text-left align-bottom">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.dotColor }} />
                    <span className="font-semibold text-foreground">{row.name}</span>
                  </span>
                  <span className="mt-0.5 block text-micro font-normal text-subtle-2">
                    {t.shoes.comparison.period(
                      formatCompactMonthYear(row.firstUsed),
                      formatCompactMonthYear(row.lastUsed),
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((metric) => (
              <tr key={metric.label} className="border-t border-border">
                <th scope="row" className="sticky left-0 bg-background px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  {metric.label}
                </th>
                {rows.map((row) => (
                  <td key={row.gearId} className="px-3 py-2 tabular-nums text-foreground">
                    {metric.value(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="px-1 text-caption text-subtle-2">{t.shoes.comparison.note}</p>
    </section>
  )
}
