'use client'

import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { getClientFirestore } from '@/lib/firebase'
import type { AthleteProfile } from '@/infrastructure/repositories/FirestoreConfigRepository'
import { formatDuration, parseTimeInput } from '@/lib/formatters'
import { inputCls } from '@/lib/formStyles'
import { t } from '@/i18n'
import { cardClass } from '@/components/ui/Card'
import { SaveButton, type SaveState } from '@/components/ui/SaveButton'
import { Toast, useToast } from '@/components/ui/Toast'

export function AthleteForm() {
  const [values, setValues] = useState<AthleteProfile>({})
  const [paceInput, setPaceInput] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const { toast, showToast } = useToast()

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
    <section className={cardClass({ padding: 'none' })}>
      <div className="border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-foreground">{t.settings.athlete.title}</h2>
      </div>
      <form onSubmit={handleSave} className="p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-3">
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

          <Field label={t.settings.athlete.thresholdPower} hint={t.settings.athlete.thresholdPowerHint}>
            <input
              type="number"
              value={values.thresholdPowerWatts ?? ''}
              onChange={(e) => setNum('thresholdPowerWatts', e.target.value)}
              className={inputCls}
              placeholder={p.thresholdPower}
            />
          </Field>
        </div>

        <div className="mt-5">
          <SaveButton state={saveState} type="submit" />
        </div>
      </form>

      <Toast toast={toast} />
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
