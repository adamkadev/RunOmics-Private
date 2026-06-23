import { Trophy } from 'lucide-react'
import { t } from '@/i18n'

interface Props {
  labels: string[]
}

export function PrBadge({ labels }: Props) {
  if (labels.length === 0) return null
  return (
    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
      <Trophy size={11} />
      {t.activity.bestEfforts.prBadge} - {labels.join(' - ')}
    </span>
  )
}
