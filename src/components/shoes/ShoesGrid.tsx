import { Footprints } from 'lucide-react'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'
import { Badge } from '@/components/ui/Card'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { BrandIcon } from '@/components/shoes/BrandIcon'
import { STATUS } from '@/lib/statusColors'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

function wearBarClass(pct: number): string {
  if (pct >= 90) return STATUS.danger.dot
  if (pct >= 70) return STATUS.warning.dot
  return STATUS.success.dot
}

function wearTextClass(pct: number): string {
  if (pct >= 90) return STATUS.danger.text
  if (pct >= 70) return STATUS.warning.text
  return STATUS.success.text
}

function wearBorderClass(pct: number): string {
  if (pct >= 90) return 'border-red-500/50'
  if (pct >= 70) return 'border-amber-400/50'
  return 'border-accent/20'
}

function wearAlertBadge(pct: number): { label: string; className: string } | null {
  if (pct >= 90) return { label: t.shoes.criticalBadge, className: STATUS.danger.badge }
  if (pct >= 70) return { label: t.shoes.alertBadge,    className: STATUS.warning.badge }
  return null
}

// Compact date: "Jun 16" (current year) or "Jan '25" (past year).
function formatShoeDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00')
  const currentYear = new Date().getFullYear()
  return d.toLocaleDateString('en-US', d.getFullYear() === currentYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', year: '2-digit' }
  )
}

function ShoeCard({ shoe }: { shoe: ShoeStats }) {
  const alertBadge = !shoe.retired ? wearAlertBadge(shoe.wearPercent) : null

  return (
    <div
      className={cn(
        'glass-card rounded-card-sm p-5',
        shoe.retired && 'opacity-65',
        !shoe.retired && wearBorderClass(shoe.wearPercent)
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <BrandIcon brand={shoe.brand} size={16} />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{shoe.brand}</p>
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

      {shoe.retired ? (
        <div className="flex items-center justify-between text-xs text-subtle">
          <span className="font-medium text-foreground">{Math.round(shoe.totalKm)} km</span>
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground">{t.shoes.retired}</span>
            {shoe.lastUsedDate && (
              <span>{formatShoeDate(shoe.lastUsedDate)}</span>
            )}
          </span>
        </div>
      ) : (
        <>
          <div className="h-2 overflow-hidden rounded-full bg-foreground/[0.08]">
            <div
              className={`h-full rounded-full transition-all ${wearBarClass(shoe.wearPercent)}`}
              style={{ width: `${shoe.wearPercent}%` }}
            />
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-1 text-xs text-subtle">
            <span>{Math.round(shoe.totalKm)} / {shoe.maxKm} km</span>
            <span className="text-center">{t.common.sessions(shoe.sessionCount)}</span>
            <span className="text-right">
              {shoe.lastUsedDate ? formatShoeDate(shoe.lastUsedDate) : '-'}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

export function ShoesGrid({ shoes }: { shoes: ShoeStats[] }) {
  if (shoes.length === 0) {
    return (
      <GlassSurface variant="card" className="flex flex-col items-center gap-2 rounded-card-sm border-dashed py-10 text-center">
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
