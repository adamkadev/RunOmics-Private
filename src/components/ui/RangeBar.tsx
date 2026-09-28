import type { ReactNode } from 'react'

/**
 * A value against its range (v4.17) - running dynamics against the
 * athlete's baseline, the load ratio against its safe band: an 8 px
 * surface-2 track, the band in pos at 24% (or the accent's soft tint for a
 * baseline), and a 3 x 16 px marker in text ink. The caption goes under it.
 * Positions are 0 to 1 along the track.
 */
export function RangeBar({
  band,
  marker,
  bandTone = 'pos',
  caption,
  label,
}: {
  band: [from: number, to: number] | null
  marker: number | null
  bandTone?: 'pos' | 'baseline'
  caption?: ReactNode
  /** What the bar shows, for a screen reader. */
  label: string
}) {
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  return (
    <div className="flex flex-col gap-1.5">
      <div role="img" aria-label={label} className="relative h-4">
        <div className="absolute inset-x-0 top-1 h-2 rounded-full bg-[var(--surface-2)]" />
        {band && (
          <div
            className="absolute top-1 h-2 rounded-full"
            style={{
              left: `${clamp(band[0]) * 100}%`,
              width: `${Math.max(0, clamp(band[1]) - clamp(band[0])) * 100}%`,
              background: bandTone === 'pos' ? 'color-mix(in srgb, var(--pos) 24%, transparent)' : 'var(--accent-soft)',
            }}
          />
        )}
        {marker != null && (
          <div
            className="absolute top-0 h-4 w-[3px] -translate-x-1/2 rounded-full bg-foreground"
            style={{ left: `${clamp(marker) * 100}%` }}
          />
        )}
      </div>
      {caption && <div className="text-xs text-muted-foreground">{caption}</div>}
    </div>
  )
}
