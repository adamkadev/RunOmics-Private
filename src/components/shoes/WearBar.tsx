import { cn } from '@/lib/utils'
import { WEAR_COLOR, WEAR_NEAR_SHARE, wearTone } from './shoeWear'

/**
 * A pair's wear against its limit (C4, v4.4b; v5.5 #15): a 6 pt bar in ink
 * until the retire tick at 80% of the limit and amber past it. Past the limit the bar is scaled to the km run, so the tick
 * moves in and the overrun shows. A retired pair's bar is full and muted.
 */
export function WearBar({
  totalKm,
  maxKm,
  retired = false,
  className,
}: {
  totalKm: number
  maxKm: number
  retired?: boolean
  className?: string
}) {
  const scale = Math.max(totalKm, maxKm, 1)
  const tone = wearTone({ totalKm, maxKm })
  const fill = retired ? 100 : (totalKm / scale) * 100
  const tick = maxKm > 0 && !retired ? ((maxKm * WEAR_NEAR_SHARE) / scale) * 100 : null

  return (
    <div className={cn('relative h-1.5 rounded-full bg-[var(--track)]', className)} data-testid="wear-bar" data-tone={retired ? 'retired' : tone}>
      <span
        className="absolute inset-y-0 left-0 rounded-full"
        data-testid="wear-fill"
        style={{ width: `${fill}%`, background: retired ? 'var(--muted-foreground)' : WEAR_COLOR[tone] }}
      />
      {tick !== null && (
        <span
          aria-hidden
          data-testid="wear-tick"
          className="absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-muted-foreground"
          style={{ left: `${tick}%` }}
        />
      )}
    </div>
  )
}
