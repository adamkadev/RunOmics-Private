'use client'

import { useEffect, useRef, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { NotebookPen, X } from 'lucide-react'
import { getClientFirestore, getClientAuth } from '@/lib/firebase'
import { inputCls } from '@/lib/formStyles'
import { Badge } from '@/components/ui/Card'
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
  const [open, setOpen] = useState(false)
  const { toast, showToast } = useToast()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => onAuthStateChanged(getClientAuth(), setUser), [])

  useEffect(() => {
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
    const pendingTag = tagInput.trim()
    const tags = pendingTag && !draft.tags.includes(pendingTag) ? [...draft.tags, pendingTag] : draft.tags
    const toSave: ActivityNote = { ...draft, tags }

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
        className="glass-chip inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-medium text-foreground transition-transform active:scale-95 active:opacity-80"
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

      <Toast toast={toast} />
    </div>
  )
}
