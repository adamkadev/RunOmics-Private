import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
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

/** Done, planned, missed or rest, in the one chip recipe every screen uses. */
export function SessionStateChip({ state, label: override, className }: { state: WeekDayState; label?: string; className?: string }) {
  const label = override ?? (state === 'done' ? `✓ ${t.sessionState.done}` : t.sessionState[state])
  return (
    <StatusPill tone={CHIP_TONE[state]} className={cn('flex-none rounded-lg px-2.5 py-1 font-semibold', className)}>
      {label}
    </StatusPill>
  )
}

/**
 * A session and its state: the chip, what it was, and planned against what
 * was run. Read-only - everything here comes from Garmin, so there is nothing
 * to mark, move or start. Used under the AI insight on Today, and as the
 * "vs plan" row on an activity.
 */
export function SessionCard({
  state,
  chipLabel,
  title,
  detail,
  href,
  className,
}: {
  state: WeekDayState
  /** The chip's words, when the state alone says less ("✓ On plan"). */
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
        <div className="truncate text-sm font-semibold text-foreground">{title}</div>
        {detail && <div className="truncate text-xs text-muted-foreground">{detail}</div>}
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
