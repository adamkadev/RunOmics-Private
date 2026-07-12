import Link from 'next/link'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { BrandIcon } from '@/components/shoes/BrandIcon'
import { STATUS } from '@/lib/statusColors'
import { formatCompactDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

type WearStatus = 'ok' | 'watch' | 'replace'

// Deterministic decision layer over the wear percent - the at-risk pair is
// promoted to a hero card, everything else drops to a compact row.
export function wearStatus(pct: number): WearStatus {
  if (pct >= 90) return 'replace'
  if (pct >= 70) return 'watch'
  return 'ok'
}

/** The single pair most in need of action, or null when the rotation is healthy. */
export function pickHeroShoe(shoes: ShoeStats[]): ShoeStats | null {
  return (
    shoes
      .filter((s) => !s.retired && wearStatus(s.wearPercent) !== 'ok')
      .sort((a, b) => b.wearPercent - a.wearPercent)[0] ?? null
  )
}

const WEAR_TEXT: Record<WearStatus, string> = {
  ok:      STATUS.success.text,
  watch:   STATUS.warning.text,
  replace: STATUS.danger.text,
}

const WEAR_BAR: Record<WearStatus, string> = {
  ok:      STATUS.success.dot,
  watch:   STATUS.warning.dot,
  replace: STATUS.danger.dot,
}

// Hero gradient per state, mirroring NextRaceSpotlight's orange treatment.
const HERO_SURFACE: Record<'watch' | 'replace', { background: string; borderColor: string }> = {
  watch:   { background: 'linear-gradient(150deg, rgba(245,158,11,0.16), rgba(245,158,11,0.02))', borderColor: 'rgba(245,158,11,0.35)' },
  replace: { background: 'linear-gradient(150deg, rgba(239,68,68,0.16), rgba(239,68,68,0.02))',   borderColor: 'rgba(239,68,68,0.35)' },
}

function ShoeHeroCard({ shoe, insight }: { shoe: ShoeStats; insight: string | null }) {
  const status = wearStatus(shoe.wearPercent) as 'watch' | 'replace'
  const kmLeft = Math.max(0, Math.round(shoe.maxKm - shoe.totalKm))

  return (
    <Link
      href={`/shoes/${shoe.gearId}`}
      className="block rounded-2xl border p-4 transition-transform active:scale-[0.99]"
      style={HERO_SURFACE[status]}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={cn('font-mono text-[10px] font-semibold uppercase tracking-[0.12em]', WEAR_TEXT[status])}>
          {t.shoes.status[status]}
        </span>
        <span className={cn('text-[15px] font-bold tabular-nums', WEAR_TEXT[status])}>{shoe.wearPercent}%</span>
      </div>
      <div className="flex items-center gap-2">
        <BrandIcon brand={shoe.brand} size={16} />
        <p className="font-display text-[17px] font-bold text-foreground">{shoe.name}</p>
      </div>
      <p className="mb-2.5 mt-0.5 text-[11px] text-muted-foreground">
        {t.shoes.kmOf(Math.round(shoe.totalKm), shoe.maxKm)} · {t.shoes.kmLeft(kmLeft)}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-foreground/[0.1]">
        <div className={cn('h-full rounded-full', WEAR_BAR[status])} style={{ width: `${shoe.wearPercent}%` }} />
      </div>
      {insight && <p className="mt-2.5 text-[11px] leading-snug text-foreground/75">{insight}</p>}
    </Link>
  )
}

function ShoeRow({ shoe }: { shoe: ShoeStats }) {
  const status = wearStatus(shoe.wearPercent)

  return (
    <Link
      href={`/shoes/${shoe.gearId}`}
      className={cn(
        'glass-card flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-transform active:scale-[0.99]',
        shoe.retired && 'opacity-65'
      )}
    >
      <BrandIcon brand={shoe.brand} size={14} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-semibold text-foreground">{shoe.name}</span>
        <span className="block text-[9.5px] text-subtle">
          {t.shoes.kmOf(Math.round(shoe.totalKm), shoe.maxKm)}
          {shoe.lastUsedDate && ` · ${formatCompactDate(shoe.lastUsedDate)}`}
        </span>
      </span>
      {shoe.retired ? (
        <span className="shrink-0 text-[11px] font-medium text-subtle">{t.shoes.retired}</span>
      ) : (
        <span className={cn('shrink-0 text-[11px] font-semibold tabular-nums', WEAR_TEXT[status])}>
          {shoe.wearPercent}%
        </span>
      )}
    </Link>
  )
}

interface Props {
  shoes: ShoeStats[]
  /** Deterministic usage/rotation sentence for the hero pair, computed server-side. */
  heroInsight?: string | null
}

export function ShoesGrid({ shoes, heroInsight = null }: Props) {
  if (shoes.length === 0) {
    return (
      <GlassSurface variant="card" className="rounded-card-sm border-dashed py-10 text-center">
        <p className="text-sm text-subtle">{t.shoes.neverUsed}</p>
      </GlassSurface>
    )
  }

  const hero = pickHeroShoe(shoes)
  const rest = shoes.filter((s) => s !== hero)

  return (
    <div className="space-y-3">
      {hero && <ShoeHeroCard shoe={hero} insight={heroInsight} />}
      {hero && rest.length > 0 && (
        <p className="px-1 text-[10px] font-medium uppercase tracking-[0.08em] text-subtle-2">
          {t.shoes.hero.restOfRotation}
        </p>
      )}
      <div className="space-y-2">
        {rest.map((shoe) => (
          <ShoeRow key={shoe.gearId} shoe={shoe} />
        ))}
      </div>
    </div>
  )
}
