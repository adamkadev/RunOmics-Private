import { MARK_PATHS, MARK_SMALL_MAX_PX, MARK_SMALL_PATHS, MARK_SMALL_STROKE, MARK_STROKE, MARK_VIEWBOX } from '@/lib/brandMark'

/**
 * The app's mark, drawn in the accent: the sidebar's brand and the sign-in
 * page's. The v5.2 mark from lib/brandMark - the same geometry as the app
 * icon, the splash and the share card - with its small form at 24 px and
 * under: the ring's front arc dropped, the stroke heavier.
 */
export function HeaderMark({ size = 24 }: { size?: number }) {
  const small = size <= MARK_SMALL_MAX_PX
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`}
      fill="none"
      className="text-accent-text"
      role="img"
      aria-hidden="true"
      data-testid="header-mark"
    >
      <g stroke="currentColor" strokeWidth={small ? MARK_SMALL_STROKE : MARK_STROKE} strokeLinecap="round">
        {(small ? MARK_SMALL_PATHS : MARK_PATHS).map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  )
}
