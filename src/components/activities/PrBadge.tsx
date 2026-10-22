import type { QualifiedEffort } from '@/application/usecases/GetRecords'
import { t } from '@/i18n'

interface Props {
  efforts: QualifiedEffort[]
}

export function PrBadge({ efforts }: Props) {
  if (efforts.length === 0) return null
  const s = t.activity.bestEfforts
  const text = efforts.map((e) => `${e.rank === 1 ? s.prBadge : s.rankBadge(e.rank)} ${t.records.badgeLabels[e.key] ?? e.label}`).join(' · ')

  return (
    <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-[var(--segmented-track)] text-[var(--tone-caution)] px-2 py-[1px] text-caption font-semibold">
      {text}
    </span>
  )
}
