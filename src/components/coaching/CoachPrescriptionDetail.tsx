import Link from 'next/link'
import type { PrescriptionView } from '@/application/coaching/GetCoachingView'
import type { WorkoutSegment } from '@/domain/coaching/types'
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill'
import { prescriptionSummary, prescriptionTarget } from './presentation'
import { t } from '@/i18n'

const STATE_TONE: Record<PrescriptionView['state'], StatusTone> = { prescribed: 'blue', adjusted: 'amber', completed: 'emerald', missed: 'red', cancelled: 'zinc' }
const GARMIN_TONE: Record<PrescriptionView['garminStatus'], StatusTone> = { scheduled_match: 'emerald', scheduled_different: 'amber', scheduled_unknown: 'zinc', not_scheduled: 'zinc' }

function Segment({ segment }: { segment: WorkoutSegment }) {
  return <div>
    <p className="text-sm text-foreground"><span className="font-semibold capitalize">{t.coaching.segments[segment.kind]}</span> · {prescriptionTarget(segment.target)}</p>
    {segment.notes?.map((note, i) => <p key={i} className="mt-1 text-xs leading-relaxed text-muted-foreground">{note}</p>)}
  </div>
}

/**
 * The selected day's prescription, in the Today slot the Plan page already has:
 * name, size and intent by default, with the block-by-block breakdown behind a
 * disclosure so the card stays as short as the planned-workout row it replaces.
 */
export function CoachPrescriptionDetail({ view }: { view: PrescriptionView }) {
  const workout = view.prescription
  const summary = prescriptionSummary(workout)
  return (
    <section
      aria-label={t.coaching.prescription}
      data-testid="coach-prescription-detail"
      className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-foreground">{workout.title}</h3>
          {summary && <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{summary}</p>}
        </div>
        <StatusPill tone={STATE_TONE[view.state]}>{t.coaching.states[view.state]}</StatusPill>
      </div>

      {workout.description && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{workout.description}</p>
      )}

      <details className="group mt-2">
        <summary className="cursor-pointer text-xs font-semibold text-accent-text marker:text-accent-text">
          {t.coaching.showStructure}
        </summary>
        <ol className="mt-2 space-y-3 border-l-2 border-accent/20 pl-3">
          {workout.blocks.map((block, i) => <li key={i}>
            {block.kind === 'repeat' ? <>
              <p className="mb-1 text-xs font-bold text-accent-text">{block.repetitions} × {block.steps[0]?.target.durationSeconds && block.steps[0].target.durationSeconds < 60 ? `${block.steps[0].target.durationSeconds}s ` : ''}{block.steps[0]?.kind === 'strides' ? t.coaching.segments.strides : t.coaching.repetitions}</p>
              <div className="space-y-2">{block.steps.map((step, j) => <Segment key={j} segment={step} />)}</div>
            </> : <Segment segment={block} />}
          </li>)}
        </ol>
        {workout.notes?.map((note, i) => <p key={i} className="mt-2 text-xs leading-relaxed text-muted-foreground">{note}</p>)}
      </details>

      <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-foreground/[0.08] pt-2.5">
        <StatusPill tone={GARMIN_TONE[view.garminStatus]}>{t.coaching.garmin[view.garminStatus]}</StatusPill>
        {view.activityId && <Link className="text-xs font-semibold text-accent-text underline" href={`/activities/${view.activityId}`}>{t.coaching.actual}</Link>}
      </div>
    </section>
  )
}
