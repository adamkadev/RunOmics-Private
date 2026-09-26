'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X } from 'lucide-react'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { useScrollLock } from '@/lib/useScrollLock'
import { inputCls } from '@/lib/formStyles'
import { StatusPill } from '@/components/ui/StatusPill'
import { SaveButton, type SaveState } from '@/components/ui/SaveButton'
import { t } from '@/i18n'
import { NOTE_MAX_LENGTH, TAG_MAX_LENGTH, TAGS_MAX_COUNT, type ActivityNote } from './activityNote'

// Loaded when the sheet first opens, never with the page: a visitor who never
// taps Notes does not download the editor.
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

export function NotesSheet({
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
      className="fixed inset-x-0 bottom-0 top-[var(--safe-top)] z-50 flex items-end sm:items-center sm:justify-center sm:p-4"
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
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--segmented-track)] px-2.5 py-0.5 text-xs font-medium text-accent-text"
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
                <p className="mb-1.5 text-caption font-semibold uppercase tracking-wide text-subtle">
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
              <p className="mt-1 text-caption text-subtle">{t.activity.notes.tagHint}</p>
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
