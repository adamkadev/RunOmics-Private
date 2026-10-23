import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type StatTone = 'pos' | 'warn' | 'neg' | 'muted'

export const STAT_TONE_CLASS: Record<StatTone, string> = {
  pos: 'text-[var(--pos)]',
  warn: 'text-[var(--warn)]',
  neg: 'text-[var(--neg)]',
  muted: 'text-muted-foreground',
}

/** Never breaks inside: a lone "km" under "20.5 of 53" reads as two numbers. */
export function Unit({ children }: { children: ReactNode }) {
  return <span className="ml-1 whitespace-nowrap text-[13px] font-normal tracking-normal text-muted-foreground">{children}</span>
}

export function Stat({
  label,
  value,
  unit,
  meaning,
  tone = 'muted',
  size = 'md',
  labelPosition = 'top',
  className,
  valueStyle,
}: {
  label: ReactNode
  value: ReactNode
  unit?: ReactNode
  meaning?: ReactNode
  tone?: StatTone
  size?: 'md' | 'lg'
  labelPosition?: 'top' | 'bottom'
  className?: string
  valueStyle?: CSSProperties
}) {
  // Label, value and meaning wrap on a narrow column, never cut.
  const name = <span className="text-xs text-muted-foreground text-pretty">{label}</span>
  const bottom = labelPosition === 'bottom'
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      {!bottom && name}
      <span
        className={cn('font-semibold leading-tight tracking-[-0.01em] text-foreground', size === 'lg' ? 'text-[26px]' : 'text-[22px]')}
        style={valueStyle}
      >
        {value}
        {!bottom && unit != null && unit !== '' && <Unit>{unit}</Unit>}
      </span>
      {bottom && name}
      {meaning != null && meaning !== '' && (
        <span className={cn('text-xs text-pretty', STAT_TONE_CLASS[tone])}>{meaning}</span>
      )}
    </div>
  )
}

export function StatGrid({ columns, children, className }: { columns: number; children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid gap-4', className)} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {children}
    </div>
  )
}
