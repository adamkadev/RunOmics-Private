import { Footprints } from 'lucide-react'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'
import { formatDate } from '@/lib/formatters'
import { Card, Badge } from '@/components/ui/Card'
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

function ShoeCard({ shoe }: { shoe: ShoeStats }) {
  return (
    <Card padding="lg" className={cn(shoe.retired && 'opacity-60')}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{shoe.brand}</p>
            {shoe.retired && (
              <Badge className="bg-muted text-muted-foreground">{t.shoes.retired}</Badge>
            )}
          </div>
          <h3 className="text-base font-bold text-foreground">{shoe.name}</h3>
        </div>
        <span className={`text-sm font-semibold ${wearTextClass(shoe.wearPercent)}`}>
          {shoe.wearPercent}%
        </span>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${wearBarClass(shoe.wearPercent)}`}
          style={{ width: `${shoe.wearPercent}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-subtle">
        <span>{t.shoes.kmOf(shoe.totalKm, shoe.maxKm)}</span>
        <span>{t.shoes.sessions(shoe.sessionCount)}</span>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {shoe.lastUsedDate ? t.shoes.lastRun(formatDate(shoe.lastUsedDate)) : t.shoes.neverUsed}
      </p>
    </Card>
  )
}

export function ShoesGrid({ shoes }: { shoes: ShoeStats[] }) {
  if (shoes.length === 0) {
    return (
      <Card padding="lg" className="flex flex-col items-center gap-2 py-10 text-center">
        <Footprints size={24} className="text-subtle" />
        <p className="text-sm text-subtle">{t.shoes.neverUsed}</p>
      </Card>
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
