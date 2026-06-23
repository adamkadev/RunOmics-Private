'use client'

import { useRef, useState } from 'react'

interface Props {
  value: number
  onCommit: (n: number) => void
  className?: string
  inputClassName?: string
}

/** Tap-to-edit number: renders as a button, swaps to a number input on click. No modal. */
export function EditableNumber({ value, onCommit, className, inputClassName }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const ref = useRef<HTMLInputElement>(null)

  if (editing) {
    return (
      <input
        ref={ref}
        type="number"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false)
          const n = Number(draft)
          if (!Number.isNaN(n) && n > 0) onCommit(Math.round(n))
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') ref.current?.blur()
          if (e.key === 'Escape') setEditing(false)
        }}
        className={
          inputClassName ??
          'w-14 rounded-md border border-border bg-background px-1 py-0.5 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-ring'
        }
      />
    )
  }

  return (
    <button type="button" onClick={() => { setDraft(String(value)); setEditing(true) }} className={className}>
      {value}
    </button>
  )
}
