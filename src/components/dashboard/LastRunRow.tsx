import Link from 'next/link'
import { Check } from 'lucide-react'
import { RouteThumb } from '@/components/ui/RouteThumb'
import { t } from '@/i18n'
import type { LastRun } from './nextSession'

/**
 * The last run, on one compact row (design review 3.0, mock 1b): its route,
 * the day, its name and its numbers, and a check in the accent once done -
 * or a dashed cross in the negative colour for a session nobody ran: shape
 * and colour both, never colour alone. A run opens; a missed session opens
 * Plan on its day, read-only.
 */
export function LastRunRow({ run }: { run: LastRun }) {
  const s = t.dashboard.todayHero
  const missed = run.state === 'missed'
  return (
    <Link
      href={run.href}
      data-testid="last-run"
      data-state={run.state}
      data-when={run.when}
      className="flex items-center gap-3 rounded-[20px] border border-border bg-card p-2.5 pr-3.5 shadow-card transition-opacity active:opacity-70"
    >
      {missed ? (
        <span aria-hidden className="size-11 shrink-0 rounded-[12px] bg-[var(--thumb-bg)]" />
      ) : (
        <RouteThumb path={run.thumb ?? null} type={run.type ?? null} size={44} />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs text-muted-foreground">{run.when === 'today' ? s.today : s.yesterday}</span>
        <span className="line-clamp-2 break-words text-base font-semibold leading-snug text-pretty text-foreground">{run.title}</span>
        <span className="text-[13px] leading-snug text-[var(--text-2)]">{run.detail}</span>
      </span>
      <span
        role="img"
        aria-label={missed ? s.notRun(null) : s.done}
        className="flex size-[30px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
        style={
          missed
            ? { border: '1.5px dashed var(--neg)', background: 'color-mix(in srgb, var(--neg) 12%, transparent)', color: 'var(--neg)' }
            : { background: 'color-mix(in srgb, var(--accent) 22%, transparent)', color: 'var(--accent-text)' }
        }
      >
        {missed ? '✕' : <Check size={16} strokeWidth={2.6} aria-hidden />}
      </span>
    </Link>
  )
}
