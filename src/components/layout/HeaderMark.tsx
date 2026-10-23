import { MARK_PATHS, MARK_SMALL_MAX_PX, MARK_SMALL_PATHS, MARK_SMALL_STROKE, MARK_STROKE, MARK_VIEWBOX } from '@/lib/brandMark'

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
