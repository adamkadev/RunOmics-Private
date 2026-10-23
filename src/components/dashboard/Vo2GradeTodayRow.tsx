import Link from 'next/link'
import type { Vo2GradeView } from '@/application/usecases/GetVo2Grade'
import { VO2_GRADE_HREF } from '@/components/profile/Vo2GradeCard'
import { formatKm } from '@/lib/formatters'
import { t } from '@/i18n'
import { DismissibleRow } from './DismissibleRow'

/** Only in the three days after the grade goes up; the × puts it away until the grade changes again. */
export function Vo2GradeTodayRow({ view }: { view: Vo2GradeView | null }) {
  if (view?.status !== 'graded' || view.change?.kind !== 'up') return null
  const g = t.vo2Grade
  return (
    <DismissibleRow storageKey={`ro-vo2-grade-seen:${view.grade}:${view.change.date}`} dismissLabel={g.dismiss}>
      <Link href={VO2_GRADE_HREF} aria-label={g.open} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 active:opacity-70" data-testid="vo2-grade-today">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[var(--segmented-track)] font-display text-title3 font-bold text-foreground">
          {view.grade}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-subhead font-semibold text-foreground">{view.change.regained ? g.todayBack(view.grade) : g.todayUp(view.grade)}</span>
          <span className="block truncate text-footnote text-muted-foreground">
            <span className="text-[var(--good)]">{g.todayFrom(view.change.from)}</span>
            {g.todayRest(formatKm(view.value, 1), view.topPercent)}
          </span>
        </span>
      </Link>
    </DismissibleRow>
  )
}
