import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** What a stat's meaning line says about it: good, caution, bad, or just a note. */
export type StatTone = 'pos' | 'warn' | 'neg' | 'muted'

export const STAT_TONE_CLASS: Record<StatTone, string> = {
  pos: 'text-[var(--pos)]',
  warn: 'text-[var(--warn)]',
  neg: 'text-[var(--neg)]',
  muted: 'text-muted-foreground',
}

/** A value's unit, inline after it: 13 px, regular, muted - "12.8 km", "5:44 /km". */
export function Unit({ children }: { children: ReactNode }) {
  return <span className="ml-1 text-[13px] font-normal tracking-normal text-muted-foreground">{children}</span>
}

/**
 * The one stat pattern (v4.17), wherever a number is shown with its name:
 * the label on top in 12 px muted sentence case, the value at 22-26 px with
 * its unit inline, and an optional line under it that says what it means,
 * in a status colour or muted.
 */
export function Stat({
  label,
  value,
  unit,
  meaning,
  tone = 'muted',
  size = 'md',
  className,
  valueStyle,
}: {
  label: ReactNode
  value: ReactNode
  unit?: ReactNode
  meaning?: ReactNode
  tone?: StatTone
  /** md 22 px, lg 26 px. */
  size?: 'md' | 'lg'
  className?: string
  valueStyle?: CSSProperties
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <span
        className={cn('truncate font-semibold leading-tight tracking-[-0.01em] text-foreground', size === 'lg' ? 'text-[26px]' : 'text-[22px]')}
        style={valueStyle}
      >
        {value}
        {unit != null && unit !== '' && <Unit>{unit}</Unit>}
      </span>
      {meaning != null && meaning !== '' && <span className={cn('truncate text-xs', STAT_TONE_CLASS[tone])}>{meaning}</span>}
    </div>
  )
}

/** Stats side by side: N equal columns, 16 px apart. */
export function StatGrid({ columns, children, className }: { columns: number; children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid gap-4', className)} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {children}
    </div>
  )
}
