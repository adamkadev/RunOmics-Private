import Link from 'next/link'
import { Footprints } from 'lucide-react'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'
import { formatDate } from '@/lib/formatters'
import { Badge } from '@/components/ui/Card'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { BrandIcon } from '@/components/shoes/BrandIcon'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

function wearBarClass(pct: number): string {
  if (pct >= 90) return 'bg-red-500'
  if (pct >= 70) return 'bg-amber-400'
  return 'bg-accent'
}

function wearTextClass(pct: number): string {
  if (pct >= 90) return 'text-red-600 dark:text-red-400'
  if (pct >= 70) return 'text-amber-600 dark:text-amber-400'
  return 'text-accent-text'
}

function wearBorderClass(pct: number): string {
  if (pct >= 90) return 'border-red-500/50'
  if (pct >= 70) return 'border-amber-400/50'
  return ''
}

function wearAlertBadge(pct: number): { label: string; className: string } | null {
  if (pct >= 90) return { label: t.shoes.criticalBadge, className: 'bg-red-500/15 text-red-600 dark:text-red-400' }
  if (pct >= 70) return { label: t.shoes.alertBadge, className: 'bg-amber-400/15 text-amber-600 dark:text-amber-400' }
  return null
}

function ShoeCard({ shoe }: { shoe: ShoeStats }) {
  const alertBadge = !shoe.retired ? wearAlertBadge(shoe.wearPercent) : null
  return (
    <Link
      href={`/shoes/${shoe.gearId}`}
      className={cn(
        'glass-card rounded-[20px] p-5 transition-shadow hover:shadow-md',
        shoe.retired && 'opacity-65',
        !shoe.retired && wearBorderClass(shoe.wearPercent)
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <BrandIcon brand={shoe.brand} size={14} />
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{shoe.brand}</p>
            {shoe.retired && (
              <Badge className="bg-foreground/[0.08] text-muted-foreground">{t.shoes.retired}</Badge>
            )}
            {alertBadge && <Badge className={alertBadge.className}>{alertBadge.label}</Badge>}
          </div>
          <h3 className="text-base font-bold text-foreground">{shoe.name}</h3>
        </div>
        {!shoe.retired && (
          <span className={`text-sm font-semibold ${wearTextClass(shoe.wearPercent)}`}>
            {shoe.wearPercent}%
          </span>
        )}
      </div>

      {!shoe.retired && (
        <div className="h-[5px] overflow-hidden rounded-full bg-foreground/[0.08]">
          <div
            className={`h-full rounded-full transition-all ${wearBarClass(shoe.wearPercent)}`}
            style={{ width: `${shoe.wearPercent}%` }}
          />
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-xs text-subtle">
        <span>{t.shoes.kmOf(shoe.totalKm, shoe.maxKm)}</span>
        <span>{t.shoes.sessions(shoe.sessionCount)}</span>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {shoe.lastUsedDate ? t.shoes.lastRun(formatDate(shoe.lastUsedDate)) : t.shoes.neverUsed}
      </p>
    </Link>
  )
}

export function ShoesGrid({ shoes }: { shoes: ShoeStats[] }) {
  if (shoes.length === 0) {
    return (
      <GlassSurface variant="card" className="flex flex-col items-center gap-2 rounded-[20px] border-dashed py-10 text-center">
        <Footprints size={24} className="text-subtle" />
        <p className="text-sm text-subtle">{t.shoes.neverUsed}</p>
      </GlassSurface>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {shoes.map((shoe) => (
        <ShoeCard key={shoe.gearId} shoe={shoe} />
      ))}
    </div>
  )
}
