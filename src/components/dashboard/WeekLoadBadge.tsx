import { StatusPill, type StatusTone } from '@/components/ui/StatusPill'
import { Tooltip } from '@/components/ui/Tooltip'
import type { WeeklyLoadComparison, WeekLoadLevel } from '@/application/usecases/GetWeeklyLoadComparison'
import { t } from '@/i18n'

const LEVEL_TONE: Record<WeekLoadLevel, StatusTone> = {
  low: 'blue',
  normal: 'green',
  high: 'amber',
  'in-progress': 'zinc',
}

export function WeekLoadBadge({ data }: { data: WeeklyLoadComparison }) {
  const s = t.dashboard.weekLoad

  return (
    <Tooltip content={s.tooltip(data.window, data.level)}>
      <StatusPill tone={LEVEL_TONE[data.level]}>
        {s.label(data.percent, data.level)}
      </StatusPill>
    </Tooltip>
  )
}
