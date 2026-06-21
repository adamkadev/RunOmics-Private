import { Gauge } from 'lucide-react'
import { Badge } from '@/components/ui/Card'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/lib/utils'
import type { WeeklyLoadComparison, WeekLoadLevel } from '@/application/usecases/GetWeeklyLoadComparison'
import { t } from '@/i18n'

const LEVEL_STYLE: Record<WeekLoadLevel, string> = {
  low: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  normal: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  high: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
}

export function WeekLoadBadge({ data }: { data: WeeklyLoadComparison }) {
  const s = t.dashboard.weekLoad

  return (
    <Tooltip content={s.tooltip(data.window)}>
      <Badge className={cn('whitespace-nowrap', LEVEL_STYLE[data.level])}>
        <Gauge size={11} className="mr-1 shrink-0" />
        {s.label(data.percent)}
      </Badge>
    </Tooltip>
  )
}
