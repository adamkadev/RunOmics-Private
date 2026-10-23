import Link from 'next/link'
import { Check, ChevronRight } from 'lucide-react'
import type { WeekDayState } from '@/domain/training/weekTarget'
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const CHIP_TONE: Record<WeekDayState, StatusTone> = {
  done: 'good',
  missed: 'warn',
  planned: 'neutral',
  rest: 'neutral',
}

export function SessionStateChip({ state, label: override, className }: { state: WeekDayState; label?: string; className?: string }) {
  const label = override ?? t.sessionState[state]
  return (
    <StatusPill tone={CHIP_TONE[state]} className={cn('flex-none items-center gap-1 rounded-lg px-2.5 py-1 font-semibold', className)}>
      {override === undefined && state === 'done' && <Check size={12} strokeWidth={3} aria-hidden className="shrink-0" />}
      {label}
    </StatusPill>
  )
}

/** Read-only: everything here comes from Garmin, so there is nothing to mark, move or start. */
export function SessionCard({
  state,
  chipLabel,
  title,
  detail,
  href,
  className,
}: {
  state: WeekDayState
  /** Overrides the state's words, e.g. "On plan". */
  chipLabel?: string
  title: string
  detail?: string | null
  href?: string
  className?: string
}) {
  const body = (
    <>
      <SessionStateChip state={state} label={chipLabel} />
      <div className="min-w-0 flex-1">
        <div className="break-words text-sm font-semibold text-pretty text-foreground">{title}</div>
        {/* Wraps rather than truncates: the planned figure is the point of the line. */}
        {detail && <div className="text-xs leading-snug text-muted-foreground">{detail}</div>}
      </div>
      {href && <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-subtle" />}
    </>
  )
  const rowClass = cn('flex min-h-11 items-center gap-3', className)

  return href ? (
    <Link href={href} data-testid="session-card" className={cn(rowClass, 'transition-opacity active:opacity-70')}>
      {body}
    </Link>
  ) : (
    <div data-testid="session-card" className={rowClass}>
      {body}
    </div>
  )
}
