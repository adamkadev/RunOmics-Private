'use client'

import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { getClientFirestore } from '@/lib/firebase'
import type { AthleteProfile } from '@/infrastructure/repositories/FirestoreConfigRepository'
import { formatDuration, parseTimeInput } from '@/lib/formatters'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type Toast = { msg: string; ok: boolean } | null

export function AthleteForm() {
  const [values, setValues] = useState<AthleteProfile>({})
  const [paceInput, setPaceInput] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [toast, setToast] = useState<Toast>(null)

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), ok ? 2000 : 3500)
  }

  useEffect(() => {
    getDoc(doc(getClientFirestore(), 'athlete', 'profile')).then((snap) => {
      if (!snap.exists()) return
      const data = snap.data() as AthleteProfile
      setValues(data)
      if (data.thresholdPaceSecPerKm) setPaceInput(formatDuration(data.thresholdPaceSecPerKm))
    })
  }, [])

  function setNum(key: keyof AthleteProfile, raw: string) {
    const n = raw === '' ? undefined : Number(raw)
    setValues((prev) => ({ ...prev, [key]: n }))
    setSaveState('idle')
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsedPace = parseTimeInput(paceInput)
    const final: AthleteProfile = {
      ...values,
      thresholdPaceSecPerKm: parsedPace ?? values.thresholdPaceSecPerKm,
    }
    setSaveState('saving')
    try {
      await setDoc(doc(getClientFirestore(), 'athlete', 'profile'), final)
      setValues(final)
      setSaveState('saved')
      showToast(t.settings.actions.saved, true)
    } catch {
      setSaveState('error')
      showToast(t.settings.actions.error, false)
    }
  }

  const p = t.settings.athlete.placeholders

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-foreground">{t.settings.athlete.title}</h2>
      </div>
      <form onSubmit={handleSave} className="p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.settings.athlete.lthr} hint={t.settings.athlete.lthrHint}>
            <input
              type="number"
              value={values.lthrBpm ?? ''}
              onChange={(e) => setNum('lthrBpm', e.target.value)}
              className={inputCls}
              placeholder={p.lthr}
            />
          </Field>

          <Field label={t.settings.athlete.thresholdPace} hint={t.settings.athlete.thresholdPaceHint}>
            <input
              type="text"
              value={paceInput}
              onChange={(e) => { setPaceInput(e.target.value); setSaveState('idle') }}
              className={inputCls}
              placeholder={p.thresholdPace}
            />
          </Field>

          <Field label={t.settings.athlete.thresholdPower} hint="">
            <input
              type="number"
              value={values.thresholdPowerWatts ?? ''}
              onChange={(e) => setNum('thresholdPowerWatts', e.target.value)}
              className={inputCls}
              placeholder={p.thresholdPower}
            />
          </Field>

          <Field label={t.settings.athlete.weightKg} hint="">
            <input
              type="number"
              value={values.weightKg ?? ''}
              onChange={(e) => setNum('weightKg', e.target.value)}
              className={inputCls}
              placeholder={p.weightKg}
            />
          </Field>
        </div>

        <div className="mt-5">
          <SaveButton state={saveState} />
        </div>
      </form>

      {toast && (
        <div className={cn(
          'fixed bottom-4 right-4 z-50 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-lg',
          toast.ok ? 'bg-emerald-600' : 'bg-red-500'
        )}>
          {toast.msg}
        </div>
      )}
    </section>
  )
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500'

function SaveButton({ state }: { state: SaveState }) {
  const label =
    state === 'saving' ? t.settings.actions.saving :
    state === 'saved'  ? t.settings.actions.saved  :
    state === 'error'  ? t.settings.actions.error  :
    t.settings.actions.save

  return (
    <button
      type="submit"
      disabled={state === 'saving'}
      className={cn(
        'rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50',
        state === 'saved'  ? 'bg-green-500 hover:bg-green-600' :
        state === 'error'  ? 'bg-red-500 hover:bg-red-600'    :
        'bg-emerald-600 hover:bg-emerald-700'
      )}
    >
      {label}
    </button>
  )
}
