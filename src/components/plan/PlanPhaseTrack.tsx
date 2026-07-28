import type { PlanPhaseRange, TrainingPlanPhase } from '@/application/usecases/GetTrainingPlan'
import { TRAINING_PLAN_PHASE_COLORS } from '@/lib/colors'
import { t } from '@/i18n'

// Foreground-tinted, not a fixed dark hex - reads as a dim groove on a dark
// card and a light-grey one on a light card (same trick as bg-foreground/[0.08]
// elsewhere; --surface3 isn't a real token in this app's theme system).
const TRACK = 'color-mix(in srgb, var(--foreground) 8%, transparent)'

const PHASE_LABEL: Record<TrainingPlanPhase, string> = {
  base: t.plan.phaseTrack.base,
  build: t.plan.phaseTrack.build,
  peak: t.plan.phaseTrack.peak,
  taper: t.plan.phaseTrack.taper,
  raceDay: t.plan.phaseTrack.raceDay,
}

function days(from: string, to: string): number {
  return Math.max(
    1,
    Math.round((new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / 86_400_000) + 1,
  )
}

// Base -> Build -> Peak -> Taper progress bar, driven by the real Garmin Coach
// phase ranges. Garmin publishes no BASE phase, so getTrainingPlan reconstructs
// it from the gap between the plan's own start date and its first published
// phase - real dates, not a guess. Each phase is a segment sized by its length:
// past phases fill solid, the current one fills to today, upcoming ones stay on
// the track.
export function PlanPhaseTrack({ ranges, today }: { ranges: PlanPhaseRange[]; today: string }) {
  if (ranges.length < 2) return null

  return (
    <div className="mt-3.5">
      <div className="flex items-center gap-1">
        {ranges.map((r) => {
          const color = TRAINING_PLAN_PHASE_COLORS[r.phase] ?? 'var(--accent)'
          const isPast = r.endDate < today
          const isCurrent = r.startDate <= today && today <= r.endDate
          const progress = isCurrent
            ? Math.min(100, Math.max(0, (days(r.startDate, today) / days(r.startDate, r.endDate)) * 100))
            : 0
          const background = isPast
            ? color
            : isCurrent
              ? `linear-gradient(90deg, ${color} ${progress}%, ${TRACK} ${progress}%)`
              : TRACK
          return (
            <div
              key={r.startDate}
              className="h-[5px] rounded-[3px]"
              style={{ flex: days(r.startDate, r.endDate), background }}
            />
          )
        })}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-micro font-semibold uppercase tracking-[0.04em]">
        {ranges.map((r) => {
          const color = TRAINING_PLAN_PHASE_COLORS[r.phase] ?? 'var(--accent)'
          const active = r.endDate >= today && r.startDate <= today
          const done = r.endDate < today
          return (
            <span
              key={r.startDate}
              style={{ color: active || done ? color : 'var(--subtle)' }}
            >
              {PHASE_LABEL[r.phase]}
            </span>
          )
        })}
      </div>
    </div>
  )
}
