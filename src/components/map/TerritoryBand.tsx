import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import { GlassSurface } from '@/components/ui/GlassSurface'

const ACCENT_ON_DARK = 'var(--accent-on-dark)'

interface Stat {
  value: string
  label: string
}

export interface TerritoryCardContent {
  eyebrow: string
  headline: string
  primaryStat: Stat
  secondaryStat: Stat
}

// A pure renderer: whoever owns the current area/world selection decides
// what fact and which two stats belong here, so the card never states
// something the map beneath it disagrees with.
export function TerritoryBand({ eyebrow, headline, primaryStat, secondaryStat }: TerritoryCardContent) {
  return (
    <GlassSurface variant="hero" className="flex flex-col gap-3.5">
      <div>
        <p className={EYEBROW_CLASS} style={{ color: ACCENT_ON_DARK }}>
          {eyebrow}
        </p>
        <p className="mt-2 font-display text-base font-bold leading-snug text-white">{headline}</p>
      </div>
      <div className="flex gap-6">
        <div>
          <div className="font-display text-lg font-bold tabular-nums text-white">{primaryStat.value}</div>
          <div className="text-caption text-white/60">{primaryStat.label}</div>
        </div>
        <div>
          <div className="font-display text-lg font-bold tabular-nums text-white">{secondaryStat.value}</div>
          <div className="text-caption text-white/60">{secondaryStat.label}</div>
        </div>
      </div>
    </GlassSurface>
  )
}
