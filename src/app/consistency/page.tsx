import { getConsistencyData } from '@/application/usecases/GetConsistencyData'
import { appTodayIso } from '@/lib/calendarDate'
import { ConsistencyMonths } from '@/components/consistency/ConsistencyMonths'
import { consistencyMonths } from '@/components/consistency/consistencyMonthsView'
import { BackButton } from '@/components/ui/BackButton'
import { t } from '@/i18n'

export const revalidate = 3600

// Consistency is its own Progress page, reached from the hub: the rolling
// year counted, its last six months as week columns, and its months (3.0).
export default function ConsistencyPage() {
  const today = appTodayIso()
  const { days, ...options } = getConsistencyData(today)
  const view = consistencyMonths(days, today, options)
  const p = t.pages.consistency
  return (
    <div className="flex flex-col gap-3.5">
      <header className="mb-1.5">
        <BackButton label={p.back} fallbackHref="/profile" className="mb-3.5" />
        <h1 className="text-display text-foreground">{p.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{view.range ?? p.rolling}</p>
      </header>
      <ConsistencyMonths view={view} />
    </div>
  )
}
