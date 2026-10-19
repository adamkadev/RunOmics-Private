import type { CSSProperties } from 'react'
import { cardClass } from '@/components/ui/Card'
import { Unit } from '@/components/ui/Stat'
import { formatDuration, formatNumber } from '@/lib/formatters'
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
    // A VMA, a weight or a BMI has a decimal, which follows the locale.
    .map((metric) => (typeof metric.value === 'number' ? { ...metric, value: formatNumber(metric.value) } : metric))
}

/**
 * The four numbers under the grade hero (v5.3): VMA, fitness age, threshold
 * HR and threshold pace. VO₂max left the grid for the grade card above it.
 */
export function keyMetrics(athlete: AthletePageView): AvailableMetric[] {
  const a = t.settings.athlete
  return available([
    { label: a.vma, unit: t.units.kmh, value: athlete.vmaKmh },
    {
      label: a.fitnessAge,
      unit: athlete.age !== undefined ? a.ofAge(athlete.age) : '',
      value: athlete.fitnessAgeYrs !== undefined ? Math.round(athlete.fitnessAgeYrs) : undefined,
    },
    { label: a.thresholdHr, unit: t.units.bpm, value: athlete.lthrBpm },
    {
      label: a.thresholdPace,
      unit: t.units.perKm,
      value: athlete.thresholdPaceSecPerKm ? formatDuration(athlete.thresholdPaceSecPerKm) : undefined,
    },
  ])
}

/** A strip of cells in one card, a line between them (v4.17): 2 x 2 on a phone, one row from sm up. */
function cellBorders(i: number): string {
  return cn(i % 2 === 1 && 'border-l border-border', i >= 2 && 'border-t border-border sm:border-t-0', i > 0 && i % 2 === 0 && 'sm:border-l')
}

/**
 * The four key numbers as one strip (C2, v4.4; v4.17): a cell each, 24 pt
 * values with their units inline, under plain labels (design review, Oct
 * 2026: no definitions - they clipped inside the label's truncate).
 */
export function AthleteKeyNumbers({ athlete }: { athlete: AthletePageView }) {
  const tiles = keyMetrics(athlete)
  if (tiles.length === 0) return null

  return (
    <section
      className={cardClass({ padding: 'none', overflow: true, className: cn('grid', tiles.length === 1 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-[repeat(var(--cells),minmax(0,1fr))]') })}
      style={{ '--cells': tiles.length } as CSSProperties}
      data-testid="athlete-key-numbers"
    >
      {tiles.map((tile, i) => (
        <div key={tile.label} data-testid="athlete-key-number" className={cn('flex min-w-0 flex-col gap-1 px-5 py-[18px]', cellBorders(i))}>
          <div className="truncate text-xs text-muted-foreground">
            {tile.label}
          </div>
          <div className="truncate text-2xl font-semibold leading-tight text-foreground">
            {tile.value}
            {tile.unit && <Unit>{tile.unit}</Unit>}
          </div>
        </div>
      ))}
    </section>
  )
}

/**
 * Heart as one compact strip: resting and max HR (v5.3; fitness age moved up
 * into the grid). Height, weight and BMI live in Settings > Profile.
 */
export function AthleteDetails({ athlete }: { athlete: AthletePageView }) {
  const a = t.settings.athlete
  const cells: { key: string; label: string; value: number }[] = []
  if (athlete.restingHrBpm !== undefined) cells.push({ key: 'resting', label: a.restingHr, value: athlete.restingHrBpm })
  if (athlete.maxHrBpm !== undefined) cells.push({ key: 'max', label: a.maxHr, value: athlete.maxHrBpm })
  if (cells.length === 0) return null

  return (
    <section className={cardClass({ padding: 'none', overflow: true })} data-testid="athlete-details">
      <dl className={cn('grid', cells.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
        {cells.map((cell, i) => (
          <div key={cell.key} className={cn('flex min-w-0 flex-col gap-1 px-5 py-[18px]', i > 0 && 'border-l border-border')}>
            <dt className="text-xs text-muted-foreground">{cell.label}</dt>
            <dd className="text-2xl font-semibold leading-tight text-foreground">
              {cell.value}
              <Unit>{t.units.bpm}</Unit>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/** Height, weight and BMI, for Settings > Profile. */
export function bodyMetrics(athlete: Pick<AthletePageView, 'heightCm' | 'weightKg' | 'bmi'>): AvailableMetric[] {
  const a = t.settings.athlete
  return available([
    { label: a.height, unit: t.units.cm, value: athlete.heightCm },
    { label: a.weight, unit: t.units.kg, value: athlete.weightKg },
    { label: a.bmi, unit: '', value: athlete.bmi },
  ])
}
