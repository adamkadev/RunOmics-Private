import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export const USUAL_PILL_FILL = 'color-mix(in srgb, var(--accent) 35%, transparent)'

/** Band and marker are positions from 0 to 1 along the track. */
export function RangeBar({
  band,
  marker,
  bandTone = 'pos',
  markerColor = 'var(--foreground)',
  caption,
  label,
}: {
  band: [from: number, to: number] | null
  marker: number | null
  bandTone?: 'pos' | 'baseline'
  markerColor?: string
  caption?: ReactNode
  label: string
}) {
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  const overflow = marker == null ? null : marker > 1 ? 'high' : marker < 0 ? 'low' : null
  const scale = bandTone === 'baseline'
  return (
    <div className="flex flex-col gap-1.5">
      <div role="img" aria-label={label} className="relative h-4">
        <div
          className={scale ? 'absolute inset-x-0 top-1.5 h-1 rounded-full bg-[var(--line-2)]' : 'absolute inset-x-0 top-1 h-2 rounded-full bg-[var(--line-2)]'}
          data-testid="range-bar-track"
        />
        {band && (
          <div
            className={scale ? 'absolute top-[3px] h-2.5 rounded-full border border-accent' : 'absolute top-1 h-2 rounded-full'}
            data-testid="range-band"
            style={{
              left: `${clamp(band[0]) * 100}%`,
              width: `${Math.max(0, clamp(band[1]) - clamp(band[0])) * 100}%`,
              background: scale ? USUAL_PILL_FILL : 'color-mix(in srgb, var(--pos) 45%, transparent)',
            }}
          />
        )}
        {marker != null && (
          <div
            className="absolute top-0 h-4 w-[3px] -translate-x-1/2 rounded-full"
            data-testid="range-marker"
            data-overflow={overflow ?? undefined}
            // Clamped so a marker at 0 or 1 stays whole on the track.
            style={{ left: `clamp(1.5px, ${clamp(marker) * 100}%, calc(100% - 1.5px))`, background: markerColor }}
          />
        )}
        {overflow && (
          <span
            aria-hidden
            className="absolute top-1/2 flex -translate-y-1/2 items-center leading-none"
            style={{ color: markerColor, ...(overflow === 'high' ? { right: -11 } : { left: -11 }) }}
          >
            {overflow === 'high' ? <ChevronRight size={12} strokeWidth={3} /> : <ChevronLeft size={12} strokeWidth={3} />}
          </span>
        )}
      </div>
      {caption && <div className="text-xs text-muted-foreground">{caption}</div>}
    </div>
  )
}
