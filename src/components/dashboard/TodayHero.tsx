'use client'

import { cn } from '@/lib/utils'
import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import type { ActivitySummary } from '@/domain/activity/types'
import { verdictTone, type ReadinessTone } from '@/domain/training/readiness'
import type { HeroWorkoutView } from '@/components/plan/planWorkoutView'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { SessionCard } from '@/components/ui/SessionCard'
import { SessionStructureBar } from '@/components/plan/WorkoutStructure'
import { EFFORT_ZONE_BY_TYPE } from '@/domain/training/workoutStructure'
import { formatDelta } from '@/lib/formatters'
import { todaySession } from './todaySession'
import { READINESS_TONE_COLORS, sessionZone } from '@/lib/colors'
import type { Insight } from '@/lib/gemini'
import { t } from '@/i18n'

const TONE_COLOR: Record<ReadinessTone, string> = READINESS_TONE_COLORS

interface Props {
  status: TrainingStatus | null
  plannedWorkout: HeroWorkoutView | null
  todayActivity: ActivitySummary | null
  aiVerdict: Insight | null
}

function holdCopy(status: TrainingStatus): { headline: string; body: string } {
  const r = t.dashboard.todayHero.readiness.hold
  const fatigue = Math.round(status.atl)
  const fitness = Math.round(status.ctl)
  const form = Math.round(status.tsbNow)
  const weekDelta = Math.round(status.tsbDelta)

  return {
    headline: fatigue > fitness ? r.headline : r.headlineFormDown,
    body: r.body(
      fatigue,
      fitness,
      formatDelta(form),
      weekDelta < 0 ? r.weekDown(Math.abs(weekDelta)) : weekDelta > 0 ? r.weekUp(weekDelta) : r.weekFlat,
    ),
  }
}

function readinessCopy(status: TrainingStatus, tone: ReadinessTone): { headline: string; body: string } {
  const r = t.dashboard.todayHero.readiness
  switch (tone) {
    case 'go':
      return { headline: r.go.headline, body: r.go.body() }
    case 'hold':
      return holdCopy(status)
    case 'caution':
      return { headline: r.caution.headline, body: r.caution.body(t.trainingStatus.loadTrend[status.loadTrend]) }
  }
}

// No race countdown here: the race is the plan's reason, not a daily number,
// and the D-21 chip next to the verdict was noise in the morning read. The
// countdown lives on Plan's race footer and on Goals.
export function TodayHero({ status, plannedWorkout, todayActivity, aiVerdict }: Props) {
  if (!status && !plannedWorkout && !todayActivity) return null

  const s = t.dashboard.todayHero
  const tone = status ? verdictTone(status) : null
  const toneColor = tone ? TONE_COLOR[tone] : TONE_COLOR.go
  const verdict = aiVerdict ?? (status && tone ? readinessCopy(status, tone) : null)
  const session = todaySession(plannedWorkout, todayActivity)

  // The standard card surface, on tokens: it was a fixed navy (#101a2c) with
  // its own borders, a dark island on the teal canvas and in light mode. The
  // left rule stays the caution amber whatever the tone, so an ordinary
  // elevated-fatigue day does not read as an alarm.
  return (
    <GlassSurface
      variant="card"
      className="overflow-hidden rounded-card-sm border-l-[3px]"
      style={{ borderLeftColor: 'var(--tone-caution)' }}
    >
      <div className="px-4.5 pt-3.5 pb-3">
        <div className="flex items-center justify-between gap-3">
          <span
            className={cn(EYEBROW_CLASS, 'inline-flex items-center')}
            style={{ color: toneColor }}
          >
            {tone ? s.eyebrowByTone[tone] : s.eyebrowByTone.go}
          </span>
          {aiVerdict && <span className="text-caption text-subtle">{t.sessionCard.coachInsight}</span>}
        </div>

        {verdict && (
          <>
            <div className="mt-1.5 font-display text-title2 font-bold leading-[1.15] tracking-tight text-foreground">
              {verdict.headline}
            </div>
            <div className="mt-1.25 text-footnote leading-snug text-muted-foreground">{verdict.body}</div>
          </>
        )}
      </div>

      {/* The session leads with its state - planned, done or rest - and
          planned against ran, under the insight rather than competing with it. */}
      <SessionCard
        state={session.state}
        title={session.title}
        detail={session.detail}
        href={session.href}
        className="border-t border-border px-4.5 py-2.5"
      />
      {/* The bar Plan draws for the same session, from the same steps. */}
      {session.state === 'planned' && plannedWorkout?.duration && plannedWorkout.structure && (
        <div className="px-4.5 pb-3.5" data-testid="today-structure-bar">
          <SessionStructureBar
            steps={plannedWorkout.structure}
            zoneWord={plannedWorkout.type ? (EFFORT_ZONE_BY_TYPE[plannedWorkout.type] ?? null) : null}
            zone={plannedWorkout.type ? sessionZone(plannedWorkout) : null}
            totalSeconds={plannedWorkout.duration.seconds}
          />
        </div>
      )}
    </GlassSurface>
  )
}
