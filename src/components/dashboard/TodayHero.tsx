'use client'

import Link from 'next/link'
import { ButtonLink } from '@/components/ui/Button'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import type { ActivitySummary } from '@/domain/activity/types'
import type { WeekDayState } from '@/domain/training/weekTarget'
import { verdictTone, type ReadinessTone } from '@/domain/training/readiness'
import type { HeroWorkoutView } from '@/components/plan/planWorkoutView'
import { cardClass } from '@/components/ui/Card'
import { VerdictBlock, VerdictEyebrow, type VerdictTone } from '@/components/ui/Verdict'
import { SessionStructureBar } from '@/components/plan/WorkoutStructure'
import { EFFORT_ZONE_BY_TYPE } from '@/domain/training/workoutStructure'
import { todaySession } from './todaySession'
import { todayPlanOf, todayVerdict, type SessionKind } from './todayVerdict'
import type { NextSession } from './nextSession'
import { sessionZone } from '@/lib/colors'
import type { Insight } from '@/lib/gemini'
import { t } from '@/i18n'

// Green light is good news; caution and hold back both ask for care (v4.17).
const VERDICT_TONE: Record<ReadinessTone, VerdictTone> = {
  go: 'pos',
  caution: 'warn',
  hold: 'warn',
}

interface Props {
  status: TrainingStatus | null
  plannedWorkout: HeroWorkoutView | null
  todayActivity: ActivitySummary | null
  aiVerdict: Insight | null
  /** The next session on the plan, which a rest day names. */
  nextSession?: NextSession | null
  /** Yesterday's run, when one was run: a hard one is still in the legs today. */
  yesterday?: SessionKind | null
}

/** The state chip on the session row: a quiet pill, the state in words. */
function StateChip({ state }: { state: WeekDayState }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full border border-border bg-[var(--surface-2)] px-2.5 text-xs',
        // Done is the one good-news state; the rest are just what the day is.
        state === 'done' ? 'text-[var(--pos)]' : state === 'missed' ? 'text-[var(--warn)]' : 'text-[var(--text-2)]',
      )}
    >
      {state === 'done' ? `✓ ${t.sessionState.done}` : t.sessionState[state]}
    </span>
  )
}

// No race countdown here: the race is the plan's reason, not a daily number,
// and the D-21 chip next to the verdict was noise in the morning read. The
// countdown lives on Plan's race footer and on Goals.
export function TodayHero({ status, plannedWorkout, todayActivity, aiVerdict, nextSession = null, yesterday = null }: Props) {
  if (!status && !plannedWorkout && !todayActivity) return null

  const s = t.dashboard.todayHero
  const readiness = status ? verdictTone(status) : 'go'
  const session = todaySession(plannedWorkout, todayActivity, nextSession)
  const planned = session.state === 'planned' ? plannedWorkout : null
  // Without a written verdict, one from today's plan, yesterday's run and
  // the next session (v4.17.1): what to do, why, and what it gives.
  const own = status
    ? todayVerdict({
        tone: readiness,
        today: todayPlanOf(session.state, plannedWorkout?.type ?? null),
        yesterday,
        next: nextSession ? { date: nextSession.date, inDays: nextSession.inDays, kind: nextSession.kind } : null,
      })
    : null
  const verdict = aiVerdict ?? own
  const tone = VERDICT_TONE[readiness]
  const eyebrow = s.eyebrowByTone[readiness]

  // The coach's own sentence under its headline; without one, the why and
  // what it gives. Neither repeats the Form / Fitness / Fatigue row below.
  const body: ReactNode = aiVerdict?.body ? (
    <span data-testid="today-body">{aiVerdict.body}</span>
  ) : own ? (
    <span data-testid="today-reason">{own.body}</span>
  ) : null

  const row = (
    <>
      <StateChip state={session.state} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="break-words text-sm font-semibold text-pretty text-foreground">{session.title}</span>
        {/* Wraps rather than cutting "planned 6…": the figure is the point. */}
        {session.detail && <span className="text-xs leading-snug text-muted-foreground">{session.detail}</span>}
      </span>
    </>
  )

  // A plain surface card (v4.17): the verdict's colour is its eyebrow's
  // alone, and nothing tints the card or its border.
  return (
    <section className={cardClass({ padding: 'lg', className: 'flex flex-col gap-4' })} data-testid="today-hero">
      {verdict ? (
        <VerdictBlock tone={tone} eyebrow={eyebrow} headline={verdict.headline} body={body} size="lg" />
      ) : (
        <VerdictEyebrow tone={tone}>{eyebrow}</VerdictEyebrow>
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-3.5">
        <div className="flex items-center gap-3">
          {/* A run done today opens that run; the plan has its own button. */}
          {session.state === 'done' && session.href ? (
            <Link href={session.href} data-testid="session-card" className="flex min-w-0 flex-1 items-center gap-3 transition-opacity active:opacity-70">
              {row}
            </Link>
          ) : (
            <div data-testid="session-card" className="flex min-w-0 flex-1 items-center gap-3">
              {row}
            </div>
          )}
          <ButtonLink href="/plan" variant="secondary" size="sm" className="shrink-0 px-3 font-medium">
            {s.openPlan}
          </ButtonLink>
        </div>
        {planned?.duration && planned.structure && (
          <div data-testid="today-structure-bar">
            <SessionStructureBar
              steps={planned.structure}
              zoneWord={planned.type ? (EFFORT_ZONE_BY_TYPE[planned.type] ?? null) : null}
              zone={planned.type ? sessionZone(planned) : null}
              totalSeconds={planned.duration.seconds}
              bare
            />
          </div>
        )}
      </div>
    </section>
  )
}
