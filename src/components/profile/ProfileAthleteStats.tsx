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
        className="w-16 rounded-md border border-border bg-background px-1 py-0.5 text-center text-base font-extrabold tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => { setDraft(value ? formatDuration(value) : ''); setEditing(true) }}
      className="text-base font-extrabold tabular-nums text-foreground"
    >
      {value ? formatDuration(value) : t.settings.athlete.placeholders.thresholdPace}
    </button>
  )
}

// Tap-to-edit threshold tiles - same dark-tile language as the stat rows on
// Plan and the shoe pages, one number per tile.
function Tile({ label, unit, children }: { label: string; unit: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl px-2.5 py-2.5 text-center" style={{ background: 'rgba(0,0,0,0.25)' }}>
      <div className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-extrabold tabular-nums text-foreground">
        {children}
        <span className="ml-1 text-caption font-medium text-subtle">{unit}</span>
      </div>
    </div>
  )
}

export function ProfileAthleteStats({ athlete, onSave }: Props) {
  const a = t.settings.athlete

  return (
    <GlassSurface variant="card" className="p-5">
      <h2 className="mb-3 text-sm font-bold text-foreground">{a.title}</h2>
      <div className="grid grid-cols-2 gap-2">
        <Tile label={a.lthr} unit={t.units.bpm}>
          <EditableNumber value={athlete.lthrBpm ?? 0} onCommit={(n) => onSave({ lthrBpm: n })} className="text-base font-extrabold text-foreground" />
        </Tile>
        <Tile label={a.thresholdPace} unit={t.units.minPerKm}>
          <EditablePace value={athlete.thresholdPaceSecPerKm} onCommit={(n) => onSave({ thresholdPaceSecPerKm: n })} />
        </Tile>
        <Tile label={a.thresholdPower} unit="W">
          <EditableNumber value={athlete.thresholdPowerWatts ?? 0} onCommit={(n) => onSave({ thresholdPowerWatts: n })} className="text-base font-extrabold text-foreground" />
        </Tile>
        <Tile label={a.vma} unit="km/h">
          <EditableNumber value={athlete.vmaKmh ?? 0} onCommit={(n) => onSave({ vmaKmh: n })} className="text-base font-extrabold text-foreground" />
        </Tile>
      </div>
    </GlassSurface>
  )
}
