import Link from 'next/link'
import { Check, ChevronRight } from 'lucide-react'
import { cardClass } from '@/components/ui/Card'
import { RouteThumb } from '@/components/ui/RouteThumb'
import type { LastRun } from './nextSession'

function StateBadge({ missed }: { missed: boolean }) {
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
      style={
        missed
          ? { border: '1.5px dashed var(--neg)', background: 'color-mix(in srgb, var(--neg) 12%, transparent)', color: 'var(--neg)' }
          : { background: 'color-mix(in srgb, var(--pos) 18%, transparent)', color: 'var(--pos)' }
      }
    >
      {missed ? '✕' : <Check size={16} strokeWidth={2.6} />}
    </span>
  )
}

export function LastRunRow({ run }: { run: LastRun }) {
  const missed = run.state === 'missed'
  const withThumb = run.layout === 'past'

  return (
    <Link
      href={run.href}
      data-testid="last-run"
      data-state={run.state}
      data-layout={run.layout}
      className={cardClass({ padding: 'none', className: 'flex min-h-16 items-center gap-3.5 px-4 py-3 transition-opacity active:opacity-70' })}
    >
      {withThumb ? <RouteThumb path={run.thumb ?? null} type={run.type ?? null} size={48} /> : <StateBadge missed={missed} />}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="line-clamp-2 break-words text-[15px] font-semibold text-pretty text-foreground">{run.title}</span>
        <span className="text-xs leading-snug text-muted-foreground">{run.detail}</span>
      </span>
      {withThumb ? <StateBadge missed={missed} /> : <ChevronRight size={18} className="shrink-0 text-subtle" aria-hidden />}
    </Link>
  )
}
