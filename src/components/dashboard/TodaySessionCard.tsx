import Link from 'next/link'
import { ChevronRight, Thermometer } from 'lucide-react'
import { tileSegments } from '@/components/plan/WorkoutStructure'
import { sessionZone } from '@/lib/colors'
import { cardClass } from '@/components/ui/Card'
import { t } from '@/i18n'
import type { SessionCard } from './nextSession'

function IntensityBar({ workout }: { workout: NonNullable<SessionCard['workout']> }) {
  const zone = workout.type ? sessionZone(workout) : null
  return (
    <div aria-hidden className="mt-2 flex h-2 gap-[3px]" data-testid="today-structure-bar">
      {tileSegments(workout.structure ?? [], zone).map((segment, i) => (
        <span key={i} className="min-w-[3px] rounded-[4px]" style={{ flexGrow: segment.weight, flexBasis: 0, background: segment.fill }} />
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
      className={cardClass({ clickable: true, className: 'flex flex-col gap-1.5' })}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-eyebrow uppercase text-accent-text">{card.eyebrow}</span>
        <ChevronRight size={18} aria-hidden className="shrink-0 text-muted-foreground" />
      </span>
      <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="line-clamp-2 min-w-0 break-words text-title-1 text-pretty text-foreground">{card.title}</span>
        {(card.km || card.detail) && (
          <span className="text-[15px] leading-5 tabular-nums text-[var(--text-2)]" data-testid="session-detail">
            {card.km && <span className="font-semibold text-foreground">{card.km} {t.units.km}</span>}
            {card.km && card.detail && ' · '}
            {card.detail}
          </span>
        )}
      </span>
      {card.workout && isStructured(card.workout) && <IntensityBar workout={card.workout} />}
      {card.heat && (
        <span className="mt-1 flex items-start gap-1.5 text-footnote text-[var(--text-2)] [text-wrap:pretty]" data-testid="session-heat">
          <Thermometer size={14} strokeWidth={2} aria-hidden className="mt-[2px] shrink-0 text-[var(--warn)]" />
          <span>{t.heatAhead.line(card.heat.apparentTempC, t.heatAhead.time(card.heat.hour), card.heat.costSecPerKm)}</span>
        </span>
      )}
    </Link>
  )
}
