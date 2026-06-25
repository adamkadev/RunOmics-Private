'use client'

import { RotateCcw } from 'lucide-react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { EditableNumber } from '@/components/ui/EditableNumber'
import type { AthleteProfile } from '@/infrastructure/repositories/FirestoreConfigRepository'
import { t } from '@/i18n'

type Bounds = [number, number, number, number]

const DEFAULT_LTHR = 170
const ZONE_PERCENTS = [0.80, 0.89, 0.95, 1.00]

function defaultBounds(lthr: number): Bounds {
  return ZONE_PERCENTS.map((p) => Math.round(lthr * p)) as Bounds
}

const ZONE_COLOR_CLASS: Record<number, string> = {
  1: 'bg-[#a7b1aa] dark:bg-white/55',
  2: 'bg-[#3b82f6] dark:bg-[#7db8ff]',
  3: 'bg-[#0e9f6e] dark:bg-[#2ed9a0]',
  4: 'bg-[#f1761f] dark:bg-[#ff9a5a]',
  5: 'bg-[#ff7676]',
}

interface Props {
  athlete: AthleteProfile
  onSave: (patch: Partial<AthleteProfile>) => void
}

export function ProfileHrZones({ athlete, onSave }: Props) {
  const lthr = athlete.lthrBpm ?? DEFAULT_LTHR
  const bounds = athlete.hrZoneBoundsBpm ?? defaultBounds(lthr)

  function setBound(index: number, n: number) {
    const next = [...bounds] as Bounds
    next[index] = n
    onSave({ hrZoneBoundsBpm: next })
  }

  const zones = [
    { zone: 5, min: bounds[3], max: null, editableIndex: null },
    { zone: 4, min: bounds[2], max: bounds[3], editableIndex: 3 },
    { zone: 3, min: bounds[1], max: bounds[2], editableIndex: 2 },
    { zone: 2, min: bounds[0], max: bounds[1], editableIndex: 1 },
    { zone: 1, min: 0, max: bounds[0], editableIndex: 0 },
  ]

  return (
    <GlassSurface variant="card" className="rounded-[22px] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">{t.profile.hrZones.title}</h2>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <span>{t.profile.hrZones.lthr}</span>
          <EditableNumber
            value={lthr}
            onCommit={(n) => onSave({ lthrBpm: n })}
            className="text-xs font-bold text-[#ff7676]"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {zones.map(({ zone, min, max, editableIndex }) => (
          <div key={zone} className="flex items-center gap-2.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${ZONE_COLOR_CLASS[zone]}`} aria-hidden="true" />
            <span className="w-28 shrink-0 text-xs font-semibold text-foreground/80">
              {t.activity.zones.labels[zone]}
            </span>
            <span className="flex-1 text-xs text-muted-foreground">
              {zone === 1 && `< ${max} bpm`}

              {zone !== 1 && zone !== 5 && (
                <>
                  {min}–{editableIndex !== null ? (
                    <EditableNumber
                      value={max}
                      onCommit={(n) => setBound(editableIndex, n)}
                    />
                  ) : (
                    max
                  )}{' '}
                  bpm
                </>
              )}
              {zone === 5 && `≥ ${min} bpm`}
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onSave({ hrZoneBoundsBpm: defaultBounds(lthr) })}
        className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-accent-text active:opacity-60"
      >
        <RotateCcw size={16} />
        {t.profile.hrZones.recalculate}
      </button>
    </GlassSurface>
  )
}
