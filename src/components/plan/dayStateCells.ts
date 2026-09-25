import type { WeekTarget } from '@/domain/training/weekTarget'
import type { DayStateCell } from '@/components/ui/DayStateStrip'
import { runTypeColor } from '@/lib/colors'
import { formatDate } from '@/lib/formatters'
import { t } from '@/i18n'

/**
 * A week's days as DayStateStrip draws them, from the same WeekTarget the
 * week's totals come from - so the strip and the summary above it cannot
 * disagree about which day was run, missed or is still to come.
 */
export function dayStateCells(
  days: WeekTarget['days'],
  today: string,
  label: 'initial' | 'short',
): DayStateCell[] {
  return days.map((day, i) => {
    const weekday = t.plan.weekdays[i] ?? ''
    return {
      date: day.date,
      label: label === 'initial' ? weekday.slice(0, 1) : weekday,
      fullLabel: formatDate(day.date, { style: 'full' }),
      state: day.state,
      color: runTypeColor(day.type),
      km: day.state === 'done' ? day.ranKm : day.plannedKm,
      isToday: day.date === today,
      ...(day.plannedType ? { plannedColor: runTypeColor(day.plannedType) } : {}),
    }
  })
}
