import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import type { ZoneShare } from '@/application/usecases/GetAnalyticsData'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { CHART_COLORS, ZONE_HEADLINE_COLORS } from '@/lib/colors'
import { t } from '@/i18n'

const VIOLET = CHART_COLORS.efficiency

// The three headline zones the mockup surfaces - the full ladder lives on the
// Athlete detail. Accent-independent so Z5/Z4/Z2 keep their heat/threshold/easy
// meaning.
const ZONE_ROWS: { zone: number; label: string; color: string }[] = [
  { zone: 5, label: t.profile.athlete.zoneRows[5]!, color: ZONE_HEADLINE_COLORS[5] },
  { zone: 4, label: t.profile.athlete.zoneRows[4]!, color: ZONE_HEADLINE_COLORS[4] },
  { zone: 2, label: t.profile.athlete.zoneRows[2]!, color: ZONE_HEADLINE_COLORS[2] },
]

function Tile({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="rounded-xl bg-foreground/[0.04] p-2.5 text-center">
      <div className="text-micro font-semibold uppercase tracking-[0.03em] text-subtle">{label}</div>
      <div className="mt-[3px] font-display text-lg font-bold tabular-nums" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </div>
    </div>
  )
}

interface Props {
  athlete: AthleteProfile
  latestVo2max: number | null
  recentZoneTime: ZoneShare[]
}

// The merged Athlete reference: VO2max / VMA / LTHR at a glance, the three key
// HR zones as bars, tapping through to the full sheet. Read-only display.
export function ProfileAthleteCard({ athlete, latestVo2max, recentZoneTime }: Props) {
  const a = t.profile.athlete
  const byZone = new Map(recentZoneTime.map((z) => [z.zone, z.seconds]))
  const maxSeconds = Math.max(1, ...ZONE_ROWS.map((r) => byZone.get(r.zone) ?? 0))

  return (
    <GlassSurface variant="card" className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">{a.title}</h2>
        <Link href="/athlete" className="flex min-h-6 items-center gap-0.5 text-xs font-semibold text-accent-text active:scale-95">
          {a.details}
          <ChevronRight size={14} />
        </Link>
      </div>

      <div className="mb-3.5 grid grid-cols-3 gap-2.5">
        <Tile label={a.vo2maxShort} value={latestVo2max !== null ? String(Math.round(latestVo2max)) : a.notSet} valueColor={VIOLET} />
        <Tile label={a.vmaShort} value={athlete.vmaKmh !== undefined ? String(athlete.vmaKmh) : a.notSet} />
        <Tile label={a.lthrShort} value={athlete.lthrBpm !== undefined ? String(athlete.lthrBpm) : a.notSet} />
      </div>

      <div className="flex flex-col gap-[7px]">
        {ZONE_ROWS.map((row) => {
          const seconds = byZone.get(row.zone) ?? 0
          const width = Math.round((seconds / maxSeconds) * 100)
          const minutes = Math.round(seconds / 60)
          return (
            <div key={row.zone} className="flex items-center gap-2">
              <span className="w-11 shrink-0 text-micro text-subtle">{row.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/[0.08]">
                <div className="h-full rounded-full" style={{ width: `${width}%`, background: row.color }} />
              </div>
              <span className="w-9 shrink-0 text-right text-micro text-subtle">{minutes}m</span>
            </div>
          )
        })}
      </div>
    </GlassSurface>
  )
}
