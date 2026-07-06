'use client'

import { useEffect, useRef, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { NotebookPen, X } from 'lucide-react'
import { getClientFirestore, getClientAuth, isClientFirebaseConfigured } from '@/lib/firebase'
import { inputCls } from '@/lib/formStyles'
import { Badge } from '@/components/ui/Card'
import { SaveButton, type SaveState } from '@/components/ui/SaveButton'
import { Toast, useToast } from '@/components/ui/Toast'
import { t } from '@/i18n'

const OWNER_EMAIL = process.env.NEXT_PUBLIC_OWNER_EMAIL ?? ''

const NOTE_MAX_LENGTH = 500
const TAG_MAX_LENGTH = 24
const TAGS_MAX_COUNT = 10

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
  const [open, setOpen] = useState(false)
  const { toast, leaving, showToast } = useToast()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isClientFirebaseConfigured) return
    return onAuthStateChanged(getClientAuth(), setUser)
  }, [])

  useEffect(() => {
    if (!isClientFirebaseConfigured) return
    getDoc(doc(getClientFirestore(), 'activityNotes', activityId)).then((snap) => {
      if (!snap.exists()) return
      const data = snap.data() as ActivityNote
      setSaved(data)
      setDraft(data)
    })
  }, [activityId])

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const isOwner = user !== 'loading' && user?.email === OWNER_EMAIL
  const hasNote = saved.note !== '' || saved.tags.length > 0

  function addTag() {
    const tag = tagInput.trim().slice(0, TAG_MAX_LENGTH)
    setTagInput('')
    if (!tag || draft.tags.includes(tag) || draft.tags.length >= TAGS_MAX_COUNT) return
    setDraft((d) => ({ ...d, tags: [...d.tags, tag] }))
    setSaveState('idle')
  }

  function removeTag(tag: string) {
    setDraft((d) => ({ ...d, tags: d.tags.filter((tg) => tg !== tag) }))
    setSaveState('idle')
  }

  async function handleSave() {
    const pendingTag = tagInput.trim().slice(0, TAG_MAX_LENGTH)
    const tags =
      pendingTag && !draft.tags.includes(pendingTag) && draft.tags.length < TAGS_MAX_COUNT
        ? [...draft.tags, pendingTag]
        : draft.tags
    const toSave: ActivityNote = { ...draft, note: draft.note.slice(0, NOTE_MAX_LENGTH), tags }

    setSaveState('saving')
    try {
      await setDoc(doc(getClientFirestore(), 'activityNotes', activityId), toSave)
      setDraft(toSave)
      setSaved(toSave)
      setTagInput('')
      setSaveState('saved')
      showToast(t.settings.actions.saved, true)
    } catch {
      setSaveState('error')
      showToast(t.settings.actions.error, false)
    }
  }

  if (!isOwner && !hasNote) return null

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-control bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-foreground shadow-lg shadow-accent/30 transition-transform active:scale-95 active:opacity-90"
      >
        <NotebookPen size={16} />
        {t.activity.notes.title}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-xl border border-border bg-card p-3 shadow-lg">
          {isOwner ? (
            <div className="space-y-3">
              <textarea
                value={draft.note}
                onChange={(e) => { setDraft((d) => ({ ...d, note: e.target.value })); setSaveState('idle') }}
                placeholder={t.activity.notes.notePlaceholder}
                maxLength={NOTE_MAX_LENGTH}
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
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        aria-label={t.activity.notes.removeTag(tag)}
                        className="hover:text-destructive"
                      >
                        <X size={16} />
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
                maxLength={TAG_MAX_LENGTH}
                disabled={draft.tags.length >= TAGS_MAX_COUNT}
                className={inputCls}
              />

              <SaveButton state={saveState} onClick={handleSave} />
            </div>
          ) : (
            <div className="space-y-2">
              {saved.note && <p className="text-sm text-foreground">{saved.note}</p>}
              {saved.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {saved.tags.map((tag) => (
                    <Badge key={tag} className="bg-accent/10 text-accent-text">{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Toast toast={toast} leaving={leaving} />
    </div>
  )
}
