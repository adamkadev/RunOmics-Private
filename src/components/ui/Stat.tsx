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

/**
 * A value's unit, inline after it: 13 px, regular, muted - "12.8 km", "5:44
 * /km". It never breaks inside: "20.5 of 53" over a lone "km" read as two
 * numbers (design review, Oct 2026); on a narrow column it moves down whole.
 */
export function Unit({ children }: { children: ReactNode }) {
  return <span className="ml-1 whitespace-nowrap text-[13px] font-normal tracking-normal text-muted-foreground">{children}</span>
}

/**
 * The one stat pattern (v4.17), wherever a number is shown with its name:
 * the label on top in 12 px muted sentence case, the value at 22-26 px with
 * its unit inline, and an optional line under it that says what it means,
 * in a status colour or muted, wrapping rather than cut.
 *
 * `labelPosition="bottom"` turns it over (App Fixes 1f): the number leads and
 * its unit and name sit under it, so a value as wide as "10 / 14" fits any
 * column without the label pushing it into a second line.
 */
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
  /** md 22 px, lg 26 px. */
  size?: 'md' | 'lg'
  /** `bottom`: the number first, its name under it (App Fixes 1f). */
  labelPosition?: 'top' | 'bottom'
  className?: string
  valueStyle?: CSSProperties
}) {
  // Label, value and meaning all wrap on a narrow column, never cut
  // (v4.17.2): at 360 pt "12-week average" and "30 km/week" were.
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
        {/* With the name under the value, the unit goes down with it. */}
        {!bottom && unit != null && unit !== '' && <Unit>{unit}</Unit>}
      </span>
      {bottom && name}
      {meaning != null && meaning !== '' && (
        // A meaning line wraps on a narrow screen, never cut (v4.17.2).
        <span className={cn('text-xs text-pretty', STAT_TONE_CLASS[tone])}>{meaning}</span>
      )}
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
