import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/** The usual-range pill's fill, the accent dimmed under its own outline - its legend swatch too. */
export const USUAL_PILL_FILL = 'color-mix(in srgb, var(--accent) 35%, transparent)'

/**
 * A value against its range (v4.17) - running dynamics against the
 * athlete's baseline, the load ratio against its safe band: an 8 px track,
 * the band in pos (or the accent, for a baseline), and a 3 x 16 px marker in
 * text ink or the value's own status. The caption goes under it. Positions
 * are 0 to 1 along the track; a value past either end stays on the track
 * with an arrow pointing off it.
 */
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
  /** The marker's ink: a status colour when the value is out of its range. */
  markerColor?: string
  caption?: ReactNode
  /** What the bar shows, for a screen reader. */
  label: string
}) {
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  const overflow = marker == null ? null : marker > 1 ? 'high' : marker < 0 ? 'low' : null
  // A baseline is a range scale (3.0.2, 5e): a hairline track, the usual
  // range a pill in the accent standing proud of it.
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
        {/* Past either end the marker becomes a chevron pointing that way,
            an icon rather than a glyph (3.0 override 3). */}
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
