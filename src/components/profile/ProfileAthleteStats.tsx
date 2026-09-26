import { GlossaryTerm, type GlossaryKey } from '@/components/ui/GlossaryTerm'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { formatDuration } from '@/lib/formatters'
import type { AthletePageView } from './athleteView'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface MetricData {
  label: string
  /** A term with a definition behind an (i). */
  glossary?: GlossaryKey
  unit: string
  value: string | number | undefined
}

type AvailableMetric = MetricData & { value: string | number }

function available(metrics: MetricData[]): AvailableMetric[] {
  return metrics.filter((metric): metric is AvailableMetric => metric.value !== undefined)
}

/** The four numbers a session is built from, under their plain names. */
export function keyMetrics(athlete: AthletePageView, latestVo2max: number | null): AvailableMetric[] {
  const a = t.settings.athlete
  return available([
    {
      label: a.vo2max,
      glossary: 'vo2max',
      unit: t.units.mlKgMin,
      value: latestVo2max !== null ? latestVo2max.toFixed(1) : undefined,
    },
    { label: a.vma, glossary: 'vma', unit: t.units.kmh, value: athlete.vmaKmh },
    { label: a.thresholdHr, glossary: 'lthr', unit: t.units.bpm, value: athlete.lthrBpm },
    {
      label: a.thresholdPace,
      glossary: 'thresholdPace',
      unit: t.units.perKm,
      value: athlete.thresholdPaceSecPerKm ? formatDuration(athlete.thresholdPaceSecPerKm) : undefined,
    },
  ])
}

/**
 * The four key numbers in one card as a 2 x 2 grid with hairline dividers
 * (C2, v4.4), replacing four separate cards. Each label opens its definition
 * on a tap; there is no (i) on the card.
 */
export function AthleteKeyNumbers({ athlete, latestVo2max }: { athlete: AthletePageView; latestVo2max: number | null }) {
  const tiles = keyMetrics(athlete, latestVo2max)
  if (tiles.length === 0) return null

  return (
    <GlassSurface variant="card" className="overflow-hidden rounded-card-sm" data-testid="athlete-key-numbers">
      <div className={cn('grid', tiles.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
        {tiles.map((tile, i) => (
          <div
            key={tile.label}
            data-testid="athlete-key-number"
            className={cn('px-4 py-3.5', i % 2 === 1 && 'border-l border-border', i >= 2 && 'border-t border-border')}
          >
            <div className="text-caption uppercase tracking-[0.08em] text-muted-foreground">
              {tile.glossary ? <GlossaryTerm term={tile.glossary} quiet>{tile.label}</GlossaryTerm> : tile.label}
            </div>
            <div className="mt-1.5 font-display text-title2 font-bold leading-none tabular-nums text-foreground">
              {tile.value}
              <span className="ml-1.5 font-sans text-footnote font-medium text-muted-foreground">{tile.unit}</span>
            </div>
          </div>
        ))}
      </div>
    </GlassSurface>
  )
}

/**
 * Heart and body as one compact row (C2): resting HR, max HR and fitness age
 * against the real age ("20 of 29"). Height, weight and BMI live in Settings
 * > Profile, and the check badges, which read as pass or fail, are gone.
 */
export function AthleteDetails({ athlete }: { athlete: AthletePageView }) {
  const a = t.settings.athlete
  const cells: { key: string; label: string; value: number; note?: string }[] = []
  if (athlete.restingHrBpm !== undefined) cells.push({ key: 'resting', label: a.restingHr, value: athlete.restingHrBpm })
  if (athlete.maxHrBpm !== undefined) cells.push({ key: 'max', label: a.maxHr, value: athlete.maxHrBpm })
  if (athlete.fitnessAgeYrs !== undefined) {
    cells.push({
      key: 'fitnessAge',
      label: a.fitnessAge,
      value: Math.round(athlete.fitnessAgeYrs),
      note: athlete.age !== undefined ? a.ofAge(athlete.age) : undefined,
    })
  }
  if (cells.length === 0) return null

  return (
    <GlassSurface variant="card" className="rounded-card-sm px-4 py-3.5" data-testid="athlete-details">
      <dl className="grid grid-cols-3 gap-2">
        {cells.map((cell) => (
          <div key={cell.key} className="min-w-0">
            <dt className="text-footnote text-muted-foreground">{cell.label}</dt>
            <dd className="mt-1 font-display text-title3 font-bold leading-none tabular-nums text-foreground">
              {cell.value}
              {cell.note && <span className="ml-1 font-sans text-footnote font-medium text-muted-foreground">{cell.note}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </GlassSurface>
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
