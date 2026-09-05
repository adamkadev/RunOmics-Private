import type { PrescriptionView } from '@/application/coaching/GetCoachingView'
import { COACHING_TO_ACTIVITY_TYPE } from '@/domain/coaching/types'
import { ACTIVITY_TYPE_CONFIG } from '@/domain/activity/types'
import { isKeyPrescription, prescriptionSize } from './presentation'
import { t } from '@/i18n'

const WEEKDAY_INDEX: Record<number, string> = {
  0: t.plan.weekdays[6] ?? 'Sun',
  1: t.plan.weekdays[0] ?? 'Mon',
  2: t.plan.weekdays[1] ?? 'Tue',
  3: t.plan.weekdays[2] ?? 'Wed',
  4: t.plan.weekdays[3] ?? 'Thu',
  5: t.plan.weekdays[4] ?? 'Fri',
  6: t.plan.weekdays[5] ?? 'Sat',
}

/** Coach prescription in the Coming Up list, shaped exactly like the planned-workout row. */
export function CoachComingUpRow({ view, onTap }: { view: PrescriptionView; onTap: () => void }) {
  const workout = view.prescription
  const typeColor = ACTIVITY_TYPE_CONFIG[COACHING_TO_ACTIVITY_TYPE[workout.type]].chartColor
  const weekday = WEEKDAY_INDEX[new Date(workout.date + 'T00:00:00').getDay()]
  const size = prescriptionSize(workout)
  const tag = isKeyPrescription(workout) ? t.plan.keyTag : size || null

  return (
    <button
      type="button"
      onClick={onTap}
      data-testid={`coach-coming-up-${workout.id}`}
      className="flex w-full items-center gap-2.5 rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] p-2.5 text-left transition-colors hover:bg-foreground/[0.07]"
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: typeColor }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-foreground">{workout.title}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {[weekday, isKeyPrescription(workout) ? size : null].filter(Boolean).join(' · ')}
        </span>
      </span>
      {tag && <span className="shrink-0 text-xs font-medium text-muted-foreground">{tag}</span>}
    </button>
  )
}
