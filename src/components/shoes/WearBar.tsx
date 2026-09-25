import { cn } from '@/lib/utils'
import { t } from '@/i18n'

/**
 * A pair's wear against its limit, scaled to max(km, limit) so the overrun
 * shows: a tick marks the limit and the km past it are hatched. At 1,375 of
 * 500 km the bar used to stop at full and read "100%", hiding the one thing
 * worth knowing.
 */
export function WearBar({
  totalKm,
  maxKm,
  fillClass,
  className,
  caption = true,
}: {
  totalKm: number
  maxKm: number
  /** The in-limit fill's colour class, from the wear status. */
  fillClass: string
  className?: string
  /** Say what the tick and the hatching mean, when there is an overrun. */
  caption?: boolean
}) {
  const scale = Math.max(totalKm, maxKm, 1)
  const over = maxKm > 0 && totalKm > maxKm
  const inShare = (Math.min(totalKm, maxKm > 0 ? maxKm : totalKm) / scale) * 100

  return (
    <div className={className}>
      <div className="relative flex h-2.5 overflow-hidden rounded-full bg-foreground/[0.1]" data-testid="wear-bar">
        <span
          className={cn('block h-full', over ? 'bg-subtle/55' : cn('rounded-full', fillClass))}
          style={{ width: `${inShare}%` }}
        />
        {over && (
          <>
            <span
              data-testid="wear-overrun"
              className="block h-full flex-1"
              style={{
                background:
                  'repeating-linear-gradient(135deg, var(--destructive) 0 3px, color-mix(in oklch, var(--destructive) 30%, transparent) 3px 6px)',
              }}
            />
            <span
              data-testid="wear-limit"
              aria-hidden="true"
              className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground"
              style={{ left: `${inShare}%` }}
            />
          </>
        )}
      </div>
      {over && caption && <p className="mt-1.5 text-caption text-subtle">{t.shoes.wearBarCaption}</p>}
    </div>
  )
}
