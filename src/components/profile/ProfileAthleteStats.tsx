'use client'

import { useState } from 'react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { formatDuration } from '@/lib/formatters'
import type { AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { formatRelativeAgo } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface Props {
  athlete: AthleteProfile
  latestVo2max: number | null
}

// Read-only tiles - values are hand-edited (or Garmin-synced) in public/data/athlete.json,
// not editable from the app.
function Tile({ label, unit, value }: { label: string; unit: string; value: string | number | undefined }) {
  return (
    <div className="rounded-xl px-2.5 py-2.5 text-center" style={{ background: 'rgba(0,0,0,0.25)' }}>
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

function tilesFor(category: Category, athlete: AthleteProfile, latestVo2max: number | null) {
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

  if (category === 'body') {
    return [
      { label: a.age, unit: t.units.yrs, value: athlete.age },
      { label: a.height, unit: t.units.cm, value: athlete.heightCm },
      { label: a.weight, unit: t.units.kg, value: athlete.weightKg },
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
      <h2 className="mb-3 text-sm font-bold text-foreground">{a.title}</h2>

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

      {athlete.lastUpdate && (
        <div className="mt-4 border-t border-foreground/[0.06] pt-3.5 text-xs leading-snug text-muted-foreground">
          {t.pages.athlete.lastUpdated(formatRelativeAgo(athlete.lastUpdate))}
        </div>
        )}
    </GlassSurface>
  )
}
