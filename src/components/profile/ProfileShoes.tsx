import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'
import { wearStatus } from '@/domain/shoe/wearStatus'
import { STATUS } from '@/lib/statusColors'
import { formatKm } from '@/lib/formatters'
import { t } from '@/i18n'

// The row this renders in measures ~285px at the caption size (11px Inter),
// which fits ~5.3px/char - about 50 characters - before the line wraps.
const NAMED_MILEAGE_CHAR_BUDGET = 50

function namedMileage(a: ShoeStats, b: ShoeStats): string {
  const kmA = formatKm(Math.round(a.totalKm))
  const kmB = formatKm(Math.round(b.totalKm))
  const max = formatKm(a.maxKm)
  const named = t.profile.shoes.namedMileage(a.name, kmA, b.name, kmB, max)
  return named.length <= NAMED_MILEAGE_CHAR_BUDGET ? named : t.profile.shoes.mileageOfMax(kmA, kmB, max)
}

export function ProfileShoes({ shoes }: { shoes: ShoeStats[] }) {
  if (shoes.length === 0) return null

  const alertCount = shoes.filter((s) => !s.retired && wearStatus(s.wearPercent) !== 'ok').length
  // Most-worn first: GetProfileData hands these over sorted by totalKm descending,
  // so the pair closest to its limit is the first number read.
  const [first, second] = shoes
  const mileage =
    first && second && shoes.length === 2 && first.maxKm === second.maxKm
      ? namedMileage(first, second)
      : shoes.map((s) => t.shoes.kmOf(Math.round(s.totalKm), s.maxKm)).join(' · ')

  return (
    <Link
      href="/shoes"
      className="glass-row flex items-center gap-3 rounded-[15px] px-3.5 py-3.5 transition-colors active:scale-[0.99]"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-footnote font-semibold text-foreground">{t.profile.shoes.pairs(shoes.length)}</span>
        <span
          className={`mt-0.5 block text-caption leading-snug ${alertCount > 0 ? STATUS.warning.text : 'text-subtle'}`}
        >
          {alertCount > 0 ? t.profile.shoes.needsReplacing(alertCount) : mileage}
        </span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-subtle-2" />
    </Link>
  )
}
