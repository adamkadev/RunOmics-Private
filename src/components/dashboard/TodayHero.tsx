'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, BedDouble, Flag } from 'lucide-react'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import type { ActivitySummary } from '@/domain/activity/types'
import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import { verdictTone, type ReadinessTone } from '@/domain/training/readiness'
import { PlannedWorkoutSheet } from '@/components/plan/PlannedWorkoutSheet'
import type { PlanWorkoutView } from '@/components/plan/planWorkoutView'
import { formatCountdown, formatDelta, formatDistance, formatDurationWords } from '@/lib/formatters'
import { READINESS_TONE_COLORS } from '@/lib/colors'
import type { Insight } from '@/lib/gemini'
import { t } from '@/i18n'

const TONE_HEX: Record<ReadinessTone, string> = READINESS_TONE_COLORS
const ACCENT_ON_DARK = 'var(--accent-on-dark)'
const ICON_WELL = { background: `color-mix(in srgb, ${ACCENT_ON_DARK} 18%, transparent)` }

// The card is now the standard dark surface everywhere - only the left rule
// still carries an accent, and it no longer follows the readiness tone: it is
// a fixed amber so an ordinary elevated-fatigue day doesn't read as an alarm.
const CARD_SURFACE = '#101a2c'
const CARD_BORDER = 'rgba(148,178,220,.14)'
const AMBER_RULE = '#f5b13d'
const CHIP_BORDER = 'rgba(148,178,220,.22)'
const CHIP_TEXT = '#b9c4cf'
const FOOTER_BG = 'rgba(148,178,220,.035)'
const FOOTER_DIVIDER = 'rgba(148,178,220,.12)'
interface Props {
  status: TrainingStatus | null
  plannedWorkout: PlanWorkoutView | null
  todayActivity: ActivitySummary | null
  nextRace: UpcomingRace | null
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

export function TodayHero({ status, plannedWorkout, todayActivity, nextRace, aiVerdict }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [daysToRace] = useState(() =>
    nextRace
      ? Math.ceil((new Date(nextRace.date + 'T00:00:00').getTime() - Date.now()) / 86_400_000)
      : null
  )

  if (!status && !plannedWorkout && !nextRace) return null

  const s = t.dashboard.todayHero
  const tone = status ? verdictTone(status) : null
  const toneHex = tone ? TONE_HEX[tone] : TONE_HEX.go
  const verdict = aiVerdict ?? (status && tone ? readinessCopy(status, tone) : null)
  const plannedWorkoutMeta = plannedWorkout
    ? [
        plannedWorkout.duration ? `~${formatDurationWords(plannedWorkout.duration.seconds)}` : null,
        plannedWorkout.scheduledTime ? t.plan.timeOfDay[plannedWorkout.scheduledTime] : null,
        plannedWorkout.target,
      ].filter(Boolean).join(' · ')
    : null
  const workoutTitle = plannedWorkout?.title
  const linkedActivityId = plannedWorkout?.activityId ?? todayActivity?.id ?? null
  const completedMeta = todayActivity
    ? [
        `${formatDistance(todayActivity.distanceKm)} ${t.units.km}`,
        formatDurationWords(todayActivity.durationSeconds),
      ].filter(Boolean).join(' · ')
    : null

  return (
    <div
      className="overflow-hidden rounded-[20px] border border-l-[3px] p-[18px] text-white"
      style={{
        background: CARD_SURFACE,
        borderColor: CARD_BORDER,
        borderLeftColor: AMBER_RULE,
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className="inline-flex items-center font-mono text-caption font-bold uppercase tracking-[0.18em]"
          style={{ color: toneHex }}
        >
          {tone ? s.eyebrowByTone[tone] : s.eyebrowByTone.go}
        </span>
        {nextRace && daysToRace !== null && daysToRace > 0 && (
          <div
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px]"
            style={{ border: `1px solid ${CHIP_BORDER}`, color: CHIP_TEXT }}
          >
            <Flag size={10} className="shrink-0" />
            {formatCountdown(daysToRace)}
          </div>
        )}
      </div>

      {verdict && (
        <div className="mt-3">
          <div className="font-display text-title2 font-bold leading-[1.12] tracking-tight">{verdict.headline}</div>
          <div className="mt-1.5 text-footnote leading-snug text-white/70">{verdict.body}</div>
        </div>
      )}

      {plannedWorkout && linkedActivityId ? (
        <Link
          href={`/activities/${linkedActivityId}`}
          className="-mx-[18px] -mb-[18px] mt-3.5 flex w-[calc(100%+36px)] items-center gap-3 border-t px-[18px] py-3 text-left transition-opacity active:opacity-70"
          style={{ borderColor: FOOTER_DIVIDER, background: FOOTER_BG }}
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{workoutTitle}</div>
            {completedMeta && (
              <div className="mt-0.5 truncate text-caption text-white/55">{completedMeta}</div>
            )}
          </div>
          <ChevronRight size={16} strokeWidth={2.5} className="shrink-0 text-white/40" />
        </Link>
      ) : plannedWorkout ? (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="-mx-[18px] -mb-[18px] mt-3.5 flex w-[calc(100%+36px)] items-center gap-3 border-t px-[18px] py-3 text-left transition-opacity active:opacity-70"
          style={{ borderColor: FOOTER_DIVIDER, background: FOOTER_BG }}
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{workoutTitle}</div>
            {plannedWorkoutMeta && <div className="mt-0.5 truncate text-caption text-white/55">{plannedWorkoutMeta}</div>}
          </div>
          <ChevronRight size={16} strokeWidth={2.5} className="shrink-0 text-white/40" />
        </button>
      ) : (
        <div
          className="-mx-[18px] -mb-[18px] mt-3.5 flex w-[calc(100%+36px)] items-center gap-3 border-t px-[18px] py-3"
          style={{ borderColor: FOOTER_DIVIDER, background: FOOTER_BG }}
        >
          <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px]" style={ICON_WELL}>
            <BedDouble size={17} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{s.restDay}</div>
            <div className="mt-0.5 truncate text-caption text-white/55">{s.restDaySubtitle}</div>
          </div>
        </div>
      )}


      {sheetOpen && plannedWorkout && (
        <PlannedWorkoutSheet workout={plannedWorkout} onClose={() => setSheetOpen(false)} />
      )}
    </div>
  )
}
