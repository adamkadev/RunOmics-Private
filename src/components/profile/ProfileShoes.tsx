import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlassSurface } from '@/components/ui/GlassSurface'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'
import { t } from '@/i18n'

function wearFillClass(pct: number): string {
  if (pct > 80) return 'bg-[#e5396b]'
  if (pct > 60) return 'bg-[#f0a500]'
  return 'bg-[#2ed9a0]'
}

export function ProfileShoes({ shoes }: { shoes: ShoeStats[] }) {
  if (shoes.length === 0) return null

  return (
    <GlassSurface variant="card" className="rounded-[22px] p-5">
      <h2 className="mb-3 text-sm font-bold text-foreground">{t.profile.shoes.title}</h2>
      <div>
        {shoes.map((shoe, i) => {
          const remainingKm = Math.max(0, Math.round(shoe.maxKm - shoe.totalKm))
          return (
            <div
              key={shoe.gearId}
              className={cn(
                'flex items-center gap-3 py-3',
                i < shoes.length - 1 && 'border-b border-foreground/[0.07]'
              )}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-foreground/[0.10] bg-foreground/[0.07] text-lg"
                aria-hidden="true"
              >
                👟
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold text-foreground">{shoe.name}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {t.profile.shoes.line(Math.round(shoe.totalKm), remainingKm)}
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-foreground/[0.08]">
                  <div
                    className={cn('h-full rounded-full', wearFillClass(shoe.wearPercent))}
                    style={{ width: `${shoe.wearPercent}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <Link
        href="/shoes"
        className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-accent-text active:scale-95"
      >
        {t.profile.shoes.viewShoes} <ArrowRight size={14} />
      </Link>
    </GlassSurface>
  )
}
