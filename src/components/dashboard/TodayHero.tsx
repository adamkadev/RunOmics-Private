'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Check, Footprints, BedDouble } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import type { Activity, ActivityType, PlannedWorkout } from '@/domain/activity/types'
import { ACTIVITY_TYPE_ICONS } from '@/domain/activity/types'
import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import type { ReadinessTone } from '@/domain/training/readiness'
import { PlannedWorkoutSheet } from '@/components/plan/PlannedWorkoutSheet'
import { formatRelativeAgo, formatDistance, formatDurationWords } from '@/lib/formatters'
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
  todayActivity: Activity | null
  nextRace: UpcomingRace | null
  lastSyncedAt: string | null
}


function verdictTone(status: TrainingStatus): ReadinessTone {
  const fatigueRising = status.atlDelta > 1
  const fatigueFalling = status.atlDelta < -1
  let tone: ReadinessTone
  if (status.tsbNow < -10 || fatigueRising) tone = 'hold'
  else if (status.tsbNow > 5 && fatigueFalling) tone = 'go'
  else tone = 'caution'

  if (status.status === 'overreaching') return 'hold'
  if (tone === 'go' && (status.status === 'unproductive' || status.status === 'detraining' || status.status === 'recovery')) {
    return 'caution'
  }
  return tone
}

function formatSyncedAgo(lastSyncedAt: string): string {
  return t.dashboard.syncStatus.synced(formatRelativeAgo(lastSyncedAt))
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
export function TodayHero({ status, plannedWorkout, todayActivity, nextRace, lastSyncedAt }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)

  if (!status && !plannedWorkout && !nextRace) return null

  const s = t.dashboard.todayHero
  const tone = status ? verdictTone(status) : null
  const toneHex = tone ? TONE_HEX[tone] : TONE_HEX.go
  const tsbLabel = status ? `${status.tsbNow >= 0 ? '+' : ''}${status.tsbNow.toFixed(1)}` : null
  const verdict = status && tone ? readinessCopy(status, tone) : null
  const formLine = status && tsbLabel
    ? `${t.dashboard.trainingLoad.form} ${tsbLabel} · ${t.trainingStatus.status[status.status]}`
    : null
  const PlannedWorkoutIcon: LucideIcon = plannedWorkout?.type
    ? ACTIVITY_TYPE_ICONS[plannedWorkout.type as ActivityType]
    : Footprints
  const plannedWorkoutMeta = plannedWorkout
    ? [
        plannedWorkout.type ? t.activityTypes[plannedWorkout.type as ActivityType] : null,
        plannedWorkout.durationSecs ? `~${formatDurationWords(plannedWorkout.durationSecs)}` : null,
        plannedWorkout.scheduledTime,
      ].filter(Boolean).join(' · ')
    : null
  const completedMeta = todayActivity
    ? [
        `${formatDistance(todayActivity.distanceKm)} ${t.units.km}`,
        formatDurationWords(todayActivity.durationSeconds),
      ].filter(Boolean).join(' · ')
    : null

  return (
    <div
      className="rounded-[22px] border p-[18px] text-[#eef2f0] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.5)]"
      style={{
        // Hero gradient tinted by the verdict tone (go/caution/hold), so the
        // whole card reads the decision - not just the pastille.
        background: `linear-gradient(158deg, ${toneHex}1f, ${toneHex}05)`,
        borderColor: `${toneHex}59`,
      }}
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
        <div className="mt-3">
          <div className="font-display text-[22px] font-bold leading-[1.12] tracking-tight">{verdict.headline}</div>
          <div className="mt-1.5 text-[13px] leading-snug text-[#a8b4ae]">{verdict.body}</div>
        </div>
      )}

      {plannedWorkout && todayActivity ? (
        <Link
          href={`/activities/${todayActivity.id}`}
          className="mt-3.5 flex w-full items-center gap-3 rounded-[14px] bg-black/25 px-3.5 py-3 text-left transition-colors active:opacity-80"
        >
          <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] bg-accent/[0.18]">
            <Check size={17} className="text-accent-text" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{plannedWorkout.name}</div>
            {completedMeta && (
              <div className="mt-0.5 truncate text-[11px] text-[#8a978f]">{completedMeta}</div>
            )}
          </div>
          <span className="flex shrink-0 items-center gap-0.5 rounded-[10px] bg-accent px-3.5 py-2 text-[11px] font-bold text-accent-foreground">
            {s.viewCta}
            <ChevronRight size={13} strokeWidth={2.5} />
          </span>
        </Link>
      ) : plannedWorkout ? (
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
      ) : (
        <div className="mt-3.5 flex items-center gap-3 rounded-[14px] bg-black/25 px-3.5 py-3">
          <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] bg-accent/[0.18]">
            <BedDouble size={17} className="text-accent-text" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{s.restDay}</div>
            <div className="mt-0.5 truncate text-[11px] text-[#8a978f]">{s.restDaySubtitle}</div>
          </div>
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
