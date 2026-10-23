'use client'

import { Plus, X } from 'lucide-react'
import { inputCls } from '@/lib/formStyles'
import { Sheet } from '@/components/ui/Sheet'
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
  const suggestions = (knownTags ?? []).filter((tag) => !draft.tags.includes(tag))
  const atTagLimit = draft.tags.length >= TAGS_MAX_COUNT

  return (
    <Sheet
      onClose={onCancel}
      title={t.activity.notes.sheetTitle}
      titleId="activity-notes-title"
      trailing={isOwner ? <SaveButton state={saveState} onClick={onSave} /> : undefined}
    >
        {isOwner ? (
          <div className="space-y-3 pt-3">
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
                    className="inline-flex h-8 items-center gap-1 rounded-full bg-[var(--fill-3)] pl-3 pr-2 text-[13px] font-medium text-accent-text"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => onRemoveTag(tag)}
                      aria-label={t.activity.notes.removeTag(tag)}
                      className="hit-44 hover:text-destructive"
                    >
                      <X size={16} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {suggestions.length > 0 && !atTagLimit && (
              <div>
                <p className="mb-2.5 text-[13px] font-semibold text-muted-foreground">
                  {t.activity.notes.usedBefore}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onAddTag(tag)}
                      aria-label={t.activity.notes.addTag(tag)}
                      className="hit-44 inline-flex h-8 items-center gap-1 rounded-full bg-[var(--fill-3)] px-3 text-[13px] font-medium text-foreground transition-colors hover:text-accent-text"
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
          <div className="space-y-2 pt-3">
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
    </Sheet>
  )
}
