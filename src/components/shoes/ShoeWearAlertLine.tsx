import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { t } from '@/i18n'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'

export function ShoeWearAlertLine({ shoes }: { shoes: ShoeStats[] }) {
  const alerts = shoes.filter((s) => s.nearingLimit)
  if (alerts.length === 0) return null

  return (
    <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400">
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      {alerts.map((shoe, i) => (
        <span key={shoe.gearId} className="flex items-center gap-1.5">
          <Link href={`/shoes/${shoe.gearId}`} className="underline-offset-2 hover:underline">
            {t.shoes.wearAlert(shoe.name, shoe.totalKm, shoe.alertThresholdKm)}
          </Link>
          {i < alerts.length - 1 && <span aria-hidden="true">·</span>}
        </span>
      ))}
    </p>
  )
}
