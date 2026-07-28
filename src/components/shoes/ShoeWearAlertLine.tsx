import Link from 'next/link'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { t } from '@/i18n'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'

// Secondary-tier alert card, matching DashboardHighlights - a shoe past its
// wear threshold needs more visual weight than a plain line of body text.
export function ShoeWearAlertLine({ shoes }: { shoes: ShoeStats[] }) {
  const alerts = shoes.filter((s) => s.nearingLimit)
  if (alerts.length === 0) return null

  return (
    <div className="space-y-2">
      {alerts.map((shoe) => (
        <Link
          key={shoe.gearId}
          href={`/shoes/${shoe.gearId}`}
          className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] px-3.5 py-3 transition-colors active:opacity-80"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-amber-500/[0.18]">
            <AlertTriangle size={17} className="text-amber-600 dark:text-amber-400" aria-hidden="true" />
          </div>
          <p className="min-w-0 flex-1 text-footnote font-medium leading-snug text-amber-700 dark:text-amber-300">
            {t.shoes.wearAlert(shoe.name, shoe.totalKm, shoe.alertThresholdKm)}
          </p>
          <ChevronRight size={16} className="shrink-0 text-amber-600/70 dark:text-amber-400/70" aria-hidden="true" />
        </Link>
      ))}
    </div>
  )
}
