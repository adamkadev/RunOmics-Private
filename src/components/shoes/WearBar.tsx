import { cn } from '@/lib/utils'
import { RETIRE_FROM_WORKOUTS_SHARE, WEAR_COLOR, shoeWearStatus } from './shoeWear'

/**
 * A pair's wear against its limit (C4, v4.4b; v4.17): the accent while it has
 * life in it, warn from Replace soon, neg from Replace, with a tick where it
 * is retired from workouts - the pair's own threshold. Past the limit the bar
 * is scaled to the km run, so the tick moves in and the overrun shows. A
 * retired pair's bar is full and muted.
 */
export function WearBar({
  totalKm,
  maxKm,
  tickKm,
  retired = false,
  size = 'sm',
  className,
}: {
  totalKm: number
  maxKm: number
  /** The retire-from-workouts threshold; 80% of the limit when unset. */
  tickKm?: number
  retired?: boolean
  /** sm 6 pt (the list), md 8 pt (a pair's own page). */
  size?: 'sm' | 'md'
  className?: string
}) {
  const scale = Math.max(totalKm, maxKm, 1)
  const status = shoeWearStatus({ totalKm, maxKm })
  const fill = retired ? 100 : (totalKm / scale) * 100
  const threshold = tickKm ?? maxKm * RETIRE_FROM_WORKOUTS_SHARE
  const tick = maxKm > 0 && !retired ? (threshold / scale) * 100 : null

  return (
    <div
      className={cn('relative rounded-full bg-[var(--surface-2)]', size === 'md' ? 'h-2' : 'h-1.5', className)}
      data-testid="wear-bar"
      data-tone={retired ? 'retired' : status}
    >
      <span
        className="absolute inset-y-0 left-0 rounded-full"
        data-testid="wear-fill"
        style={{ width: `${fill}%`, background: retired ? 'var(--muted-foreground)' : WEAR_COLOR[status] }}
      />
      {tick !== null && (
        <span
          aria-hidden
          data-testid="wear-tick"
          className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-[var(--text-2)]"
          style={{ left: `${tick}%` }}
        />
      )}
    </div>
  )
}
