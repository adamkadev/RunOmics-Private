import { cardClass } from '@/components/ui/Card'
import { Unit } from '@/components/ui/Stat'
import { formatDuration, formatNumber } from '@/lib/formatters'
import type { AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import type { AthletePageView } from './athleteView'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface MetricData {
  label: string
  unit: string
  value: string | number | undefined
}

type AvailableMetric = MetricData & { value: string | number }

function available(metrics: MetricData[]): AvailableMetric[] {
  return metrics
    .filter((metric): metric is AvailableMetric => metric.value !== undefined)
    .map((metric) => (typeof metric.value === 'number' ? { ...metric, value: formatNumber(metric.value) } : metric))
}

export function athleteStats(athlete: AthletePageView): AvailableMetric[] {
  const a = t.settings.athlete
  return available([
    { label: a.restingHr, unit: t.units.bpm, value: athlete.restingHrBpm },
    { label: a.thresholdHr, unit: t.units.bpm, value: athlete.lthrBpm },
    { label: a.maxHr, unit: t.units.bpm, value: athlete.maxHrBpm },
    {
      label: a.thresholdPace,
      unit: t.units.perKm,
      value: athlete.thresholdPaceSecPerKm ? formatDuration(athlete.thresholdPaceSecPerKm) : undefined,
    },
    { label: a.vma, unit: t.units.kmh, value: athlete.vmaKmh },
  ])
}

export function AthleteStats({ athlete }: { athlete: AthletePageView }) {
  const cells = athleteStats(athlete)
  if (cells.length === 0) return null

  return (
    <section className={cardClass({ padding: 'none', overflow: true, className: 'grid grid-cols-3 rounded-[18px]' })} data-testid="athlete-stats">
      {cells.map((cell, i) => (
        <div
          key={cell.label}
          data-testid="athlete-stat"
          className={cn(
            'flex min-w-0 flex-col gap-1 px-4 py-3.5',
            i % 3 > 0 && 'border-l border-border',
            i >= 3 && 'border-t border-border',
            // The last tile takes the rest of its row rather than leave an empty cell beside it.
            i === cells.length - 1 && (i % 3 === 0 ? 'col-span-3' : i % 3 === 1 && 'col-span-2'),
          )}
        >
          <div className="truncate text-xs text-muted-foreground">
            {cell.label}
          </div>
          {/* The unit wraps under the number rather than be cut: "km/h" fills a third of a 393 pt screen. */}
          <div className="break-words text-[22px] font-semibold leading-tight tabular-nums text-foreground">
            {cell.value}
            {cell.unit && <Unit>{cell.unit}</Unit>}
          </div>
        </div>
      ))}
    </section>
  )
}

export function bodyMetrics(athlete: Pick<AthleteProfile, 'heightCm' | 'weightKg'>): AvailableMetric[] {
  const a = t.settings.athlete
  return available([
    { label: a.height, unit: t.units.cm, value: athlete.heightCm },
    { label: a.weight, unit: t.units.kg, value: athlete.weightKg },
  ])
}
