import { SHOE_REGISTRY } from '@/domain/shoe/types'

interface Props {
  gearId: string | null
}

export function ShoePairTag({ gearId }: Props) {
  const shoe = gearId ? SHOE_REGISTRY[gearId] : undefined
  if (!shoe) return null
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: shoe.dotColor }}
      />
      {shoe.name}
    </span>
  )
}
