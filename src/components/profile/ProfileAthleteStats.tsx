'use client'

import { useState } from 'react'
import { CircleCheck, Minus, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { formatDuration } from '@/lib/formatters'
import type { AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import {
  BMI_BAND_TONE,
  FITNESS_AGE_BAND_TONE,
  bmiBand,
  fitnessAgeBand,
  fitnessAgeDeltaYears,
  type VerdictTone,
} from '@/domain/athlete/bodyMetrics'
import { formatRelativeAgo } from '@/lib/formatters'
import { STATUS } from '@/lib/statusColors'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface Props {
  athlete: AthleteProfile
  latestVo2max: number | null
}

interface TileData {
  label: string
  unit: string
  value: string | number | undefined
  /** Qualitative verdict on the value: a corner icon, with the verdict itself
   *  as its accessible name - no extra line of text. */
  band?: { label: string; tone: VerdictTone }
}

// Shape carries the meaning, color reinforces it - a check and a triangle stay
// distinguishable where two tinted dots would not (color vision deficiency).
const TONE_ICON: Record<VerdictTone, { Icon: LucideIcon; className: string }> = {
  success: { Icon: CircleCheck, className: STATUS.success.text },
  neutral: { Icon: Minus, className: STATUS.pending.text },
  warning: { Icon: TriangleAlert, className: STATUS.warning.text },
  danger: { Icon: OctagonAlert, className: STATUS.danger.text },
}

function VerdictIcon({ band }: { band: NonNullable<TileData['band']> }) {
  const { Icon, className } = TONE_ICON[band.tone]
  // The verdict text itself is the icon's accessible name, so nothing is lost
  // for screen readers by dropping the caption.
  return (
    <Icon
      size={12}
      strokeWidth={2.5}
      role="img"
      aria-label={band.label}
      className={cn('absolute right-1.5 top-1.5', className)}
    >
      <title>{band.label}</title>
    </Icon>
  )
}

function Tile({ label, unit, value, band }: TileData) {
  return (
    <div className="relative rounded-xl bg-foreground/[0.04] px-2.5 py-2.5 text-center">
      {value !== undefined && band && <VerdictIcon band={band} />}
      <div className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-extrabold tabular-nums text-foreground">
        {value !== undefined ? (
          <>
            {value}
            <span className="block text-caption font-medium text-subtle">{unit}</span>
          </>
        ) : (
          <span className="block text-caption font-medium text-subtle">{t.profile.athlete.notSet}</span>
        )}
      </div>
    </div>
  )
}

type Category = 'performance' | 'cardio' | 'body'

const CATEGORIES = ['performance', 'cardio', 'body'] as const

// Garmin's fitness age only means something read against the real one, and the
// BMI only against the WHO bands - both carry their verdict as a corner dot.
function fitnessAgeTileBand(athlete: AthleteProfile): TileData['band'] {
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

function bmiTileBand(bmi: number | undefined): TileData['band'] {
  if (bmi === undefined) return undefined
  const band = bmiBand(bmi)
  return { label: t.settings.athlete.bmiBand[band], tone: BMI_BAND_TONE[band] }
}

function tilesFor(category: Category, athlete: AthleteProfile, latestVo2max: number | null): TileData[] {
  const a = t.settings.athlete

  // Each category reads left to right in its own natural order: rising heart
  // rates for cardio, aerobic engine down to the pace it yields for performance.
  if (category === 'cardio') {
    return [
      { label: a.restingHr, unit: t.units.bpm, value: athlete.restingHrBpm },
      { label: a.lthr, unit: t.units.bpm, value: athlete.lthrBpm },
      { label: a.maxHr, unit: t.units.bpm, value: athlete.maxHrBpm },
    ]
  }

  // Two rows that each read as a pair: the ages Garmin grades you on, then the
  // measurements the BMI is derived from.
  if (category === 'body') {
    return [
      { label: a.age, unit: t.units.yrs, value: athlete.age },
      {
        label: a.fitnessAge,
        unit: t.units.yrs,
        value: athlete.fitnessAgeYrs !== undefined ? Math.round(athlete.fitnessAgeYrs) : undefined,
        band: fitnessAgeTileBand(athlete),
      },
      {
        label: a.achievableFitnessAge,
        unit: t.units.yrs,
        value:
          athlete.achievableFitnessAgeYrs !== undefined
            ? Math.round(athlete.achievableFitnessAgeYrs)
            : undefined,
      },
      { label: a.height, unit: t.units.cm, value: athlete.heightCm },
      { label: a.weight, unit: t.units.kg, value: athlete.weightKg },
      { label: a.bmi, unit: '', value: athlete.bmi, band: bmiTileBand(athlete.bmi) },
    ]
  }

  return [
    { label: a.vo2max, unit: t.units.mlKgMin, value: latestVo2max ?? undefined },
    { label: a.vma, unit: t.units.kmh, value: athlete.vmaKmh },
    {
      label: a.thresholdPace,
      unit: t.units.minPerKm,
      value: athlete.thresholdPaceSecPerKm ? formatDuration(athlete.thresholdPaceSecPerKm) : undefined,
    },
  ]
}

export function ProfileAthleteStats({ athlete, latestVo2max }: Props) {
  const a = t.settings.athlete
  const [category, setCategory] = useState<Category>('performance')

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold text-foreground">{a.title}</h2>
        {athlete.lastUpdate && (
          <span className="shrink-0 text-caption text-subtle-2">
            {t.pages.athlete.lastUpdated(formatRelativeAgo(athlete.lastUpdate))}
          </span>
        )}
      </div>

      <div className="mb-3 flex w-full gap-1 rounded-full bg-foreground/[0.04] p-1">
        {CATEGORIES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setCategory(value)}
            className={cn(
              'flex-1 min-h-[44px] rounded-full py-1.5 text-xs font-semibold transition-colors',
              category === value ? 'bg-accent text-accent-foreground' : 'text-foreground/55'
            )}
          >
            {a.categories[value]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {tilesFor(category, athlete, latestVo2max).map((tile) => (
          <Tile key={tile.label} {...tile} />
        ))}
      </div>
    </GlassSurface>
  )
}
