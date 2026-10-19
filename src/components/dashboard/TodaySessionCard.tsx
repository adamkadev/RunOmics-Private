import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { tileSegments } from '@/components/plan/WorkoutStructure'
import { sessionZone } from '@/lib/colors'
import { t } from '@/i18n'
import type { SessionCard } from './nextSession'

function IntensityBar({ workout }: { workout: NonNullable<SessionCard['workout']> }) {
  const zone = workout.type ? sessionZone(workout) : null
  return (
    <div aria-hidden className="flex h-2.5 gap-[3px]" data-testid="today-structure-bar">
      {tileSegments(workout.structure ?? [], zone).map((segment, i) => (
        <span key={i} className="min-w-[3px] rounded-[5px]" style={{ flexGrow: segment.weight, flexBasis: 0, background: segment.fill }} />
      ))}
    </div>
  )
}

function isStructured(workout: NonNullable<SessionCard['workout']>): boolean {
  return (workout.structure?.length ?? 0) > 1
}

export function TodaySessionCard({ card }: { card: SessionCard }) {
  return (
    <Link
      href={card.href}
      data-testid="session-card"
      data-date={card.date}
      className="flex flex-col gap-2.5 rounded-[24px] border border-border bg-card px-[18px] py-3.5 shadow-card transition-colors hover:border-[var(--accent)] active:border-[var(--accent)]"
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-caption font-semibold uppercase tracking-[0.1em] text-accent-text">{card.eyebrow}</span>
        {card.phase && <span className="text-xs text-muted-foreground">{card.phase}</span>}
      </span>
      <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="line-clamp-2 min-w-0 break-words text-[26px] font-bold leading-tight tracking-[-0.01em] text-pretty text-foreground">{card.title}</span>
        {(card.km || card.detail) && (
          <span className="text-sm tabular-nums text-[var(--text-2)]" data-testid="session-detail">
            {card.km && <span className="font-semibold text-foreground">{card.km} {t.units.km}</span>}
            {card.km && card.detail && ' · '}
            {card.detail}
          </span>
        )}
      </span>
      {card.workout && isStructured(card.workout) && <IntensityBar workout={card.workout} />}
      <span className="flex items-center justify-between text-sm font-semibold text-accent-text">
        {t.dashboard.todayHero.openInPlan}
        <ChevronRight size={16} strokeWidth={2.4} aria-hidden />
      </span>
    </Link>
  )
}
