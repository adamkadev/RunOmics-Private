'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { isClientFirebaseConfigured } from '@/lib/firebaseConfig'
import { useOwnerAuth } from '@/lib/useOwnerAuth'
import type { SaveState } from '@/components/ui/SaveButton'
import { Toast, useToast } from '@/components/ui/Toast'
import { t } from '@/i18n'
import { EMPTY_NOTE as EMPTY, NOTE_MAX_LENGTH, TAG_MAX_LENGTH, TAGS_MAX_COUNT, type ActivityNote } from './activityNote'

const SUGGESTED_TAGS_MAX = 12

const NotesSheet = dynamic(() => import('./ActivityNotesSheet').then((m) => m.NotesSheet), { ssr: false })

/**
 * Firestore, loaded on first use. Only the owner writes, and only the owner
 * lists tags, so the SDK stays out of the activity page's first load.
 */
async function notesStore() {
  const [firestore, { getClientFirestore }] = await Promise.all([import('firebase/firestore'), import('@/lib/firebase')])
  return { firestore, db: getClientFirestore() }
}

/**
 * The note, through the app (design review, Oct 2026): a private site's gate
 * then covers it, and Firestore lets only the owner read notes directly. A
 * server without the admin credentials answers `available: false`, and the
 * owner - whom the rules still let in - reads it straight from Firestore, so
 * an editor never opens empty over a note it could not fetch.
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
  const [activityInState, setActivityInState] = useState(activityId)
  const { toast, leaving, showToast } = useToast()

  // ActivityNav navigates with a <Link>, so this stays mounted and only the
  // prop changes. Resetting during render rather than in an effect means the
  // previous activity's note is never painted under the new run's header.
  function showNewActivity() {
    setActivityInState(activityId)
    setSaved(EMPTY)
    setDraft(EMPTY)
    setTagInput('')
    setSaveState('idle')
    setOpen(false)
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

  // A row on the activity, always there: the note is the one thing here the
  // user writes, and it had no visible way in - the button hid itself from
  // anyone signed out, and sat in the title row when it did show.
  const preview = saved.note || saved.tags.join(' · ')
  const r = t.activity.noteRow
  const canOpen = isOwner || hasNote

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!canOpen}
        aria-haspopup={canOpen ? 'dialog' : undefined}
        data-testid="note-row"
        className="flex min-h-11 w-full items-center justify-between gap-3 border-t border-border text-left text-sm disabled:cursor-default"
      >
        {/* A detail row (v4.17): the name muted, the value in ink; adding one
            is an action, so it is the accent link. */}
        <span className="shrink-0 text-muted-foreground">{r.label}</span>
        {hasNote ? (
          <span className="min-w-0 truncate text-foreground">{preview} ›</span>
        ) : isOwner ? (
          <span className="font-medium text-accent-text">{r.add}</span>
        ) : (
          <span className="text-subtle">{r.none}</span>
        )}
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
