import type { ReactNode } from 'react'

/**
 * A value against its range (v4.17) - running dynamics against the
 * athlete's baseline, the load ratio against its safe band: an 8 px track,
 * the band in pos (or the accent, for a baseline), and a 3 x 16 px marker in
 * text ink or the value's own status. The caption goes under it. Positions
 * are 0 to 1 along the track.
 *
 * Screen audit, Oct 2026: the surface-2 track and the 24% and 12% bands were
 * 1.1-1.3:1, so the band "the key reference" barely showed; the track is now
 * line-2 and the bands stronger. A value past either end was a marker pinned
 * half off the track in the in-range ink: it now stays on the track, in the
 * marker's colour, with an arrow pointing off the end.
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
  return (
    <div className="flex flex-col gap-1.5">
      <div role="img" aria-label={label} className="relative h-4">
        <div className="absolute inset-x-0 top-1 h-2 rounded-full bg-[var(--line-2)]" data-testid="range-bar-track" />
        {band && (
          <div
            className="absolute top-1 h-2 rounded-full"
            data-testid="range-band"
            style={{
              left: `${clamp(band[0]) * 100}%`,
              width: `${Math.max(0, clamp(band[1]) - clamp(band[0])) * 100}%`,
              background: bandTone === 'pos' ? 'color-mix(in srgb, var(--pos) 45%, transparent)' : 'color-mix(in srgb, var(--accent) 45%, transparent)',
            }}
          />
        )}
        {marker != null && (
          <div
            className="absolute top-0 h-4 w-[3px] -translate-x-1/2 rounded-full"
            data-testid="range-marker"
            data-overflow={overflow ?? undefined}
            // Kept whole on the track: at 0 or 1 a centred marker was half off it.
            style={{ left: `clamp(1.5px, ${clamp(marker) * 100}%, calc(100% - 1.5px))`, background: markerColor }}
          />
        )}
        {overflow && (
          <span
            aria-hidden
            className="absolute top-1/2 -translate-y-1/2 text-[11px] font-bold leading-none"
            style={{ color: markerColor, ...(overflow === 'high' ? { right: -10 } : { left: -10 }) }}
          >
            {overflow === 'high' ? '▸' : '◂'}
          </span>
        )}
      </div>
      {caption && <div className="text-xs text-muted-foreground">{caption}</div>}
    </div>
  )
}
