import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { RETIRE_FROM_WORKOUTS_SHARE, WEAR_COLOR, shoeWearStatus } from './shoeWear'

const TICK_COLOR = 'bg-[var(--text-2)]'
/** A card-coloured edge, so a tick reads on the fill as on the track. */
const TICK_EDGE: CSSProperties = { boxShadow: '0 0 0 1.5px var(--card)' }

/**
 * A pair's wear against its limit (C4, v4.4b; v4.17): the accent while it has
 * life in it, warn from Replace soon, neg from Replace, with a tick where it
 * is retired from workouts - the pair's own threshold. Past the limit the bar
 * is scaled to the km run, so the tick moves in and the overrun shows. A
 * retired pair's bar is full and muted.
 *
 * Past the limit the fill is solid to the limit and hatched beyond, and the
 * limit gets a tick and a label of its own.
 */
export function WearBar({
  totalKm,
  maxKm,
  tickKm,
  tickLabel,
  limitLabel,
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
  /** The limit's tick, named, once the pair has run past it. */
  limitLabel?: string
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
  const limit = maxKm > 0 && !retired && totalKm > maxKm ? (maxKm / scale) * 100 : null
  const color = retired ? 'var(--muted-foreground)' : WEAR_COLOR[status]
  const label = limit !== null && limitLabel ? { at: limit, text: limitLabel, tone: 'text-foreground' } : tick !== null && tickLabel ? { at: tick, text: tickLabel, tone: 'text-muted-foreground' } : null

  return (
    <div className={className}>
      <div
        className={cn('relative rounded-full bg-[var(--line-2)]', size === 'md' ? 'h-2' : 'h-1.5')}
        data-testid="wear-bar"
        data-tone={retired ? 'retired' : status}
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          data-testid="wear-fill"
          style={{ width: `${limit ?? fill}%`, background: color }}
        />
        {limit !== null && (
          <span
            className="absolute inset-y-0 rounded-r-full"
            data-testid="wear-overrun"
            style={{
              left: `${limit}%`,
              width: `${fill - limit}%`,
              background: `repeating-linear-gradient(135deg, ${color} 0 3px, color-mix(in srgb, ${color} 35%, transparent) 3px 6px)`,
            }}
          />
        )}
        {tick !== null && (
          <span
            aria-hidden
            data-testid="wear-tick"
            className={cn('absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full', TICK_COLOR)}
            style={{ left: `${tick}%`, ...TICK_EDGE }}
          />
        )}
        {limit !== null && (
          <span
            aria-hidden
            data-testid="wear-limit-tick"
            className="absolute -inset-y-1.5 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
            style={{ left: `${limit}%`, ...TICK_EDGE }}
          />
        )}
      </div>
      {/* The tick, named (design review, Oct 2026): an unlabelled mark at
          800 km said nothing. The label starts under the tick, behind a
          short tick of its own; where it would run past the bar's end the
          spacer gives way first, so it slides left and stays whole. */}
      {label && (
        <div className="mt-1.5 flex" data-testid={label.at === limit ? 'wear-limit-label' : 'wear-tick-label'}>
          <span aria-hidden className="min-w-0" style={{ flexBasis: `${label.at}%` }} />
          <span className={cn('-ml-px flex shrink-0 items-center gap-1 whitespace-nowrap text-caption leading-none', label.tone)}>
            <span aria-hidden className={cn('h-2.5 w-0.5 rounded-full', label.at === limit ? 'bg-foreground' : TICK_COLOR)} />
            {label.text}
          </span>
        </div>
      )}
    </div>
  )
}
