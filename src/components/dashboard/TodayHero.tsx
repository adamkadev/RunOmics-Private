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
import { formatDistance, formatDurationWords } from '@/lib/formatters'
import { READINESS_TONE_COLORS } from '@/lib/colors'
import { HUE, withAlpha } from '@/lib/palette'
import { t } from '@/i18n'

const TONE_HEX: Record<ReadinessTone, string> = READINESS_TONE_COLORS

// A fixed near-black base (matching --bg) rather than the page background, so
// the card stays a deliberately dark, always-legible panel in both themes -
// the same pattern var(--hero-gradient) uses elsewhere (see ProfileHero).
// A translucent tint here would let a light-mode page bleed through and wash
// out the white text.
const HERO_BASE = HUE.heroBase

// The panel is dark in both themes, so its accent trim has to be too:
// `--accent-text` drops to a 600 tone in light mode, calibrated for pale
// surfaces, and goes near-invisible here. `--accent-on-dark` holds the dark
// value in both themes. Any component painted on a fixed dark surface (or on
// --hero-gradient) wants this token rather than text-accent-text.
const ACCENT_ON_DARK = 'var(--accent-on-dark)'
const ICON_WELL = { background: `color-mix(in srgb, ${ACCENT_ON_DARK} 18%, transparent)` }

interface Props {
  status: TrainingStatus | null
  plannedWorkout: PlannedWorkout | null
  todayActivity: Activity | null
  nextRace: UpcomingRace | null
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
export function TodayHero({ status, plannedWorkout, todayActivity, nextRace }: Props) {
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
      className="rounded-[22px] border p-[18px] text-white shadow-[var(--shadow-hero)]"
      style={{
        // Hero gradient tinted by the verdict tone (go/caution/hold), so the
        // whole card reads the decision - not just the pastille. Blended into a
        // fixed dark base (not the page background) so the card stays legible
        // in light mode too - same idea as var(--hero-gradient) elsewhere.
        background: `linear-gradient(158deg, color-mix(in srgb, ${toneHex} 20%, ${HERO_BASE}), color-mix(in srgb, ${toneHex} 5%, ${HERO_BASE}))`,
        borderColor: withAlpha(toneHex, 0.35),
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
        {formLine && <span className="text-[11px] text-white/55">{formLine}</span>}
      </div>

      {verdict && (
        <div className="mt-3">
          <div className="font-display text-[22px] font-bold leading-[1.12] tracking-tight">{verdict.headline}</div>
          <div className="mt-1.5 text-[13px] leading-snug text-white/70">{verdict.body}</div>
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
              <div className="mt-0.5 truncate text-[11px] text-white/55">{completedMeta}</div>
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
          <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px]" style={ICON_WELL}>
            <PlannedWorkoutIcon size={17} style={{ color: ACCENT_ON_DARK }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{plannedWorkout.name}</div>
            {plannedWorkoutMeta && (
              <div className="mt-0.5 truncate text-[11px] text-white/55">{plannedWorkoutMeta}</div>
            )}
          </div>
          <span className="flex shrink-0 items-center gap-0.5 rounded-[10px] bg-accent px-3.5 py-2 text-[11px] font-bold text-accent-foreground">
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
            <div className="mt-0.5 truncate text-[11px] text-white/55">{s.restDaySubtitle}</div>
          </div>
        </div>
      )}

      {sheetOpen && plannedWorkout && (
        <PlannedWorkoutSheet workout={plannedWorkout} onClose={() => setSheetOpen(false)} />
      )}
    </div>
  )
}
