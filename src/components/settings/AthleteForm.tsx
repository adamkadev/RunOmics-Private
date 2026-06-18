'use client'

import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { getClientFirestore } from '@/lib/firebase'
import type { AthleteProfile } from '@/infrastructure/repositories/FirestoreConfigRepository'
import { t } from '@/i18n'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function AthleteForm() {
  const [values, setValues] = useState<AthleteProfile>({})
  const [saveState, setSaveState] = useState<SaveState>('idle')

  useEffect(() => {
    const db = getClientFirestore()
    getDoc(doc(db, 'athlete', 'profile')).then((snap) => {
      if (snap.exists()) setValues(snap.data() as AthleteProfile)
    })
  }, [])

  function set(key: keyof AthleteProfile, raw: string) {
    const n = raw === '' ? undefined : Number(raw)
    setValues((prev) => ({ ...prev, [key]: n }))
    setSaveState('idle')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaveState('saving')
    try {
      const db = getClientFirestore()
      await setDoc(doc(db, 'athlete', 'profile'), values)
      setSaveState('saved')
    } catch {
      setSaveState('error')
    }
  }

  const fields: { key: keyof AthleteProfile; label: string; hint: string }[] = [
    { key: 'lthrBpm', label: t.settings.athlete.lthr, hint: t.settings.athlete.lthrHint },
    { key: 'thresholdPaceSecPerKm', label: t.settings.athlete.thresholdPace, hint: t.settings.athlete.thresholdPaceHint },
    { key: 'thresholdPowerWatts', label: t.settings.athlete.thresholdPower, hint: '' },
    { key: 'weightKg', label: t.settings.athlete.weightKg, hint: '' },
  ]

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{t.settings.athlete.title}</h2>
      <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2">
        {fields.map(({ key, label, hint }) => (
          <div key={key} className="space-y-1">
            <label className="text-sm font-medium text-foreground">{label}</label>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
            <input
              type="number"
              value={values[key] ?? ''}
              onChange={(e) => set(key, e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
            />
          </div>
        ))}
        <div className="sm:col-span-2">
          <SaveButton state={saveState} />
        </div>
      </form>
    </section>
  )
}

function SaveButton({ state }: { state: SaveState }) {
  const label =
    state === 'saving' ? t.settings.actions.saving :
    state === 'saved' ? t.settings.actions.saved :
    state === 'error' ? t.settings.actions.error :
    t.settings.actions.save

  return (
    <button
      type="submit"
      disabled={state === 'saving'}
      className="rounded-md bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-50"
    >
      {label}
    </button>
  )
}
