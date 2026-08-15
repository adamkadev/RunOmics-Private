import type { ShoeTag } from '@/domain/shoe/types'

interface Props {
  shoe: ShoeTag
}

export function ShoePairTag({ shoe }: Props) {
  return (
    <span className="glass-map-chip inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 py-1.5 text-xs font-semibold">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: shoe.dotColor }} />
      {shoe.name}
    </span>
  )
}
