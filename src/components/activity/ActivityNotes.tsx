'use client'

import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { X } from 'lucide-react'
import { getClientFirestore, getClientAuth } from '@/lib/firebase'
import { inputCls } from '@/lib/formStyles'
import { cardClass, Badge } from '@/components/ui/Card'
import { SaveButton, type SaveState } from '@/components/ui/SaveButton'
import { Toast, useToast } from '@/components/ui/Toast'
import { t } from '@/i18n'

const OWNER_EMAIL = process.env.NEXT_PUBLIC_OWNER_EMAIL ?? ''

interface ActivityNote {
  note: string
  tags: string[]
}

const EMPTY: ActivityNote = { note: '', tags: [] }

export function ActivityNotes({ activityId }: { activityId: string }) {
  const [user, setUser] = useState<User | null | 'loading'>('loading')
  const [saved, setSaved] = useState<ActivityNote>(EMPTY)
  const [draft, setDraft] = useState<ActivityNote>(EMPTY)
  const [tagInput, setTagInput] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const { toast, showToast } = useToast()

  useEffect(() => onAuthStateChanged(getClientAuth(), setUser), [])

  useEffect(() => {
    getDoc(doc(getClientFirestore(), 'activityNotes', activityId)).then((snap) => {
      if (!snap.exists()) return
      const data = snap.data() as ActivityNote
      setSaved(data)
      setDraft(data)
    })
  }, [activityId])

  const isOwner = user !== 'loading' && user?.email === OWNER_EMAIL

  function addTag() {
    const tag = tagInput.trim()
    setTagInput('')
    if (!tag || draft.tags.includes(tag)) return
    setDraft((d) => ({ ...d, tags: [...d.tags, tag] }))
    setSaveState('idle')
  }

  function removeTag(tag: string) {
    setDraft((d) => ({ ...d, tags: d.tags.filter((tg) => tg !== tag) }))
    setSaveState('idle')
  }

  async function handleSave() {
    setSaveState('saving')
    try {
      await setDoc(doc(getClientFirestore(), 'activityNotes', activityId), draft)
      setSaved(draft)
      setSaveState('saved')
      showToast(t.settings.actions.saved, true)
    } catch {
      setSaveState('error')
      showToast(t.settings.actions.error, false)
    }
  }

  if (!isOwner) {
    if (!saved.note && saved.tags.length === 0) return null
    return (
      <section className={cardClass({ padding: 'base' })}>
        {saved.note && <p className="text-sm text-foreground">{saved.note}</p>}
        {saved.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {saved.tags.map((tag) => (
              <Badge key={tag} className="bg-accent/10 text-accent-text">{tag}</Badge>
            ))}
          </div>
        )}
      </section>
    )
  }

  return (
    <section className={cardClass({ padding: 'none' })}>
      <div className="border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-foreground">{t.activity.notes.title}</h2>
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        <textarea
          value={draft.note}
          onChange={(e) => { setDraft((d) => ({ ...d, note: e.target.value })); setSaveState('idle') }}
          placeholder={t.activity.notes.notePlaceholder}
          rows={3}
          className={inputCls}
        />

        {draft.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {draft.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent-text"
              >
                {tag}
                <button type="button" onClick={() => removeTag(tag)} className="hover:text-destructive">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        <input
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
          placeholder={t.activity.notes.tagPlaceholder}
          className={inputCls}
        />

        <SaveButton state={saveState} onClick={handleSave} />
      </div>

      <Toast toast={toast} />
    </section>
  )
}
