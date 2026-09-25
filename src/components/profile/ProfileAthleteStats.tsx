import { GlossaryTerm, type GlossaryKey } from '@/components/ui/GlossaryTerm'
import { CircleCheck, Minus, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react'
import { CardTitle } from '@/components/ui/SectionLabel'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { formatDuration } from '@/lib/formatters'
import type { AthletePageView } from './athleteView'
import {
  BMI_BAND_TONE,
  FITNESS_AGE_BAND_TONE,
  bmiBand,
  fitnessAgeBand,
  fitnessAgeDeltaYears,
  type VerdictTone,
} from '@/domain/athlete/bodyMetrics'
import { STATUS } from '@/lib/statusColors'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface MetricData {
  label: string
  /** A term with a definition behind an (i). */
  glossary?: GlossaryKey
  unit: string
  value: string | number | undefined
  band?: { label: string; tone: VerdictTone }
}

type AvailableMetric = MetricData & { value: string | number }

function available(metrics: MetricData[]): AvailableMetric[] {
  return metrics.filter((metric): metric is AvailableMetric => metric.value !== undefined)
}

const TONE_ICON: Record<VerdictTone, { Icon: LucideIcon; className: string }> = {
  success: { Icon: CircleCheck, className: STATUS.success.text },
  neutral: { Icon: Minus, className: STATUS.pending.text },
  warning: { Icon: TriangleAlert, className: STATUS.warning.text },
  danger: { Icon: OctagonAlert, className: STATUS.danger.text },
}

function VerdictIcon({ band }: { band: NonNullable<MetricData['band']> }) {
  const { Icon, className } = TONE_ICON[band.tone]
  return (
    <Icon
      size={12}
      strokeWidth={2.5}
      role="img"
      aria-label={band.label}
      className={cn('ml-1 inline align-[0.05em]', className)}
    >
      <title>{band.label}</title>
    </Icon>
  )
}

function fitnessAgeMetricBand(athlete: AthletePageView): MetricData['band'] {
  const { fitnessAgeYrs, age } = athlete
  if (fitnessAgeYrs === undefined || age === undefined) return undefined

  const a = t.settings.athlete
  const band = fitnessAgeBand(fitnessAgeYrs, age)
  const years = fitnessAgeDeltaYears(fitnessAgeYrs, age)

  return {
    label: band === 'onPar' ? a.fitnessAgeBand.onPar : a.fitnessAgeBand[band](years),
    tone: FITNESS_AGE_BAND_TONE[band],
  }
}

function bmiMetricBand(bmi: number | undefined): MetricData['band'] {
  if (bmi === undefined) return undefined
  const band = bmiBand(bmi)
  return { label: t.settings.athlete.bmiBand[band], tone: BMI_BAND_TONE[band] }
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

/** Everything else Garmin knows about the athlete: context, not inputs. */
export function detailMetrics(athlete: AthletePageView): AvailableMetric[] {
  const a = t.settings.athlete
  return available([
    { label: a.restingHr, unit: t.units.bpm, value: athlete.restingHrBpm },
    { label: a.maxHr, unit: t.units.bpm, value: athlete.maxHrBpm },
    { label: a.age, unit: t.units.yrs, value: athlete.age },
    {
      label: a.fitnessAge,
      unit: t.units.yrs,
      value: athlete.fitnessAgeYrs !== undefined ? Math.round(athlete.fitnessAgeYrs) : undefined,
      band: fitnessAgeMetricBand(athlete),
    },
    {
      label: a.achievableFitnessAge,
      unit: t.units.yrs,
      value:
        athlete.achievableFitnessAgeYrs !== undefined ? Math.round(athlete.achievableFitnessAgeYrs) : undefined,
    },
    { label: a.height, unit: t.units.cm, value: athlete.heightCm },
    { label: a.weight, unit: t.units.kg, value: athlete.weightKg },
    { label: a.bmi, unit: '', value: athlete.bmi, band: bmiMetricBand(athlete.bmi) },
  ])
}

/**
 * The key numbers as four tiles, each with its definition behind an (i). A
 * single grid replaced the Performance / Cardio / Body toggle, which hid two
 * thirds of the numbers and put a second switch on a page that already had
 * one for the zones.
 */
export function AthleteKeyNumbers({ athlete, latestVo2max }: { athlete: AthletePageView; latestVo2max: number | null }) {
  const tiles = keyMetrics(athlete, latestVo2max)
  if (tiles.length === 0) return null

  return (
    <div className={cn('grid gap-2', tiles.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
      {tiles.map((tile) => (
        <GlassSurface key={tile.label} variant="card" className="rounded-card-sm px-3.5 py-3">
          <div className="text-caption font-semibold uppercase tracking-wide text-subtle">
            {tile.glossary ? <GlossaryTerm term={tile.glossary}>{tile.label}</GlossaryTerm> : tile.label}
          </div>
          <div className="mt-1 text-title2 font-bold tabular-nums text-foreground">
            {tile.value}
            <span className="ml-1 text-xs font-medium text-muted-foreground">{tile.unit}</span>
          </div>
        </GlassSurface>
      ))}
    </div>
  )
}

/** Heart and body context as one plain list, no toggle. */
export function AthleteDetails({ athlete }: { athlete: AthletePageView }) {
  const rows = detailMetrics(athlete)
  if (rows.length === 0) return null

  return (
    <GlassSurface variant="card" className="rounded-card-sm px-4 py-3.5">
      <CardTitle as="h2" className="text-body text-foreground">{t.settings.athlete.details}</CardTitle>
      <dl className="mt-1.5">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-3 border-t border-foreground/[0.06] py-2 first:border-t-0 text-footnote"
          >
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="font-semibold tabular-nums text-foreground">
              {row.value}
              {row.unit && <span className="ml-1 text-caption font-medium text-subtle">{row.unit}</span>}
              {row.band ? <VerdictIcon band={row.band} /> : null}
            </dd>
          </div>
        ))}
      </dl>
    </GlassSurface>
  )
}
