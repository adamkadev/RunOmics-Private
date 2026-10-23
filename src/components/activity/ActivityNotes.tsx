'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { isClientFirebaseConfigured } from '@/lib/firebaseConfig'
import { useOwnerAuth } from '@/lib/useOwnerAuth'
import type { SaveState } from '@/components/ui/SaveButton'
import { Toast, useToast } from '@/components/ui/Toast'
import { Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { RUN_CHIP_CLASS } from './RunVerdict'
import { EMPTY_NOTE as EMPTY, NOTE_MAX_LENGTH, TAG_MAX_LENGTH, TAGS_MAX_COUNT, type ActivityNote } from './activityNote'

const SUGGESTED_TAGS_MAX = 12

const NotesSheet = dynamic(() => import('./ActivityNotesSheet').then((m) => m.NotesSheet), { ssr: false })

/** Loaded on first use: only the owner writes and lists tags, so the SDK stays out of the page's first load. */
async function notesStore() {
  const [firestore, { getClientFirestore }] = await Promise.all([import('firebase/firestore'), import('@/lib/firebase')])
  return { firestore, db: getClientFirestore() }
}

/**
 * Through the app, so a private site's gate covers the note. A server without
 * the admin credentials answers `available: false`, and the owner, whom the
 * Firestore rules still let in, reads it directly.
 */
async function readNote(activityId: string): Promise<ActivityNote | null> {
  const response = await fetch(`/api/activities/${encodeURIComponent(activityId)}/note`)
  if (!response.ok) return null
  const data = (await response.json()) as ({ available: true } & ActivityNote) | { available: false }
  if (data.available) return data.note !== '' || data.tags.length > 0 ? { note: data.note, tags: data.tags } : null
  if (!isClientFirebaseConfigured) return null
  const { firestore: { doc, getDoc }, db } = await notesStore()
  const snap = await getDoc(doc(db, 'activityNotes', activityId))
  return snap.exists() ? (snap.data() as ActivityNote) : null
}

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
  const [expanded, setExpanded] = useState(false)
  const [activityInState, setActivityInState] = useState(activityId)
  const { toast, leaving, showToast } = useToast()

  // ActivityNav's <Link> keeps this mounted: resetting during render, not in an
  // effect, never paints the previous run's note under the new run's header.
  function showNewActivity() {
    setActivityInState(activityId)
    setSaved(EMPTY)
    setDraft(EMPTY)
    setTagInput('')
    setSaveState('idle')
    setOpen(false)
    setExpanded(false)
    // knownTags deliberately survives: tags are shared across every note.
  }

  if (activityInState !== activityId) showNewActivity()

  useEffect(() => {
    // Navigation can outrun the read; without this the slower one wins.
    let cancelled = false
    readNote(activityId)
      .then((data) => {
        if (cancelled || !data) return
        setSaved(data)
        setDraft(data)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [activityId])

  useEffect(() => {
    if (!open || !isOwner || knownTags !== null || !isClientFirebaseConfigured) return
    notesStore()
      .then(({ firestore: { collection, getDocs }, db }) => getDocs(collection(db, 'activityNotes')))
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
      const { firestore: { doc, setDoc }, db } = await notesStore()
      await setDoc(doc(db, 'activityNotes', activityId), toSave)
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

  const r = t.activity.noteRow
  if (!hasNote && !isOwner) return null

  return (
    <>
      <button
        type="button"
        onClick={() => (hasNote ? setExpanded((v) => !v) : setOpen(true))}
        aria-expanded={hasNote ? expanded : undefined}
        aria-haspopup={hasNote ? undefined : 'dialog'}
        data-testid="note-row"
        className={cn(RUN_CHIP_CLASS, !hasNote && 'font-medium text-accent-text')}
      >
        <Pencil size={12} strokeWidth={2} aria-hidden="true" />
        {hasNote ? r.label : r.add}
      </button>

      {hasNote && expanded && (
        <div className="flex basis-full flex-col gap-1.5 rounded-lg bg-background px-3 py-2.5 text-sm" data-testid="note-text">
          {saved.note && <p className="whitespace-pre-line text-foreground">{saved.note}</p>}
          {saved.tags.length > 0 && <p className="text-xs text-muted-foreground">{saved.tags.join(' · ')}</p>}
          {isOwner && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              className="hit-44 self-start text-[13px] font-medium text-accent-text"
            >
              {r.edit}
            </button>
          )}
        </div>
      )}

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
    </>
  )
}
