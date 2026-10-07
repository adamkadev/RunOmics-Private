/** The app's mark, drawn in the accent: the sidebar's brand and the sign-in page's. */
export function HeaderMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      className="text-accent-text"
      role="img"
      aria-hidden="true"
    >
      <path d="M 6 16 A 16 8 0 0 1 38 16" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="6" y1="16" x2="6" y2="28" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.3" />
      <line x1="38" y1="16" x2="38" y2="28" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.3" />
      <path d="M 6 28 A 16 8 0 0 0 38 28" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" opacity="0.45" />
      <path d="M 6 28 A 16 8 0 0 1 38 28" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="6" y1="28" x2="6" y2="40" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.3" />
      <line x1="38" y1="28" x2="38" y2="40" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.3" />
      <path d="M 6 40 A 16 8 0 0 0 38 40" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" opacity="0.45" />
    </svg>
  )
}
