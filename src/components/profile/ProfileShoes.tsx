import Link from 'next/link'
import { ChevronRight, Footprints } from 'lucide-react'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'
import { wearStatus } from '@/domain/shoe/wearStatus'
import { STATUS } from '@/lib/statusColors'
import { t } from '@/i18n'

// Slim strip, not a card tile: one line - how many pairs are active, whether any
// needs replacing - tapping through to the shoes page.
export function ProfileShoes({ shoes }: { shoes: ShoeStats[] }) {
  if (shoes.length === 0) return null

  // Same watch/replace threshold as the Shoes page hero, so this strip never
  // says "all good" while /shoes is flagging a pair.
  const alertCount = shoes.filter((s) => !s.retired && wearStatus(s.wearPercent) !== 'ok').length

  return (
    <Link
      href="/shoes"
      className="glass-row flex items-center gap-3 rounded-[15px] px-3.5 py-3.5 transition-colors active:scale-[0.99]"
    >
      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-foreground/[0.06] text-muted-foreground">
        <Footprints size={18} strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-footnote font-semibold text-foreground">{t.profile.shoes.pairs(shoes.length)}</span>
        <span className={`mt-0.5 block text-caption ${alertCount > 0 ? STATUS.warning.text : 'text-subtle'}`}>
          {alertCount > 0 ? t.profile.shoes.needsReplacing(alertCount) : t.profile.shoes.allGood}
        </span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-subtle-2" />
    </Link>
  )
}
