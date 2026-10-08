import { cn } from '@/lib/utils'
import { RETIRE_FROM_WORKOUTS_SHARE, WEAR_COLOR, shoeWearStatus } from './shoeWear'

const TICK_COLOR = 'bg-[var(--text-2)]'

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
  tickLabel,
  retired = false,
  size = 'sm',
  className,
}: {
  totalKm: number
  maxKm: number
  /** The retire-from-workouts threshold; 80% of the limit when unset. */
  tickKm?: number
  /** What the tick marks, written under it. */
  tickLabel?: string
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
    <div className={className}>
      <div
        className={cn('relative rounded-full bg-[var(--surface-2)]', size === 'md' ? 'h-2' : 'h-1.5')}
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
            className={cn('absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full', TICK_COLOR)}
            style={{ left: `${tick}%` }}
          />
        )}
      </div>
      {/* The tick, named (design review, Oct 2026): an unlabelled mark at
          800 km said nothing. The label starts under the tick, behind a
          short tick of its own; where it would run past the bar's end the
          spacer gives way first, so it slides left and stays whole. */}
      {tick !== null && tickLabel && (
        <div className="mt-1.5 flex" data-testid="wear-tick-label">
          <span aria-hidden className="min-w-0" style={{ flexBasis: `${tick}%` }} />
          <span className="-ml-px flex shrink-0 items-center gap-1 whitespace-nowrap text-caption leading-none text-muted-foreground">
            <span aria-hidden className={cn('h-2.5 w-0.5 rounded-full', TICK_COLOR)} />
            {tickLabel}
          </span>
        </div>
      )}
    </div>
  )
}
