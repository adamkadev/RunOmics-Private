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
 * Firestore, loaded on first use. A visitor reads one note after the page has
 * painted and only the owner ever writes, so the SDK stays out of the
 * activity page's first load.
 */
async function notesStore() {
  const [firestore, { getClientFirestore }] = await Promise.all([import('firebase/firestore'), import('@/lib/firebase')])
  return { firestore, db: getClientFirestore() }
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
    if (!isClientFirebaseConfigured) return

    // Navigation can outrun Firestore; without this the slower read wins.
    let cancelled = false
    notesStore()
      .then(({ firestore: { doc, getDoc }, db }) => getDoc(doc(db, 'activityNotes', activityId)))
      .then((snap) => {
        if (cancelled || !snap.exists()) return
        const data = snap.data() as ActivityNote
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
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left text-sm disabled:cursor-default"
      >
        <span className="shrink-0 font-semibold text-foreground">{r.label}</span>
        {hasNote ? (
          <span className="min-w-0 truncate text-muted-foreground">{preview} ›</span>
        ) : isOwner ? (
          <span className="font-semibold text-accent-text">{r.add} ›</span>
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
