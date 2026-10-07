import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { Vo2GradeView } from '@/application/usecases/GetVo2Grade'
import { VO2_GRADE_HREF } from '@/components/profile/Vo2GradeCard'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { formatKm } from '@/lib/formatters'
import { t } from '@/i18n'

/**
 * Today's one grade row (v5.3 G3): only for the three days after the grade
 * goes up - never for a drop or a steady grade. The letter sits on the
 * segmented grey in ink, no accent; the "↑ from B+" is --good. Tap → G2.
 */
export function Vo2GradeTodayRow({ view }: { view: Vo2GradeView | null }) {
  if (view?.status !== 'graded' || view.change?.kind !== 'up') return null
  const g = t.vo2Grade
  return (
    <Link href={VO2_GRADE_HREF} aria-label={g.open} className="block active:scale-[0.99]" data-testid="vo2-grade-today">
      <GlassSurface variant="card" className="flex items-center gap-3 px-4 py-3">
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
        <ChevronRight size={16} className="shrink-0 text-subtle" aria-hidden />
      </GlassSurface>
    </Link>
  )
}
