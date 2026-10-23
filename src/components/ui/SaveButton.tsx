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
      className={cn(
        'hit-44 h-11 rounded-full px-4 text-[17px] font-semibold transition-colors disabled:opacity-50',
        state === 'error' ? 'bg-destructive text-white hover:bg-destructive/90' :
        'bg-accent text-accent-foreground hover:bg-accent/90'
      )}
    >
      {label}
    </button>
  )
}
