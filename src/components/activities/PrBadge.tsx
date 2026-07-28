import type { QualifiedEffort } from '@/application/usecases/GetRecords'
import { t } from '@/i18n'

interface Props {
  efforts: QualifiedEffort[]
}

export function PrBadge({ efforts }: Props) {
  if (efforts.length === 0) return null
  const s = t.activity.bestEfforts
  const text = efforts.map((e) => `${e.rank === 1 ? s.prBadge : s.rankBadge(e.rank)} ${e.label}`).join(' · ')

  return (
    <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-amber-100 px-2 py-[1px] text-caption font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
      {text}
    </span>
  )
}
