'use client'

import { useEffect, useState } from 'react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { Toast, useToast } from '@/components/ui/Toast'
import { useOwnerAuth } from '@/lib/useOwnerAuth'
import { readDefaultShoe, writeDefaultShoe } from '@/lib/shoeChoices'
import { t } from '@/i18n'

export interface DefaultShoeOption {
  gearId: string
  name: string
}

/** The owner's alone: a visitor sees the mileage it adds, never the control. */
export function DefaultShoe({ options, initial }: { options: DefaultShoeOption[]; initial: string | null }) {
  const { isOwner } = useOwnerAuth()
  const [gearId, setGearId] = useState(initial)
  const [saving, setSaving] = useState(false)
  const { toast, leaving, showToast } = useToast()
  const show = isOwner && options.length > 0

  // Firestore has today's default before the nightly copy does.
  useEffect(() => {
    if (!show) return
    let cancelled = false
    readDefaultShoe()
      .then((stored) => {
        if (!cancelled) setGearId(stored)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [show])

  async function change(next: string | null) {
    const previous = gearId
    setGearId(next)
    setSaving(true)
    try {
      await writeDefaultShoe(next)
      showToast(t.shoes.defaultShoe.saved, true)
    } catch {
      setGearId(previous)
      showToast(t.settings.actions.error, false)
    } finally {
      setSaving(false)
    }
  }

  if (!show) return null
  const d = t.shoes.defaultShoe
  return (
    <GlassSurface variant="card" className="rounded-card-sm px-5 py-3.5" data-testid="default-shoe">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="default-shoe" className="text-body text-foreground">
          {d.label}
        </label>
        <select
          id="default-shoe"
          value={gearId ?? ''}
          disabled={saving}
          onChange={(event) => void change(event.target.value || null)}
          className="h-9 min-w-0 max-w-[60%] truncate rounded-lg bg-transparent text-right text-[15px] text-foreground"
        >
          <option value="">{d.none}</option>
          {options.map((option) => (
            <option key={option.gearId} value={option.gearId}>
              {option.name}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-1 text-footnote text-muted-foreground">{d.hint}</p>
      <Toast toast={toast} leaving={leaving} />
    </GlassSurface>
  )
}
