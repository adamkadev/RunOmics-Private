import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'
import { wearStatus, type WearStatus } from '@/domain/shoe/wearStatus'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { BrandIcon } from '@/components/shoes/BrandIcon'
import { STATUS } from '@/lib/statusColors'
import { SHOE_WEAR_TINTS } from '@/lib/colors'
import { formatDate, formatDateRange, formatKm } from '@/lib/formatters'
import { shoeWearCopy } from './shoeWear'
import { WearBar } from './WearBar'
import { StatusPill } from '@/components/ui/StatusPill'
import { t } from '@/i18n'

/** The pair most in need of replacing, for the one context line that needs the activity log. */
export function pickHeroShoe(shoes: ShoeStats[]): ShoeStats | null {
  return (
    shoes
      .filter((s) => !s.retired && wearStatus(s.wearPercent) !== 'ok')
      .sort((a, b) => b.wearPercent - a.wearPercent)[0] ?? null
  )
}

const WEAR_BAR: Record<WearStatus, string> = {
  ok:      STATUS.success.dot,
  watch:   STATUS.warning.dot,
  replace: STATUS.danger.dot,
}

/** The shoe detail page's hero tint. */
export const HERO_SURFACE: Record<'watch' | 'replace', { background: string; borderColor: string }> = SHOE_WEAR_TINTS

/**
 * The pair's state as its card's one chip: the overrun in red, a pair close
 * to its limit in amber, a healthy one neutral - `ok` asks for no decision,
 * so it spends no status hue.
 */
function WearChip({ shoe }: { shoe: ShoeStats }) {
  const wear = shoeWearCopy(shoe)
  const status = wearStatus(shoe.wearPercent)
  if (wear.over) return <StatusPill tone="red" className="shrink-0 font-semibold">{wear.short}</StatusPill>
  if (status !== 'ok') return <StatusPill tone="amber" className="shrink-0 font-semibold">{wear.short}</StatusPill>
  return <span className="shrink-0 text-footnote font-semibold tabular-nums text-muted-foreground">{wear.short}</span>
}

function lastRunLine(shoe: ShoeStats): string | null {
  return shoe.lastUsedDate ? t.shoes.lastRunSentence(formatDate(shoe.lastUsedDate, { style: 'bare' })) : null
}

/**
 * One card per pair in rotation, each with its own state. The old screen gave
 * the REPLACE hero to one pair, so a second pair 387 km past its limit sat in
 * the Active list with nothing asking for a decision.
 */
function ShoeCard({ shoe, context }: { shoe: ShoeStats; context: string | null }) {
  const status = wearStatus(shoe.wearPercent)
  return (
    <Link href={`/shoes/${shoe.gearId}`} className="block transition-transform active:scale-[0.99]" data-testid="shoe-card">
      <GlassSurface variant="card" className="rounded-card-sm p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <BrandIcon brand={shoe.brand} size={16} />
            <span className="truncate font-display text-body font-bold text-foreground">{shoe.name}</span>
          </span>
          <WearChip shoe={shoe} />
        </div>
        <p className="mb-2.5 mt-0.5 text-footnote tabular-nums text-muted-foreground">
          {t.shoes.limitLine(formatKm(shoe.totalKm), formatKm(shoe.maxKm), shoe.sessionCount)}
        </p>
        <WearBar totalKm={shoe.totalKm} maxKm={shoe.maxKm} fillClass={WEAR_BAR[status]} />
        {context && <p className="mt-2.5 text-footnote text-foreground/80">{context}</p>}
      </GlassSurface>
    </Link>
  )
}

function retiredSubline(shoe: ShoeStats): string {
  const era = shoe.firstUsedDate && shoe.lastUsedDate
    ? formatDateRange(shoe.firstUsedDate, shoe.lastUsedDate, { precision: 'month' })
    : shoe.lastUsedDate
      ? formatDate(shoe.lastUsedDate, { precision: 'month', style: 'bare' })
      : '-'
  return t.shoes.retiredLife(era, shoe.sessionCount, formatKm(shoe.totalKm))
}

function Row({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <span className="flex min-h-14 items-center justify-between gap-3 py-2.5">
      <span className="min-w-0">
        <span className="block truncate text-body font-semibold text-foreground">{title}</span>
        <span className="block truncate text-footnote text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-subtle" aria-hidden="true" />
    </span>
  )
}

interface Props {
  shoes: ShoeStats[]
  /** A context line per pair, by gear id, where the page has one. */
  insights?: Record<string, string>
  /** The comparison, opened from its row. */
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
  const retired = shoes.filter((shoe) => shoe.retired)

  return (
    <div className="space-y-3">
      {active.map((shoe) => (
        <ShoeCard key={shoe.gearId} shoe={shoe} context={insights[shoe.gearId] ?? lastRunLine(shoe)} />
      ))}

      {(retired.length > 0 || compare) && (
        <GlassSurface variant="card" className="rounded-card-sm px-4">
          <div className="divide-y divide-border">
            {retired.map((shoe) => (
              <Link key={shoe.gearId} href={`/shoes/${shoe.gearId}`} className="block" data-testid="retired-row">
                <Row title={t.shoes.retiredTitle(shoe.name)} subtitle={retiredSubline(shoe)} />
              </Link>
            ))}
            {compare && (
              <details className="group">
                <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <Row title={t.shoes.comparison.title} subtitle={t.shoes.comparison.subtitle} />
                </summary>
                <div className="pb-3">{compare}</div>
              </details>
            )}
          </div>
        </GlassSurface>
      )}
    </div>
  )
}
