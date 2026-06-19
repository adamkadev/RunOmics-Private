import { Footprints } from 'lucide-react'
import { SHOE_REGISTRY } from '@/domain/shoe/types'

interface Props {
  gearId: string | null
}

export function ShoePairTag({ gearId }: Props) {
  const shoe = gearId ? SHOE_REGISTRY[gearId] : undefined
  if (!shoe) return null
  return (
    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
      <Footprints size={11} />
      {shoe.name}
    </span>
  )
}
