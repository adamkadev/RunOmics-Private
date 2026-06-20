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
        'rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50',
        state === 'error' ? 'bg-red-500 text-white hover:bg-red-600' :
        'bg-accent text-accent-foreground hover:bg-accent/90'
      )}
    >
      {label}
    </button>
  )
}
