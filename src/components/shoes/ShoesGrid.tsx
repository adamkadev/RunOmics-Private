import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'
import { wearStatus } from '@/domain/shoe/wearStatus'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { formatDate, formatDateRange, formatKm } from '@/lib/formatters'
import { WEAR_COLOR, isPastLimit, shoeRole } from './shoeWear'
import { WearBar } from './WearBar'
import { t } from '@/i18n'

export function pickHeroShoe(shoes: ShoeStats[]): ShoeStats | null {
  return (
    shoes
      .filter((s) => !s.retired && wearStatus(s.wearPercent) !== 'ok')
      .sort((a, b) => b.wearPercent - a.wearPercent)[0] ?? null
  )
}

const SECTION = 'px-1 text-caption font-bold uppercase tracking-[0.1em] text-muted-foreground'
/** A pseudo-element divider insets to the text while the press tint stays full width. */
const ROW_DIVIDER = 'relative before:absolute before:inset-x-5 before:top-0 before:h-px before:bg-border first:before:hidden'

export function shoeMeta(shoe: ShoeStats): string {
  const s = t.shoes
  if (isPastLimit(shoe)) return `${s.kmOf(formatKm(shoe.totalKm), formatKm(shoe.maxKm))} · ${s.overLimit}`
  return [
    s.kmOf(formatKm(shoe.totalKm), formatKm(shoe.maxKm)),
    s.runs(shoe.sessionCount),
    shoe.lastUsedDate ? s.lastRun(formatDate(shoe.lastUsedDate, { style: 'bare' })) : null,
    shoeRole(shoe.mainType ?? null),
  ]
    .filter(Boolean)
    .join(' · ')
}

function RotationRow({ shoe, context, tickLabel }: { shoe: ShoeStats; context: string | null; tickLabel: boolean }) {
  const left = Math.max(0, Math.round(shoe.maxKm - shoe.totalKm))
  const over = isPastLimit(shoe)
  const status = wearStatus(shoe.wearPercent)
  return (
    // ?from=shoes sends the pair's back button here, not to Progress.
    <Link href={`/shoes/${shoe.gearId}?from=shoes`} className={cn(ROW_DIVIDER, 'block px-5 py-3.5 transition-colors active:bg-foreground/[0.04]')} data-testid="shoe-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-caption uppercase tracking-[0.08em] text-muted-foreground">{shoe.brand}</p>
          <p className="truncate font-display text-body font-bold text-foreground">{shoe.name}</p>
        </div>
        <div className="flex shrink-0 items-start gap-1.5">
          <div className="flex flex-col items-end gap-1">
            {!over && (
              <p className="text-footnote text-muted-foreground">
                <span className="font-display text-body font-bold tabular-nums text-foreground">{formatKm(left)}</span> {t.shoes.kmLeftShort}
              </p>
            )}
            {status !== 'ok' && (
              <span
                data-testid="shoe-verdict-pill"
                className="rounded-md px-2 py-0.5 text-caption font-semibold uppercase tracking-[0.08em]"
                style={{ color: WEAR_COLOR[status], background: `color-mix(in srgb, ${WEAR_COLOR[status]} 15%, transparent)` }}
              >
                {t.shoes.status[status]}
              </span>
            )}
          </div>
          <ChevronRight size={16} className="mt-0.5 text-muted-foreground" aria-hidden="true" />
        </div>
      </div>
      <WearBar
        totalKm={shoe.totalKm}
        maxKm={shoe.maxKm}
        tickKm={shoe.alertThresholdKm}
        tickLabel={tickLabel ? t.shoes.detail.retireFromWorkouts(formatKm(shoe.alertThresholdKm)) : undefined}
        limitLabel={t.shoes.detail.limitTick(formatKm(shoe.maxKm))}
        className="mt-3"
      />
      <p className="mt-2.5 text-footnote tabular-nums text-muted-foreground" data-testid="shoe-meta">{shoeMeta(shoe)}</p>
      {context && <p className="mt-1 text-footnote text-foreground/80">{context}</p>}
    </Link>
  )
}

