'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import type { ActivitySummary } from '@/domain/activity/types'
import { verdictTone, type ReadinessTone } from '@/domain/training/readiness'
import { formBand } from '@/domain/training/formBand'
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

  const planned = session.state === 'planned' ? plannedWorkout : null

  // A thin border in the tone all round, not a thick left rule (H03, M7).
  return (
    <GlassSurface
      variant="card"
      className="flex flex-col gap-3.5 overflow-hidden rounded-card-sm border p-5"
      style={{ borderColor: `color-mix(in srgb, ${toneColor} 45%, transparent)` }}
    >
      {/* The watch's status moved under Form, in the Body card (v4.3.4). */}
      <span className={cn(EYEBROW_CLASS, 'inline-flex items-center')} style={{ color: toneColor }}>
        {tone ? s.eyebrowByTone[tone] : s.eyebrowByTone.go}
      </span>

      {verdict && (
        <div className="-mt-1.5 font-display text-title1 font-bold leading-[1.1] tracking-tight text-foreground">
          {verdict.headline}
        </div>
      )}
      {/* The reason in one muted line (v5.5 #19): the verdict says what to do,
          this says why, from the Body card's own form. */}
      {verdict && status && (
        <p className="-mt-2 text-footnote text-muted-foreground" data-testid="today-reason">
          {s.formReason(formatDelta(Math.round(status.tsbNow)), t.formBand[formBand(Math.round(status.tsbNow))].toLowerCase())}
        </p>
      )}

      <div className="h-px bg-border" />

      {planned ? (
        // The session Plan shows for today, in Plan's words, then its bar.
        <>
          <Link href={session.href ?? '/plan'} data-testid="session-card" className="-mt-0.5 block transition-opacity active:opacity-70">
            <span className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate font-display text-[17px] font-semibold leading-tight text-foreground">
                {session.title}
              </span>
              <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-muted-foreground" />
            </span>
            {session.detail && <span className="mt-1 block text-sm text-muted-foreground">{session.detail}</span>}
          </Link>
          {planned.duration && planned.structure && (
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
        </>
      ) : (
        // Done, missed or rest: the state chip says which.
        <SessionCard state={session.state} title={session.title} detail={session.detail} href={session.href} className="-my-1" />
      )}
    </GlassSurface>
  )
}
