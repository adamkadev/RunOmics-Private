import { Flame } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { formatClock, formatDateWithYear } from '@/lib/formatters'
import { t } from '@/i18n'
import type { PbAlert } from '@/application/usecases/GetPbAlerts'

export function PbAlertCard({ alerts }: { alerts: PbAlert[] }) {
  if (alerts.length === 0) return null

  const s = t.pbAlerts

  return (
    <Card padding="base" className="border-amber-500">
      <div className="flex items-center gap-2">
        <Flame className="h-4 w-4 text-amber-500" aria-hidden="true" />
        <span className="text-sm font-semibold text-foreground">{s.title}</span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{s.subtitle}</p>

      <ul className="mt-3 space-y-1.5">
        {alerts.map((alert) => (
          <li key={alert.key} className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">{alert.label}</span>
            <span className="text-muted-foreground">
              {s.off(formatClock(alert.diffSeconds))} · {formatDateWithYear(alert.date)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
