import type { ReactNode } from 'react'

/** Shared card shell for Recharts tooltips: bordered surface + optional muted label. */
export function TooltipCard({ label, children }: { label?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-sm dark:bg-muted">
      {label != null && label !== '' && (
        <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      )}
      {children}
    </div>
  )
}

/** One series line in a multi-series tooltip: colored dot · name · value. */
export function TooltipRow({
  color,
  name,
  value,
}: {
  color?: string
  name: string
  value: ReactNode
}) {
  return (
    <p className="flex items-center gap-1.5 text-xs">
      {color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
      <span className="text-muted-foreground">{name}:</span>
      <span className="font-semibold text-foreground">{value}</span>
    </p>
  )
}
