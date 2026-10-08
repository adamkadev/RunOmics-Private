import { cn } from '@/lib/utils'
import { t } from '@/i18n'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface Props {
  state: SaveState
  onClick?: () => void
  type?: 'button' | 'submit'
}

export function SaveButton({ state, onClick, type = 'button' }: Props) {
  const label =
    state === 'saving' ? t.settings.actions.saving :
    state === 'saved'  ? t.settings.actions.saved  :
    state === 'error'  ? t.settings.actions.error  :
    t.settings.actions.save

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={state === 'saving'}
      // Drawn at 36 pt, tapped at 44 (design review, Oct 2026).
      className={cn(
        'hit-44 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50',
        state === 'error' ? 'bg-destructive text-white hover:bg-destructive/90' :
        'bg-accent text-accent-foreground hover:bg-accent/90'
      )}
    >
      {label}
    </button>
  )
}
