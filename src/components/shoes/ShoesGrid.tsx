import Link from 'next/link'
import { SectionDivider } from '@/components/ui/SectionLabel'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'
import { wearStatus, weeksInRotation, type WearStatus } from '@/domain/shoe/wearStatus'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { BrandIcon } from '@/components/shoes/BrandIcon'
import { STATUS } from '@/lib/statusColors'
import { SHOE_WEAR_TINTS } from '@/lib/colors'
import { formatDate, formatDateRange, formatKm } from '@/lib/formatters'
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
 * The year rule it used to spell out by hand is formatDate's now. Only an
 * active pair uses this - a retired one leads with its era instead (see
 * `retiredSubline`), so "last worn" never has to say the same year twice.
 */
function lastRunLabel(shoe: ShoeStats): string | null {
  if (!shoe.lastUsedDate) return null
  return t.shoes.lastRun(formatDate(shoe.lastUsedDate, { style: 'bare' }))
}

/**
 * A retired pair has no wear left to report, so its subline trades the bar
 * and the percentage for the shape of its life instead: the era it ran in,
 * how many runs, and how many weeks that took.
 */
function retiredSubline(shoe: ShoeStats): string {
  const era = shoe.firstUsedDate && shoe.lastUsedDate
    ? formatDateRange(shoe.firstUsedDate, shoe.lastUsedDate, { precision: 'month' })
    : shoe.lastUsedDate
      ? formatDate(shoe.lastUsedDate, { precision: 'month', style: 'bare' })
      : '-'
  const weeks = weeksInRotation(shoe.firstUsedDate, shoe.lastUsedDate)
  return t.shoes.retiredLife(era, shoe.sessionCount, weeks)
}

function ShoeRow({ shoe }: { shoe: ShoeStats }) {
  const status = wearStatus(shoe.wearPercent)
  const kmLeft = Math.max(0, Math.round(shoe.maxKm - shoe.totalKm))

  // No opacity on the retired row: dimming the whole row composited the
  // AA-compliant `text-subtle` down to ~3.2:1, and faded the brand mark and the
  // mileage along with it. Retirement is a label, so it gets a chip instead.
  //
  // Name and headline number share the top line (icon left, number top-right)
  // instead of the number sitting centred against a three-line block - a
  // vertically centred trailing figure had no shared baseline with the name it
  // belonged to. The subline is one truncated line rather than left to wrap,
  // so a long "last run" date never breaks the phrase mid-word.
  return (
    <Link
      href={`/shoes/${shoe.gearId}`}
      className="glass-card flex flex-col gap-1.5 rounded-xl px-3.5 py-2.5 transition-transform active:scale-[0.99]"
    >
      <span className="flex items-center gap-2">
        <BrandIcon brand={shoe.brand} size={14} />
        <span className="min-w-0 flex-1 truncate text-footnote font-semibold text-foreground">{shoe.name}</span>
        {/* No per-row "Retired" chip: the group heading above these rows already
            says it, and repeating it left the row with two labels. A retired
            pair still shows the one number that outlives it - its total km. */}
        {shoe.retired ? (
          <span className="shrink-0 text-right text-footnote font-bold tabular-nums text-subtle">
            {formatKm(shoe.totalKm)}
            <span className="ml-0.5 text-caption font-semibold text-muted-foreground">{t.units.km}</span>
          </span>
        ) : (
          <span className={cn('shrink-0 text-right text-footnote font-bold tabular-nums', WEAR_TEXT[status])}>
            {t.shoes.kmLeft(kmLeft)}
          </span>
        )}
      </span>
      {/* Retired pairs are forced to wearPercent 100 (GetShoeStats), so a bar there
          would claim a full-red rotation shoe that is already out of service. */}
      {!shoe.retired && (
        <span className="block h-1.5 overflow-hidden rounded-full bg-foreground/[0.1]">
          <span
            className={cn('block h-full rounded-full', WEAR_BAR[status])}
            style={{ width: `${shoe.wearPercent}%` }}
          />
        </span>
      )}
      <span className="block truncate text-caption text-subtle">
        {shoe.retired ? (
          retiredSubline(shoe)
        ) : (
          <>
            {t.shoes.kmOf(Math.round(shoe.totalKm), shoe.maxKm)} · {t.shoes.kmPerWeek(shoe.kmPerWeek)}
            {lastRunLabel(shoe) && ` · ${lastRunLabel(shoe)}`}
          </>
        )}
      </span>
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
          <SectionDivider className="px-1">{t.shoes.active}</SectionDivider>
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
