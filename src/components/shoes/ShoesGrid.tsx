import Link from 'next/link'
import { SectionDivider } from '@/components/ui/SectionLabel'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'
import { wearStatus, type WearStatus } from '@/domain/shoe/wearStatus'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { BrandIcon } from '@/components/shoes/BrandIcon'
import { STATUS } from '@/lib/statusColors'
import { SHOE_WEAR_TINTS } from '@/lib/colors'
import { formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

export function pickHeroShoe(shoes: ShoeStats[]): ShoeStats | null {
  return (
    shoes
      .filter((s) => !s.retired && wearStatus(s.wearPercent) !== 'ok')
      .sort((a, b) => b.wearPercent - a.wearPercent)[0] ?? null
  )
}

// `ok` is a non-event, so it stays neutral rather than spending a status hue —
// same call ProfileShoes makes when nothing needs replacing. Only watch and
// replace, the two states that ask for a decision, get colour.
const WEAR_TEXT: Record<WearStatus, string> = {
  ok:      'text-muted-foreground',
  watch:   STATUS.warning.text,
  replace: STATUS.danger.text,
}

const WEAR_BAR: Record<WearStatus, string> = {
  ok:      STATUS.success.dot,
  watch:   STATUS.warning.dot,
  replace: STATUS.danger.dot,
}

export const HERO_SURFACE: Record<'watch' | 'replace', { background: string; borderColor: string }> = SHOE_WEAR_TINTS

function ShoeHeroCard({ shoe, insight }: { shoe: ShoeStats; insight: string | null }) {
  const status = wearStatus(shoe.wearPercent) as 'watch' | 'replace'
  const kmLeft = Math.max(0, Math.round(shoe.maxKm - shoe.totalKm))

  return (
    <Link
      href={`/shoes/${shoe.gearId}`}
      className="block rounded-2xl border p-4 text-center transition-transform active:scale-[0.99]"
      style={HERO_SURFACE[status]}
    >
      <div className="flex items-center justify-center gap-2">
        <span className={cn('font-mono text-micro font-bold uppercase tracking-[0.1em]', WEAR_TEXT[status])}>
          {t.shoes.status[status]}
        </span>
        <span className={cn('text-footnote font-bold tabular-nums', WEAR_TEXT[status])}>{shoe.wearPercent}%</span>
      </div>
      <div className="mt-1.5 flex items-center justify-center gap-2">
        <BrandIcon brand={shoe.brand} size={16} />
        <p className="font-display text-body font-bold text-foreground">{shoe.name}</p>
      </div>
      <p className="mb-2.5 mt-0.5 text-caption text-muted-foreground">
        {t.shoes.kmOf(Math.round(shoe.totalKm), shoe.maxKm)} · {t.shoes.kmLeft(kmLeft)}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-foreground/[0.1]">
        <div className={cn('h-full rounded-full', WEAR_BAR[status])} style={{ width: `${shoe.wearPercent}%` }} />
      </div>
      {insight && <p className="mx-auto mt-2.5 max-w-[46ch] text-caption leading-snug text-foreground/75">{insight}</p>}
    </Link>
  )
}

/**
 * Says what the date is instead of leaving a bare `Sep 13` next to the mileage.
 * The year rule it used to spell out by hand is formatDate's now.
 *
 * A retired pair only needs its era - the registry has no retirement date, so
 * the year is the last one it actually ran, hence "last worn", not "retired".
 * That era is also what separates two pairs sharing a model name.
 */
function lastOutingLabel(shoe: ShoeStats): string | null {
  if (!shoe.lastUsedDate) return null

  if (shoe.retired) return t.shoes.lastWorn(new Date(shoe.lastUsedDate + 'T00:00:00').getFullYear())

  return t.shoes.lastRun(formatDate(shoe.lastUsedDate, { style: 'bare' }))
}

function ShoeRow({ shoe }: { shoe: ShoeStats }) {
  const status = wearStatus(shoe.wearPercent)
  const lastOuting = lastOutingLabel(shoe)

  // No opacity on the retired row: dimming the whole row composited the
  // AA-compliant `text-subtle` down to ~3.2:1, and faded the brand mark and the
  // mileage along with it. Retirement is a label, so it gets a chip instead.
  return (
    <Link
      href={`/shoes/${shoe.gearId}`}
      className="glass-card flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-transform active:scale-[0.99]"
    >
      <BrandIcon brand={shoe.brand} size={14} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-footnote font-semibold text-foreground">{shoe.name}</span>
        {/* Retired pairs are forced to wearPercent 100 (GetShoeStats), so a bar there
            would claim a full-red rotation shoe that is already out of service. */}
        {!shoe.retired && (
          <span className="my-1 block h-1.5 overflow-hidden rounded-full bg-foreground/[0.1]">
            <span
              className={cn('block h-full rounded-full', WEAR_BAR[status])}
              style={{ width: `${shoe.wearPercent}%` }}
            />
          </span>
        )}
        <span className="block text-caption text-subtle">
          {t.shoes.kmOf(Math.round(shoe.totalKm), shoe.maxKm)}
          {lastOuting && ` · ${lastOuting}`}
        </span>
      </span>
      {/* No per-row "Retired" chip: the group heading above these rows already
          says it, and repeating it left the row with two labels and no wear
          figure. A retired pair still shows how worn it got. */}
      {shoe.retired ? (
        <span className="shrink-0 text-caption font-semibold tabular-nums text-subtle">
          {shoe.wearPercent}%
        </span>
      ) : (
        <span className={cn('shrink-0 text-caption font-semibold tabular-nums', WEAR_TEXT[status])}>
          {shoe.wearPercent}%
        </span>
      )}
    </Link>
  )
}

interface Props {
  shoes: ShoeStats[]
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

  // Two pairs can carry the same name a year apart, so the list says which are
  // in rotation and which are done rather than leaving the reader to infer it
  // from a chip halfway down a row.
  const active = rest.filter((shoe) => !shoe.retired)
  const retired = rest.filter((shoe) => shoe.retired)

  return (
    <div className="space-y-3">
      {hero && <ShoeHeroCard shoe={hero} insight={heroInsight} />}

      {active.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2 px-1">
            <SectionDivider>{t.shoes.active}</SectionDivider>
            <WearLegend />
          </div>
          {active.map((shoe) => (
            <ShoeRow key={shoe.gearId} shoe={shoe} />
          ))}
        </div>
      )}

      {retired.length > 0 && (
        <div className="space-y-2 pt-1">
          <SectionDivider className="px-1">{t.shoes.retired}</SectionDivider>
          {retired.map((shoe) => (
            <ShoeRow key={shoe.gearId} shoe={shoe} />
          ))}
        </div>
      )}
    </div>
  )
}

/** The bands the bar and the percentage are now coloured by. */
function WearLegend() {
  const bands: { key: 'ok' | 'watch' | 'replace'; dot: string }[] = [
    { key: 'ok', dot: STATUS.success.dot },
    { key: 'watch', dot: STATUS.warning.dot },
    { key: 'replace', dot: STATUS.danger.dot },
  ]

  return (
    <span className="flex shrink-0 items-center gap-2 text-micro tabular-nums text-subtle">
      {bands.map(({ key, dot }) => (
        <span key={key} className="flex items-center gap-1">
          <span aria-hidden className={cn('h-2 w-2 rounded-[2px]', dot)} />
          {t.shoes.wearLegend[key]}
        </span>
      ))}
    </span>
  )
}
