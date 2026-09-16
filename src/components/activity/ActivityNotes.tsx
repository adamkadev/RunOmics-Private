'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { NotebookPen, Plus, X } from 'lucide-react'
import { getClientFirestore, isClientFirebaseConfigured } from '@/lib/firebase'
import { useOwnerAuth } from '@/lib/useOwnerAuth'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { useScrollLock } from '@/lib/useScrollLock'
import { inputCls } from '@/lib/formStyles'
import { StatusPill } from '@/components/ui/StatusPill'
import { SaveButton, type SaveState } from '@/components/ui/SaveButton'
import { Toast, useToast } from '@/components/ui/Toast'
import { t } from '@/i18n'

const NOTE_MAX_LENGTH = 500
const TAG_MAX_LENGTH = 24
const TAGS_MAX_COUNT = 10
const SUGGESTED_TAGS_MAX = 12

interface ActivityNote {
  note: string
  tags: string[]
}

const EMPTY: ActivityNote = { note: '', tags: [] }

function rankTagsByUse(all: string[][]): string[] {
  const counts = new Map<string, number>()
  for (const tags of all) {
    for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort(([tagA, a], [tagB, b]) => b - a || tagA.localeCompare(tagB))
    .slice(0, SUGGESTED_TAGS_MAX)
    .map(([tag]) => tag)
}

export function ActivityNotes({ activityId }: { activityId: string }) {
  const { isOwner } = useOwnerAuth()
  const [saved, setSaved] = useState<ActivityNote>(EMPTY)
  const [draft, setDraft] = useState<ActivityNote>(EMPTY)
  const [tagInput, setTagInput] = useState('')
  const [knownTags, setKnownTags] = useState<string[] | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [open, setOpen] = useState(false)
  const { toast, leaving, showToast } = useToast()

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
    if (!open || !isOwner || knownTags !== null || !isClientFirebaseConfigured) return
    getDocs(collection(getClientFirestore(), 'activityNotes'))
      .then((snap) => setKnownTags(rankTagsByUse(snap.docs.map((d) => (d.data() as ActivityNote).tags ?? []))))
      .catch(() => setKnownTags([]))
  }, [open, isOwner, knownTags])

  const hasNote = saved.note !== '' || saved.tags.length > 0

  const cancel = useCallback(() => {
    setDraft(saved)
    setTagInput('')
    setSaveState('idle')
    setOpen(false)
  }, [saved])

  function addTag(tag: string) {
    const clean = tag.trim().slice(0, TAG_MAX_LENGTH)
    if (!clean || draft.tags.includes(clean) || draft.tags.length >= TAGS_MAX_COUNT) return
    setDraft((d) => ({ ...d, tags: [...d.tags, clean] }))
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
      setKnownTags(null)
      showToast(t.settings.actions.saved, true)
      setOpen(false)
    } catch {
      setSaveState('error')
      showToast(t.settings.actions.error, false)
    }
  }

  if (!isOwner && !hasNote) return null

  return (
    <div className="shrink-0">
      <button
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-1.5 rounded-control bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-foreground shadow-lg shadow-accent/30 transition-transform active:scale-95 active:opacity-90"
      >
        <NotebookPen size={16} />
        {t.activity.notes.title}
      </button>

      {open && (
        <NotesSheet
          isOwner={isOwner}
          saved={saved}
          draft={draft}
          tagInput={tagInput}
          knownTags={knownTags}
          saveState={saveState}
          onCancel={cancel}
          onNoteChange={(note) => { setDraft((d) => ({ ...d, note })); setSaveState('idle') }}
          onTagInput={setTagInput}
          onAddTag={addTag}
          onRemoveTag={removeTag}
          onSave={handleSave}
        />
      )}

      <Toast toast={toast} leaving={leaving} />
    </div>
  )
}

interface SheetProps {
  isOwner: boolean
  saved: ActivityNote
  draft: ActivityNote
  tagInput: string
  knownTags: string[] | null
  saveState: SaveState
  onCancel: () => void
  onNoteChange: (note: string) => void
  onTagInput: (value: string) => void
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  onSave: () => void
}

function NotesSheet({
  isOwner,
  saved,
  draft,
  tagInput,
  knownTags,
  saveState,
  onCancel,
  onNoteChange,
  onTagInput,
  onAddTag,
  onRemoveTag,
  onSave,
}: SheetProps) {
  const trapRef = useFocusTrap<HTMLDivElement>()

  useScrollLock()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onCancel])

  const suggestions = (knownTags ?? []).filter((tag) => !draft.tags.includes(tag))
  const atTagLimit = draft.tags.length >= TAGS_MAX_COUNT

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t.activity.notes.sheetTitle}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onCancel} />

      <div
        ref={trapRef}
        className="relative w-full animate-sheet-up rounded-t-card-sm border-t border-border bg-card pb-[calc(0.75rem+var(--safe-bottom))] sm:max-w-sm sm:rounded-card-sm sm:border sm:pb-3"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="text-left text-sm font-medium text-muted-foreground transition-opacity active:opacity-60"
          >
            {t.settings.actions.confirmCancel}
          </button>
          <h2 className="truncate text-sm font-semibold text-foreground">{t.activity.notes.sheetTitle}</h2>
          {isOwner ? <SaveButton state={saveState} onClick={onSave} /> : <span aria-hidden />}
        </div>

        {isOwner ? (
          <div className="space-y-3 p-3">
            <textarea
              value={draft.note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder={t.activity.notes.notePlaceholder}
              maxLength={NOTE_MAX_LENGTH}
              rows={4}
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
                      onClick={() => onRemoveTag(tag)}
                      aria-label={t.activity.notes.removeTag(tag)}
                      className="hover:text-destructive"
                    >
                      <X size={16} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {suggestions.length > 0 && !atTagLimit && (
              <div>
                <p className="mb-1.5 text-micro font-semibold uppercase tracking-wide text-subtle">
                  {t.activity.notes.usedBefore}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onAddTag(tag)}
                      aria-label={t.activity.notes.addTag(tag)}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:border-accent hover:text-accent-text"
                    >
                      <Plus size={12} />
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => onTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    onAddTag(tagInput)
                    onTagInput('')
                  }
                }}
                placeholder={t.activity.notes.tagPlaceholder}
                maxLength={TAG_MAX_LENGTH}
                disabled={atTagLimit}
                className={inputCls}
              />
              <p className="mt-1 text-micro text-subtle">{t.activity.notes.tagHint}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2 p-3">
            {saved.note && <p className="text-sm text-foreground">{saved.note}</p>}
            {saved.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {saved.tags.map((tag) => (
                  <StatusPill key={tag} tone="accent">{tag}</StatusPill>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
