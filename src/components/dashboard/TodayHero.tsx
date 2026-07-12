'use client'

import { useState } from 'react'
import { ChevronRight, Footprints } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import type { ActivityType, PlannedWorkout } from '@/domain/activity/types'
import { ACTIVITY_TYPE_ICONS } from '@/domain/activity/types'
import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import type { ReadinessTone } from '@/domain/training/readiness'
import { PlannedWorkoutSheet } from '@/components/plan/PlannedWorkoutSheet'
import { relativeTimeParts } from '@/lib/formatters'
import { useCountUp } from '@/lib/useCountUp'
import { t } from '@/i18n'

// Fixed hex, independent of the accent picker - a readiness verdict means the
// same thing (go/caution/hold) whichever accent the athlete has chosen.
const TONE_HEX: Record<ReadinessTone, string> = {
  go: '#1ed787',
  caution: '#f5b700',
  hold: '#ef4444',
}

interface Props {
  status: TrainingStatus | null
  plannedWorkout: PlannedWorkout | null
  nextRace: UpcomingRace | null
  lastSyncedAt: string | null
}

// Deterministic verdict tone, read directly off the already-computed Form
// (TSB) and fatigue trend (ATL delta) - no new data, just a rules layer:
//   TSB > +5 and fatigue falling  -> green light
//   TSB < -10 or fatigue rising   -> hold back
//   otherwise                     -> caution
function verdictTone(tsb: number, atlDelta: number): ReadinessTone {
  const fatigueRising = atlDelta > 1
  const fatigueFalling = atlDelta < -1
  if (tsb < -10 || fatigueRising) return 'hold'
  if (tsb > 5 && fatigueFalling) return 'go'
  return 'caution'
}

function daysUntil(date: string): number {
  const today = new Date().toISOString().slice(0, 10)
  return Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000)
}

function formatSyncedAgo(lastSyncedAt: string): string {
  const s = t.dashboard.syncStatus
  const { unit, value } = relativeTimeParts(lastSyncedAt)
  const relative =
    unit === 'now' ? s.justNow :
    unit === 'minutes' ? s.minutesAgo(value) :
    unit === 'hours' ? s.hoursAgo(value) :
    s.daysAgo(value)
  return s.synced(relative)
}

// Rules layer over the already-computed status/load - copy is keyed by the
// same tone as the pastille, so the verdict sentence never contradicts it.
function readinessCopy(status: TrainingStatus, tone: ReadinessTone): { headline: string; body: string } {
  const r = t.dashboard.todayHero.readiness
  switch (tone) {
    case 'go':
      return { headline: r.go.headline, body: r.go.body() }
    case 'hold':
      return { headline: r.hold.headline, body: r.hold.body() }
    case 'caution':
      return { headline: r.caution.headline, body: r.caution.body(t.trainingStatus.loadTrend[status.loadTrend]) }
  }
}

// Pure display + a rules-based readiness verdict over already-computed status/load data.
export function TodayHero({ status, plannedWorkout, nextRace, lastSyncedAt }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const animatedDaysToRace = useCountUp(nextRace ? daysUntil(nextRace.date) : 0)

  if (!status && !plannedWorkout && !nextRace) return null

  const s = t.dashboard.todayHero
  const tone = status ? verdictTone(status.tsb, status.atlDelta) : null
  const toneHex = tone ? TONE_HEX[tone] : TONE_HEX.go
  const tsbLabel = status ? `${status.tsb >= 0 ? '+' : ''}${status.tsb.toFixed(1)}` : null
  const verdict = status && tone ? readinessCopy(status, tone) : null
  const formLine = tsbLabel ? `${t.dashboard.trainingLoad.form} ${tsbLabel} · ${s.moodByTone[tone ?? 'go']}` : null
  const PlannedWorkoutIcon: LucideIcon = plannedWorkout?.type
    ? ACTIVITY_TYPE_ICONS[plannedWorkout.type as ActivityType]
    : Footprints
  const plannedWorkoutMeta = plannedWorkout
    ? [
        plannedWorkout.type ? t.activityTypes[plannedWorkout.type as ActivityType] : null,
        plannedWorkout.durationSecs ? `~${Math.round(plannedWorkout.durationSecs / 60)} min` : null,
        plannedWorkout.scheduledTime,
      ].filter(Boolean).join(' · ')
    : null

  return (
    <div
      className="rounded-[22px] border p-[18px] text-[#eef2f0] shadow-[0_10px_26px_-6px_rgba(0,0,0,0.35)]"
      style={{ background: 'var(--hero-gradient)', borderColor: `${toneHex}59` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em]"
          style={{ color: toneHex }}
        >
          <span
            className="h-[9px] w-[9px] shrink-0 rounded-full"
            style={{ background: toneHex, boxShadow: `0 0 10px ${toneHex}` }}
          />
          {tone ? s.eyebrowByTone[tone] : s.eyebrowByTone.go}
        </span>
        {formLine && <span className="text-[11px] text-[#8a978f]">{formLine}</span>}
      </div>

      {verdict && (
        <div className="mt-3.5">
          <div className="font-display text-[19px] font-bold leading-snug tracking-tight">{verdict.headline}</div>
          <div className="mt-1 text-[12.5px] leading-snug text-[#a8b4ae]">{verdict.body}</div>
        </div>
      )}

      {plannedWorkout && (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="mt-3.5 flex w-full items-center gap-3 rounded-[14px] bg-black/25 px-3.5 py-3 text-left transition-colors active:opacity-80"
        >
          <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] bg-accent/[0.18]">
            <PlannedWorkoutIcon size={17} className="text-accent-text" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{plannedWorkout.name}</div>
            {plannedWorkoutMeta && (
              <div className="mt-0.5 truncate text-[11px] text-[#8a978f]">{plannedWorkoutMeta}</div>
            )}
          </div>
          <span className="flex shrink-0 items-center gap-0.5 rounded-[10px] bg-accent px-3.5 py-2 text-[11px] font-bold text-accent-foreground">
            {s.sessionCta}
            <ChevronRight size={13} strokeWidth={2.5} />
          </span>
        </button>
      )}

      {nextRace && !plannedWorkout && (
        <div className="mt-3.5">
          <div className="text-[10px] uppercase tracking-wide text-[#8a978f]">{s.race}</div>
          <div className="mt-0.5 text-sm font-semibold">{s.daysToRace(Math.round(animatedDaysToRace))}</div>
        </div>
      )}

      {lastSyncedAt && (
        <div className="mt-3 text-[10px] text-[#6b7a74]">{formatSyncedAgo(lastSyncedAt)}</div>
      )}

      {sheetOpen && plannedWorkout && (
        <PlannedWorkoutSheet workout={plannedWorkout} onClose={() => setSheetOpen(false)} />
      )}
    </div>
  )
}
