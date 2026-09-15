'use client'

import { useState } from 'react'
import { CircleCheck, Minus, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react'
import { CardTitle } from '@/components/ui/SectionLabel'
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
  band?: { label: string; tone: VerdictTone }
}

type AvailableTileData = TileData & { value: string | number }

const TONE_ICON: Record<VerdictTone, { Icon: LucideIcon; className: string }> = {
  success: { Icon: CircleCheck, className: STATUS.success.text },
  neutral: { Icon: Minus, className: STATUS.pending.text },
  warning: { Icon: TriangleAlert, className: STATUS.warning.text },
  danger: { Icon: OctagonAlert, className: STATUS.danger.text },
}

function VerdictIcon({ band }: { band: NonNullable<TileData['band']> }) {
  const { Icon, className } = TONE_ICON[band.tone]
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

function Tile({ label, unit, value, band }: AvailableTileData) {
  return (
    <div className="relative rounded-xl bg-foreground/[0.04] px-2.5 py-2.5 text-center">
      {band ? <VerdictIcon band={band} /> : null}
      <div className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-extrabold tabular-nums text-foreground">
        {value}
        <span className="block text-caption font-medium text-subtle">{unit}</span>
      </div>
    </div>
  )
}

type Category = 'performance' | 'cardio' | 'body'

const CATEGORIES = ['performance', 'cardio', 'body'] as const

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

  if (category === 'cardio') {
    return [
      { label: a.restingHr, unit: t.units.bpm, value: athlete.restingHrBpm },
      { label: a.lthr, unit: t.units.bpm, value: athlete.lthrBpm },
      { label: a.maxHr, unit: t.units.bpm, value: athlete.maxHrBpm },
    ]
  }

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
  const availableByCategory = Object.fromEntries(
    CATEGORIES.map((value) => [
      value,
      tilesFor(value, athlete, latestVo2max).filter(
        (tile): tile is AvailableTileData => tile.value !== undefined
      ),
    ])
  ) as Record<Category, AvailableTileData[]>
  const availableCategories = CATEGORIES.filter((value) => availableByCategory[value].length > 0)
  const selectedCategory = availableCategories.includes(category)
    ? category
    : (availableCategories[0] ?? 'performance')
  const tiles = availableByCategory[selectedCategory]
  const gridColumns = tiles.length === 1 ? 'grid-cols-1' : tiles.length === 2 ? 'grid-cols-2' : 'grid-cols-3'

  if (availableCategories.length === 0) return null

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <CardTitle as="h2">{a.title}</CardTitle>
        {athlete.lastUpdate && (
          <span className="shrink-0 text-caption text-subtle-2">
            {t.pages.athlete.lastUpdated(formatRelativeAgo(athlete.lastUpdate))}
          </span>
        )}
      </div>

      <div className="mb-3 flex w-full gap-1 rounded-full bg-foreground/[0.04] p-1">
        {availableCategories.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setCategory(value)}
            className={cn(
              'flex-1 min-h-[44px] rounded-full py-1.5 text-xs font-semibold transition-colors',
              selectedCategory === value ? 'bg-accent text-accent-foreground' : 'text-foreground/55'
            )}
          >
            {a.categories[value]}
          </button>
        ))}
      </div>

      <div className={cn('grid gap-2', gridColumns)}>
        {tiles.map((tile) => (
          <Tile key={tile.label} {...tile} />
        ))}
      </div>
    </GlassSurface>
  )
}
