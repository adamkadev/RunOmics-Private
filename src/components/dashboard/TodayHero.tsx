'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Check, Footprints, BedDouble, Flag } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import type { ActivitySummary, ActivityType, PlannedWorkout } from '@/domain/activity/types'
import { ACTIVITY_TYPE_ICONS } from '@/domain/activity/types'
import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import { verdictTone, type ReadinessTone } from '@/domain/training/readiness'
import { PlannedWorkoutSheet } from '@/components/plan/PlannedWorkoutSheet'
import { formatDistance, formatDurationWords } from '@/lib/formatters'
import { READINESS_TONE_COLORS } from '@/lib/colors'
import { HUE, withAlpha } from '@/lib/palette'
import type { Insight } from '@/lib/gemini'
import { t } from '@/i18n'

const TONE_HEX: Record<ReadinessTone, string> = READINESS_TONE_COLORS
const HERO_BASE = HUE.heroBase
const ACCENT_ON_DARK = 'var(--accent-on-dark)'
const ICON_WELL = { background: `color-mix(in srgb, ${ACCENT_ON_DARK} 18%, transparent)` }

interface Props {
  status: TrainingStatus | null
  plannedWorkout: PlannedWorkout | null
  todayActivity: ActivitySummary | null
  nextRace: UpcomingRace | null
  aiVerdict: Insight | null
}


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
  const PlannedWorkoutIcon: LucideIcon = plannedWorkout?.type
    ? ACTIVITY_TYPE_ICONS[plannedWorkout.type as ActivityType]
    : Footprints
  const plannedWorkoutMeta = plannedWorkout
    ? [
        plannedWorkout.type ? t.activityTypes[plannedWorkout.type as ActivityType] : null,
        plannedWorkout.durationSecs ? `~${formatDurationWords(plannedWorkout.durationSecs)}` : null,
        plannedWorkout.scheduledTime ? t.plan.timeOfDay[plannedWorkout.scheduledTime] : null,
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
      className="rounded-[22px] border p-[18px] text-white"
      style={{
        background: `linear-gradient(158deg, color-mix(in srgb, ${toneHex} 20%, ${HERO_BASE}), color-mix(in srgb, ${toneHex} 5%, ${HERO_BASE}))`,
        borderColor: withAlpha(toneHex, 0.35),
        boxShadow: `var(--shadow-hero), 0 8px 40px -8px ${withAlpha(toneHex, 0.28)}`,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-1.5 font-mono text-micro font-bold uppercase tracking-[0.1em]"
          style={{ color: toneHex }}
        >
          <span
            className="h-[9px] w-[9px] shrink-0 rounded-full"
            style={{ background: toneHex, boxShadow: `0 0 10px ${toneHex}` }}
          />
          {tone ? s.eyebrowByTone[tone] : s.eyebrowByTone.go}
        </span>
        {daysToRace !== null && daysToRace > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 font-mono text-micro font-bold text-white/80">
            <Flag size={10} />
            {s.daysToRace(daysToRace)} · {nextRace!.name}
          </span>
        )}
      </div>

      {verdict && (
        <div className="mt-3">
          <div className="font-display text-title2 font-bold leading-[1.12] tracking-tight">{verdict.headline}</div>
          <div className="mt-1.5 text-footnote leading-snug text-white/70">{verdict.body}</div>
        </div>
      )}

      {plannedWorkout && todayActivity ? (
        <Link
          href={`/activities/${todayActivity.id}`}
          className="mt-3.5 flex w-full items-center gap-3 rounded-[14px] bg-black/25 px-3.5 py-3 text-left transition-colors active:opacity-80"
        >
          <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px]" style={ICON_WELL}>
            <Check size={17} style={{ color: ACCENT_ON_DARK }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{plannedWorkout.name}</div>
            {completedMeta && (
              <div className="mt-0.5 truncate text-caption text-white/55">{completedMeta}</div>
            )}
          </div>
          <span className="flex shrink-0 items-center gap-0.5 rounded-[10px] bg-accent px-3.5 py-2 text-caption font-bold text-accent-foreground">
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
          <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px]" style={ICON_WELL}>
            <PlannedWorkoutIcon size={17} style={{ color: ACCENT_ON_DARK }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{plannedWorkout.name}</div>
            {plannedWorkoutMeta && (
              <div className="mt-0.5 truncate text-caption text-white/55">{plannedWorkoutMeta}</div>
            )}
          </div>
          <span className="flex shrink-0 items-center gap-0.5 rounded-[10px] bg-accent px-3.5 py-2 text-caption font-bold text-accent-foreground">
            {s.sessionCta}
            <ChevronRight size={13} strokeWidth={2.5} />
          </span>
        </button>
      ) : (
        <div className="mt-3.5 flex items-center gap-3 rounded-[14px] bg-black/25 px-3.5 py-3">
          <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px]" style={ICON_WELL}>
            <BedDouble size={17} style={{ color: ACCENT_ON_DARK }} />
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
