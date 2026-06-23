import { Gauge } from 'lucide-react'
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill'
import { Tooltip } from '@/components/ui/Tooltip'
import type { WeeklyLoadComparison, WeekLoadLevel } from '@/application/usecases/GetWeeklyLoadComparison'
import { t } from '@/i18n'

const LEVEL_TONE: Record<WeekLoadLevel, StatusTone> = {
  low: 'blue',
  normal: 'green',
  high: 'amber',
}

export function WeekLoadBadge({ data }: { data: WeeklyLoadComparison }) {
  const s = t.dashboard.weekLoad

  return (
    <Tooltip content={s.tooltip(data.window)}>
      <StatusPill tone={LEVEL_TONE[data.level]}>
        <Gauge size={11} className="mr-1 shrink-0" />
        {s.label(data.percent)}
      </StatusPill>
    </Tooltip>
  )
}
