import { runTypeColor } from '@/lib/colors'
import { cn } from '@/lib/utils'

/**
 * A session type's category dot (v4.17): its zone's colour, 8 px. A race is
 * the zone of its effort drawn outline only - a 1.5 px ring, never filled -
 * so it reads as "a race" without spending a colour of its own.
 */
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
