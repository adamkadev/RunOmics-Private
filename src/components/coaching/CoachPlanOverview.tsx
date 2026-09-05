import Link from 'next/link'
import { CalendarCheck, Flag, Sparkles } from 'lucide-react'
import type { CoachingOverview, PrescriptionDisplayState, PrescriptionView } from '@/application/coaching/GetCoachingView'
import type { GarminScheduleStatus, WorkoutBlock } from '@/domain/coaching/types'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill'
import { formatClock, formatDate, formatDurationWords } from '@/lib/formatters'
import { t } from '@/i18n'

const STATE_TONE: Record<PrescriptionDisplayState, StatusTone> = {
  prescribed: 'blue',
  adjusted: 'amber',
  completed: 'emerald',
  missed: 'red',
  cancelled: 'zinc',
}

const GARMIN_TONE: Record<GarminScheduleStatus, StatusTone> = {
  scheduled_match: 'emerald',
  scheduled_different: 'amber',
  scheduled_unknown: 'zinc',
  not_scheduled: 'zinc',
}

function segmentDuration(seconds: number): string {
  return seconds < 60 ? `${seconds}s` : formatDurationWords(seconds)
}

function targetText(block: WorkoutBlock): string {
  if (block.kind === 'repeat') {
    const effort = block.steps.find((step) => step.kind === 'effort')
      ?? block.steps.find((step) => step.kind === 'strides')
    const recovery = block.steps.find((step) => step.kind === 'recovery')
    const effortText = effort?.target.durationSeconds
      ? segmentDuration(effort.target.durationSeconds)
      : effort?.target.distanceMeters
        ? `${effort.target.distanceMeters} m`
        : ''
    const pace = effort?.target.paceSecPerKm
    const paceText = pace ? ` @ ${formatClock(pace.min)}-${formatClock(pace.max)} /km` : ''
    const kindText = effort?.kind === 'strides' ? ` ${t.coaching.segments.strides}` : ''
    const recoveryText = recovery?.target.durationSeconds ? ` · ${segmentDuration(recovery.target.durationSeconds)} ${t.coaching.segments.recovery}` : ''
    return `${block.repetitions} × ${effortText}${kindText}${paceText}${recoveryText}`
  }
  if (block.target.distanceMeters) return `${(block.target.distanceMeters / 1_000).toFixed(1)} km ${t.coaching.segments[block.kind]}`
  return `${formatDurationWords(block.target.durationSeconds ?? 0)} ${t.coaching.segments[block.kind]}`
}

function WorkoutRow({ view }: { view: PrescriptionView }) {
  const content = (
    <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.04] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{formatDate(view.prescription.date)}</p>
          <p className="mt-0.5 truncate text-sm font-bold text-foreground">{view.prescription.title}</p>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            {view.prescription.blocks.map(targetText).join(' · ')}
          </p>
        </div>
        <CalendarCheck size={18} className="shrink-0 text-accent-text" />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <StatusPill tone={STATE_TONE[view.state]}>{t.coaching.states[view.state]}</StatusPill>
        <StatusPill tone={GARMIN_TONE[view.garminStatus]}>{t.coaching.garmin[view.garminStatus]}</StatusPill>
      </div>
    </div>
  )
  return view.activityId ? <Link href={`/activities/${view.activityId}`}>{content}</Link> : content
}

export function CoachPlanOverview({ coaching }: { coaching: CoachingOverview }) {
  const currentWeek = coaching.plan.weeks.find((week) => week.id === coaching.currentWeekId) ?? coaching.plan.weeks[0]
  const relevant = coaching.workouts.filter((view) => currentWeek?.workouts.some((workout) => workout.id === view.prescription.id))

  return (
    <GlassSurface variant="card" className="rounded-[22px] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="widget-label flex items-center gap-1.5 text-accent-text"><Sparkles size={13} />{t.coaching.coach}</p>
          <h2 className="mt-1 font-display text-xl font-bold text-foreground">{coaching.plan.block.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{coaching.plan.block.focus}</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <Flag size={15} className="ml-auto mb-1 text-accent-text" />
          <div className="font-semibold text-foreground">{coaching.plan.targetEvent.name}</div>
          <div>{formatDate(coaching.plan.targetEvent.date)}</div>
        </div>
      </div>

      {coaching.latestDecision && (
        <div className="mt-3 rounded-xl bg-accent/[0.08] px-3 py-2.5">
          <div className="flex items-center gap-2">
            <StatusPill tone={coaching.latestDecision.outcome === 'KEEP' ? 'emerald' : 'amber'}>
              {t.coaching.outcomes[coaching.latestDecision.outcome]}
            </StatusPill>
            <span className="text-xs font-semibold text-foreground">{t.coaching.latestDecision}</span>
          </div>
          <p className="mt-1.5 text-sm leading-snug text-muted-foreground">{coaching.latestDecision.summary}</p>
        </div>
      )}

      {currentWeek && (
        <div className="mt-4">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-bold text-foreground">{t.coaching.thisWeek}</h3>
            <span className="text-xs text-muted-foreground">{currentWeek.focus}</span>
          </div>
          <div className="space-y-2">{relevant.map((view) => <WorkoutRow key={view.prescription.id} view={view} />)}</div>
        </div>
      )}
    </GlassSurface>
  )
}
