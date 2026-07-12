import Link from 'next/link'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { BrandIcon } from '@/components/shoes/BrandIcon'
import { STATUS } from '@/lib/statusColors'
import { formatCompactDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

type WearStatus = 'ok' | 'watch' | 'replace'

// Deterministic decision layer over the wear percent - the card leads with a
// verdict word, not a raw number the reader has to interpret.
function wearStatus(pct: number): WearStatus {
  if (pct >= 90) return 'replace'
  if (pct >= 70) return 'watch'
  return 'ok'
}

const WEAR_STYLE: Record<WearStatus, { bar: string; text: string; border: string }> = {
  ok:      { bar: STATUS.success.dot, text: STATUS.success.text, border: 'border-accent/20' },
  watch:   { bar: STATUS.warning.dot, text: STATUS.warning.text, border: 'border-amber-400/50' },
  replace: { bar: STATUS.danger.dot,  text: STATUS.danger.text,  border: 'border-red-500/50' },
}

function ShoeCard({ shoe }: { shoe: ShoeStats }) {
  const status = wearStatus(shoe.wearPercent)
  const style = WEAR_STYLE[status]
  const kmLeft = Math.max(0, Math.round(shoe.maxKm - shoe.totalKm))

  return (
    <Link
      href={`/shoes/${shoe.gearId}`}
      className={cn(
        'glass-card block rounded-card-sm p-5 transition-transform active:scale-[0.99]',
        shoe.retired ? 'opacity-65' : style.border
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <BrandIcon brand={shoe.brand} size={16} />
            <p className="widget-label text-muted-foreground">{shoe.brand}</p>
          </div>
          <h3 className="text-base font-bold text-foreground">{shoe.name}</h3>
        </div>
        {!shoe.retired && (
          <span className={cn('shrink-0 text-right text-xs font-semibold', style.text)}>
            {t.shoes.status[status]}
            <span className="block text-sm font-bold tabular-nums">{shoe.wearPercent}%</span>
          </span>
        )}
      </div>

      {shoe.retired ? (
        <div className="flex items-center justify-between text-xs text-subtle">
          <span className="font-medium text-foreground">{Math.round(shoe.totalKm)} km</span>
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground">{t.shoes.retired}</span>
            {shoe.lastUsedDate && (
              <span>{formatCompactDate(shoe.lastUsedDate)}</span>
            )}
          </span>
        </div>
      ) : (
        <>
          <div className="h-2 overflow-hidden rounded-full bg-foreground/[0.08]">
            <div
              className={`h-full rounded-full transition-all ${style.bar}`}
              style={{ width: `${shoe.wearPercent}%` }}
            />
          </div>
          <p className="mt-2.5 flex items-center justify-between text-xs text-subtle">
            <span>{t.shoes.kmOf(Math.round(shoe.totalKm), shoe.maxKm)} · {t.common.sessions(shoe.sessionCount)}</span>
            <span className="font-medium">{t.shoes.kmLeft(kmLeft)}</span>
          </p>
        </>
      )}
    </Link>
  )
}

export function ShoesGrid({ shoes }: { shoes: ShoeStats[] }) {
  if (shoes.length === 0) {
    return (
      <GlassSurface variant="card" className="rounded-card-sm border-dashed py-10 text-center">
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
