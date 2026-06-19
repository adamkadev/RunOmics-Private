'use client'

interface Props {
  label: string
  onClick: () => void
}

export function AddButton({ label, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-2 py-1.5 text-xs font-medium text-accent-text transition-colors hover:bg-accent/10"
    >
      + {label}
    </button>
  )
}
