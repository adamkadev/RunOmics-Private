import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'
import { wearStatus } from '@/domain/shoe/wearStatus'
import { STATUS } from '@/lib/statusColors'
import { t } from '@/i18n'

export function ProfileShoes({ shoes }: { shoes: ShoeStats[] }) {
  if (shoes.length === 0) return null

  // Same watch/replace threshold as the Shoes page hero, so this tile never
  // says "all good" while /shoes is flagging a pair.
  const alertCount = shoes.filter((s) => !s.retired && wearStatus(s.wearPercent) !== 'ok').length

  return (
    <GlassSurface variant="card" className="flex flex-col gap-3 p-4">
      <h2 className="text-sm font-bold text-foreground">{t.profile.shoes.title}</h2>

      <div>
        <div className="text-lg font-extrabold tracking-tight text-foreground">
          {t.profile.shoes.pairs(shoes.length)}
        </div>
        <div className={`mt-0.5 text-micro font-medium ${alertCount > 0 ? STATUS.warning.text : 'text-muted-foreground'}`}>
          {alertCount > 0 ? t.profile.shoes.needsReplacing(alertCount) : t.profile.shoes.allGood}
        </div>
      </div>

      <Link
        href="/shoes"
        className="mt-auto flex items-center gap-1.5 text-sm font-semibold text-accent-text active:scale-95"
      >
        {t.profile.shoes.viewShoes} <ArrowRight size={16} />
      </Link>
    </GlassSurface>
  )
}
