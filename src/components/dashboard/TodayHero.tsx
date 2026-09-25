'use client'

import { DAY_MS } from '@/lib/calendarDate'
import { Flag } from 'lucide-react'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import type { ActivitySummary } from '@/domain/activity/types'
import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import { verdictTone, type ReadinessTone } from '@/domain/training/readiness'
import type { HeroWorkoutView } from '@/components/plan/planWorkoutView'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { SessionCard } from '@/components/ui/SessionCard'
import { formatCountdown, formatDelta } from '@/lib/formatters'
import { todaySession } from './todaySession'
import { READINESS_TONE_COLORS } from '@/lib/colors'
import { useToday } from '@/lib/useToday'
import type { Insight } from '@/lib/gemini'
import { t } from '@/i18n'

const TONE_COLOR: Record<ReadinessTone, string> = READINESS_TONE_COLORS

interface Props {
  status: TrainingStatus | null
  plannedWorkout: HeroWorkoutView | null
  todayActivity: ActivitySummary | null
  nextRace: UpcomingRace | null
  aiVerdict: Insight | null
  /** The date the page was prerendered on; see useToday. */
  today: string
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

export function TodayHero({ status, plannedWorkout, todayActivity, nextRace, aiVerdict, today: serverToday }: Props) {
  const today = useToday(serverToday)
  // Whole calendar days, both ends at UTC midnight so a daylight-saving change
  // in between cannot move the count.
  const daysToRace = nextRace
    ? Math.round((Date.parse(`${nextRace.date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS)
    : null

  if (!status && !plannedWorkout && !nextRace) return null

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
            className="inline-flex items-center font-mono text-caption font-bold uppercase tracking-[0.16em]"
            style={{ color: toneColor }}
          >
            {tone ? s.eyebrowByTone[tone] : s.eyebrowByTone.go}
          </span>
          {aiVerdict && <span className="text-caption text-subtle">{t.sessionCard.coachInsight}</span>}
          {nextRace && daysToRace !== null && daysToRace > 0 && (
            <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
              <Flag size={10} className="shrink-0" />
              {formatCountdown(daysToRace)}
            </div>
          )}
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
    </GlassSurface>
  )
}
