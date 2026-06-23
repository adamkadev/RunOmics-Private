'use client'

import { useRef, useState } from 'react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { EditableNumber } from '@/components/ui/EditableNumber'
import { formatDuration, parseTimeInput } from '@/lib/formatters'
import type { AthleteProfile } from '@/infrastructure/repositories/FirestoreConfigRepository'
import { t } from '@/i18n'

interface Props {
  athlete: AthleteProfile
  onSave: (patch: Partial<AthleteProfile>) => void
}

/** Tap-to-edit pace (mm:ss/km), mirrors EditableNumber but for a duration string. */
function EditablePace({ value, onCommit }: { value: number | undefined; onCommit: (n: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ? formatDuration(value) : '')
  const ref = useRef<HTMLInputElement>(null)

  if (editing) {
    return (
      <input
        ref={ref}
        type="text"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false)
          const parsed = parseTimeInput(draft)
          if (parsed) onCommit(parsed)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') ref.current?.blur()
          if (e.key === 'Escape') setEditing(false)
        }}
        className="w-16 rounded-md border border-border bg-background px-1 py-0.5 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => { setDraft(value ? formatDuration(value) : ''); setEditing(true) }}
      className="font-bold text-foreground"
    >
      {value ? formatDuration(value) : t.settings.athlete.placeholders.thresholdPace}
    </button>
  )
}

export function ProfileAthleteStats({ athlete, onSave }: Props) {
  const a = t.settings.athlete

  const rows = [
    {
      label: a.lthr,
      value: <EditableNumber value={athlete.lthrBpm ?? 0} onCommit={(n) => onSave({ lthrBpm: n })} className="font-bold text-foreground" />,
      unit: t.units.bpm,
    },
    {
      label: a.thresholdPace,
      value: <EditablePace value={athlete.thresholdPaceSecPerKm} onCommit={(n) => onSave({ thresholdPaceSecPerKm: n })} />,
      unit: t.units.minPerKm,
    },
    {
      label: a.thresholdPower,
      value: <EditableNumber value={athlete.thresholdPowerWatts ?? 0} onCommit={(n) => onSave({ thresholdPowerWatts: n })} className="font-bold text-foreground" />,
      unit: 'W',
    },
    {
      label: a.vma,
      value: <EditableNumber value={athlete.vmaKmh ?? 0} onCommit={(n) => onSave({ vmaKmh: n })} className="font-bold text-foreground" />,
      unit: 'km/h',
    },
  ]

  return (
    <GlassSurface variant="card" className="rounded-[22px] p-5">
      <h2 className="mb-3 text-sm font-bold text-foreground">{a.title}</h2>
      <div className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-foreground/80">{row.label}</span>
            <span className="flex items-baseline gap-1 text-muted-foreground">
              {row.value}
              {row.unit}
            </span>
          </div>
        ))}
      </div>
    </GlassSurface>
  )
}
