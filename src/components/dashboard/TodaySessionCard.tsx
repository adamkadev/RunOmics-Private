import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import type { HeroWorkoutView } from '@/components/plan/planWorkoutView'
import { cardClass } from '@/components/ui/Card'
import { Unit } from '@/components/ui/Stat'
import { SessionStructureBar } from '@/components/plan/WorkoutStructure'
import { EFFORT_ZONE_BY_TYPE } from '@/domain/training/workoutStructure'
import { workoutSummary } from '@/components/plan/workoutSummary'
import { sessionZone } from '@/lib/colors'
import { formatClock, formatDistance, formatDurationWords } from '@/lib/formatters'
import { t } from '@/i18n'

const HOUR_SECONDS = 3600

function fieldTime(seconds: number): string {
  if (seconds < HOUR_SECONDS) return formatDurationWords(seconds)
  const minutes = Math.round(seconds / 60)
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
}

function fieldPace(workout: HeroWorkoutView): string | null {
  const { paces } = workoutSummary({ ...workout, structure: workout.structure ?? null })
  const pace = paces.find((p) => p.kind === 'work' || p.kind === 'target') ?? paces[0]
  return pace ? `${formatClock(pace.pace[0])}–${formatClock(pace.pace[1])}` : null
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-caption font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      <span className="text-[17px] font-semibold leading-tight tracking-[-0.01em] tabular-nums text-foreground">{value}</span>
    </div>
  )
}

export function TodaySessionCard({
  eyebrow,
  title,
  workout,
  hrCapBpm = null,
}: {
  eyebrow: string
  title: string
  workout: HeroWorkoutView | null
  hrCapBpm?: number | null
}) {
  const s = t.dashboard.todayHero
  const pace = workout ? fieldPace(workout) : null
  const fields = [
    workout?.duration ? { label: s.fields.time, value: fieldTime(workout.duration.seconds) } : null,
    workout?.distanceM
      ? { label: s.fields.dist, value: <>{formatDistance(workout.distanceM / 1000)}<Unit>{t.units.km}</Unit></> }
      : null,
    pace ? { label: s.fields.pace, value: pace } : null,
    hrCapBpm ? { label: s.fields.hr, value: s.hrCap(hrCapBpm) } : null,
  ].filter((field) => field !== null)

  return (
    <Link href="/plan" aria-label={s.openSession} className="block active:scale-[0.99]" data-testid="session-card-link">
      <section className={cardClass({ padding: 'lg', className: 'flex flex-col gap-3' })} data-testid="session-card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-caption font-semibold uppercase tracking-[0.08em] text-accent-text">{eyebrow}</span>
            <span className="line-clamp-2 break-words text-[19px] font-semibold leading-snug text-pretty text-foreground">{title}</span>
          </div>
          <ChevronRight size={18} className="mt-0.5 shrink-0 text-subtle" aria-hidden />
        </div>

        {fields.length > 0 && (
          <div
            className="grid items-start gap-2"
            style={{ gridTemplateColumns: fields.map((field) => (field.label === s.fields.pace ? '1.35fr' : '1fr')).join(' ') }}
            data-testid="session-fields"
          >
            {fields.map((field) => (
              <Field key={field.label} label={field.label} value={field.value} />
            ))}
          </div>
        )}

        {workout && (
          <div data-testid="today-structure-bar">
            <SessionStructureBar
              variant="tile"
              steps={workout.structure ?? []}
              zoneWord={workout.type ? (EFFORT_ZONE_BY_TYPE[workout.type] ?? null) : null}
              zone={workout.type ? sessionZone(workout) : null}
              totalSeconds={workout.duration?.seconds ?? 0}
            />
          </div>
        )}
      </section>
    </Link>
  )
}