function retiredSubline(shoe: ShoeStats): string {
  const era = shoe.firstUsedDate && shoe.lastUsedDate
    ? formatDateRange(shoe.firstUsedDate, shoe.lastUsedDate, { precision: 'month' })
    : shoe.lastUsedDate
      ? formatDate(shoe.lastUsedDate, { precision: 'month', style: 'bare' })
      : '-'
  return `${era} · ${t.shoes.runs(shoe.sessionCount)}`
}

interface Props {
  shoes: ShoeStats[]
  insights?: Record<string, string>
  compare?: ReactNode
}

export function ShoesGrid({ shoes, insights = {}, compare }: Props) {
  if (shoes.length === 0) {
    return (
      <GlassSurface variant="card" className="rounded-card-sm border-dashed py-10 text-center">
        <p className="text-sm text-subtle">{t.shoes.neverUsed}</p>
      </GlassSurface>
    )
  }

  const active = shoes.filter((shoe) => !shoe.retired).sort((a, b) => b.wearPercent - a.wearPercent)
  const sharedTickKm = active.length > 0 && active.every((shoe) => shoe.alertThresholdKm === active[0]!.alertThresholdKm) ? active[0]!.alertThresholdKm : null
  const retired = shoes
    .filter((shoe) => shoe.retired)
    .sort((a, b) => (b.lastUsedDate ?? '').localeCompare(a.lastUsedDate ?? ''))

  return (
    <div className="space-y-5">
      {active.length > 0 && (
        <section className="space-y-2" data-testid="shoes-rotation">
          <div className="flex items-baseline justify-between gap-3">
            <h2 data-bar-fade className={SECTION}>{t.shoes.inRotation(active.length)}</h2>
            {sharedTickKm !== null && (
              <p className="flex min-w-0 items-center gap-1 text-caption text-muted-foreground" data-testid="shoes-tick-key">
                <span aria-hidden className="h-2.5 w-0.5 shrink-0 rounded-full bg-[var(--text-2)]" />
                <span className="truncate">{t.shoes.detail.retireFromWorkouts(formatKm(sharedTickKm))}</span>
              </p>
            )}
          </div>
          <GlassSurface variant="card" className="overflow-hidden rounded-card-sm">
            {active.map((shoe) => (
              <RotationRow key={shoe.gearId} shoe={shoe} context={insights[shoe.gearId] ?? null} tickLabel={sharedTickKm === null} />
            ))}
          </GlassSurface>
        </section>
      )}

      {retired.length > 0 && (
        <section className="space-y-2" data-testid="shoes-retired">
          <h2 data-bar-fade className={SECTION}>{t.shoes.retiredSection(retired.length)}</h2>
          <GlassSurface variant="card" className="overflow-hidden rounded-card-sm">
            {retired.map((shoe) => (
              <Link key={shoe.gearId} href={`/shoes/${shoe.gearId}?from=shoes`} className={cn(ROW_DIVIDER, 'flex min-h-15 items-center gap-3 px-5 py-3')} data-testid="retired-row">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-body font-bold text-foreground">{shoe.name}</span>
                  <span className="block truncate text-footnote text-muted-foreground">{retiredSubline(shoe)}</span>
                </span>
                <span className="shrink-0 font-display text-body font-bold tabular-nums text-foreground">
                  {formatKm(shoe.totalKm)} {t.units.km}
                </span>
                <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            ))}
          </GlassSurface>
        </section>
      )}

      {compare && (
        <details className="group rounded-card-sm border border-border bg-card" data-testid="shoes-compare">
          <summary className="flex min-h-15 cursor-pointer list-none items-center gap-3 px-5 py-3 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0 flex-1">
              <span className="block font-display text-body font-bold text-foreground">{t.shoes.comparison.title}</span>
              <span className="block truncate text-footnote text-muted-foreground">{t.shoes.comparison.subtitle}</span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true" />
          </summary>
          <div className="px-3 pb-3">{compare}</div>
        </details>
      )}
    </div>
  )
}
