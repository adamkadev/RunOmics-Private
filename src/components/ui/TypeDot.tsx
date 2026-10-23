import { runTypeColor } from '@/lib/colors'
import { cn } from '@/lib/utils'

/** A race is outline only, so it reads as a race without spending a colour of its own. */
export function TypeDot({ type, size = 8, className }: { type: string | null | undefined; size?: number; className?: string }) {
  const color = runTypeColor(type)
  const race = type === 'Race'
  return (
    <span
      aria-hidden
      className={cn('box-border inline-block shrink-0 rounded-full', className)}
      style={{
        width: size,
        height: size,
        background: race ? 'transparent' : color,
        border: race ? `1.5px solid ${color}` : undefined,
      }}
    />
  )
}
