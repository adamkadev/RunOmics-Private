'use client'

import type { ReactNode } from 'react'

/** Small accent text button used to jump back to "now" (today, current week...). */
export function InlineJumpButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-2 py-1 text-xs font-medium text-accent-text transition-colors hover:bg-accent-subtle"
    >
      {children}
    </button>
  )
}
