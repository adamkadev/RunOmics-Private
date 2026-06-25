import { siNike, siAdidas, type SimpleIcon } from 'simple-icons'
import { Footprints } from 'lucide-react'
import { cn } from '@/lib/utils'

const BRAND_ICONS: Record<string, SimpleIcon> = {
  Nike: siNike,
  Adidas: siAdidas,
}

interface Props {
  brand: string
  size?: number
  className?: string
}

export function BrandIcon({ brand, size = 16, className }: Props) {
  const icon = BRAND_ICONS[brand]
  if (!icon) return <Footprints size={size} className={className} />

  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn('dark:invert', className)}
      style={{ fill: `#${icon.hex}` }}
    >
      <title>{icon.title}</title>
      <path d={icon.path} />
    </svg>
  )
}
