'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Toast, useToast } from '@/components/ui/Toast'
import { useOwnerAuth } from '@/lib/useOwnerAuth'
import { readRunShoe, writeRunShoe } from '@/lib/shoeChoices'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { RUN_CHIP_CLASS } from './RunVerdict'

const RunShoeSheet = dynamic(() => import('./RunShoeSheet').then((m) => m.RunShoeSheet), { ssr: false })

export interface ShoeOption {
  gearId: string
  name: string
  dotColor: string
}

interface Props {
  activityId: string
  /** The shoe the figures count this run toward, as of the last sync. */
  shoe: (ShoeOption & { source?: 'choice' | 'default' }) | null
  /** The active shoes the owner can pick from; empty for an athlete without any. */
  options: ShoeOption[]
  /** Where a visitor changes the shoe: the run in Garmin Connect, when it has one there. */
  garminUrl: string | null
}

export function RunShoe({ activityId, shoe, options, garminUrl }: Props) {
  const { isOwner } = useOwnerAuth()
  const [shown, setShown] = useState(shoe)
  const [picked, setPicked] = useState(shoe?.source === 'choice')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activityInState, setActivityInState] = useState(activityId)
  const { toast, leaving, showToast } = useToast()
  const canPick = isOwner && options.length > 0

  if (activityInState !== activityId) {
    setActivityInState(activityId)
    setShown(shoe)
    setPicked(shoe?.source === 'choice')
    setOpen(false)
  }

  // Firestore has today's pick before the nightly copy does.
  useEffect(() => {
    if (!canPick) return
    let cancelled = false
    readRunShoe(activityId)
      .then((gearId) => {
        const option = options.find((o) => o.gearId === gearId)
        if (cancelled || !option) return
        setShown(option)
        setPicked(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [activityId, canPick, options])

  async function pick(gearId: string | null) {
    setSaving(true)
    try {
      await writeRunShoe(activityId, gearId)
      setShown(gearId === null ? (shoe?.source === 'choice' ? null : shoe) : (options.find((o) => o.gearId === gearId) ?? null))
      setPicked(gearId !== null)
      setOpen(false)
      showToast(t.activity.shoe.saved, true)
    } catch {
      showToast(t.settings.actions.error, false)
    } finally {
      setSaving(false)
    }
  }

  const s = t.activity.shoe
  if (canPick) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-label={shown ? s.change(shown.name) : s.add}
          className={cn(RUN_CHIP_CLASS, !shown && 'font-medium text-accent-text')}
          data-testid="run-shoe"
        >
          <span className="truncate">{shown ? shown.name : s.add}</span>
        </button>
        {open && (
          <RunShoeSheet
            options={options}
            selected={shown?.gearId ?? null}
            picked={picked}
            saving={saving}
            onPick={pick}
            onClose={() => setOpen(false)}
          />
        )}
        <Toast toast={toast} leaving={leaving} />
      </>
    )
  }

  if (garminUrl) {
    return (
      <a
        href={garminUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={shown ? s.changeInGarmin(shown.name) : s.addInGarmin}
        className={cn(RUN_CHIP_CLASS, !shown && 'font-medium text-accent-text')}
        data-testid="run-shoe"
      >
        <span className="truncate">{shown ? shown.name : s.add}</span>
      </a>
    )
  }

  return shown ? (
    <span className={RUN_CHIP_CLASS} data-testid="run-shoe">
      <span className="truncate">{shown.name}</span>
    </span>
  ) : null
}
