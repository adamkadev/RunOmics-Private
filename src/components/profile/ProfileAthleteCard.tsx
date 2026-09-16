import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { CardTitle, SectionDivider } from '@/components/ui/SectionLabel'
import type { AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import type { ZoneShare } from '@/application/usecases/GetAnalyticsData'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ZONE_COLOR_CLASSES } from '@/lib/colors'
import { formatDurationWords } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'


interface HeadlineMetric {
  label: string
  value: string
  unit?: string
  valueColor?: string
}

// Z1 and Z3 arrive in recentZoneTime and used to be dropped on the floor, so the
// bars never summed to the time actually run. The ramp is the theme-aware one
// every other zone surface uses.
const ZONE_ROWS: { zone: number; label: string; barClass: string }[] = [5, 4, 3, 2, 1].map((zone) => ({
  zone,
  label: t.profile.athlete.zoneRows[zone]!,
  barClass: ZONE_COLOR_CLASSES[zone]!.bg,
}))

const ZONE_LABEL_COLOR = 'var(--muted-foreground)'
const ZONE_TRACK_COLOR = 'rgba(148,178,220,.12)'

function Tile({ label, value, unit, valueColor }: HeadlineMetric) {
  return (
    <div className="rounded-xl bg-foreground/[0.04] p-2.5 text-center">
      <div className="text-micro font-semibold uppercase tracking-[0.03em] text-subtle">{label}</div>
      <div
        className="mt-[3px] font-display text-lg font-bold tabular-nums"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
        {unit && <span className="ml-0.5 text-caption font-semibold text-muted-foreground">{unit}</span>}
      </div>
    </div>
  )
}

interface Props {
  athlete: AthleteProfile
  latestVo2max: number | null
  recentZoneTime: ZoneShare[]
}

export function ProfileAthleteCard({ athlete, latestVo2max, recentZoneTime }: Props) {
  const a = t.profile.athlete
  const byZone = new Map(recentZoneTime.map((z) => [z.zone, z.seconds]))
  const maxSeconds = Math.max(1, ...ZONE_ROWS.map((r) => byZone.get(r.zone) ?? 0))
  const metrics: HeadlineMetric[] = []
  if (latestVo2max !== null) {
    // One decimal everywhere VO₂max is printed - Analytics already shows one,
    // and rounding to a whole number here made the same metric look like two.
    metrics.push({ label: a.vo2maxShort, value: latestVo2max.toFixed(1), unit: t.units.mlKgMin })
  }
  if (athlete.vmaKmh !== undefined) {
    metrics.push({ label: a.vmaShort, value: String(athlete.vmaKmh), unit: t.units.kmh })
  }
  if (athlete.lthrBpm !== undefined) {
    metrics.push({ label: a.lthrShort, value: String(athlete.lthrBpm), unit: t.units.bpm })
  }
  const metricColumns = metrics.length === 1 ? 'grid-cols-1' : metrics.length === 2 ? 'grid-cols-2' : 'grid-cols-3'

  return (
    <GlassSurface variant="card" className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <CardTitle as="h2">{a.title}</CardTitle>
        <Link href="/athlete" className="flex min-h-6 items-center gap-0.5 text-xs font-semibold text-accent-text active:scale-95">
          {a.details}
          <ChevronRight size={14} />
        </Link>
      </div>

      {metrics.length > 0 ? (
        <div className={`mb-3.5 grid gap-2.5 ${metricColumns}`}>
          {metrics.map((metric) => <Tile key={metric.label} {...metric} />)}
        </div>
      ) : null}

      <SectionDivider className="mb-2">
        {`${t.profile.hrZones.title} · ${t.profile.hrZones.recentWeeks}`}
      </SectionDivider>

      <div className="flex flex-col gap-[9px]">
        {ZONE_ROWS.map((row) => {
          const seconds = byZone.get(row.zone) ?? 0
          const width = Math.round((seconds / maxSeconds) * 100)
          // A bare "m" sat two cards away from metres of elevation on the same page.
          const minutes = formatDurationWords(seconds)
          return (
            <div key={row.zone} className="flex items-center gap-2">
              <span className="w-[62px] shrink-0 whitespace-nowrap text-[12px]" style={{ color: ZONE_LABEL_COLOR }}>
                {row.label}
              </span>
              <div className="h-[7px] flex-1 overflow-hidden rounded-[4px]" style={{ background: ZONE_TRACK_COLOR }}>
                <div className={cn('h-full rounded-[4px]', row.barClass)} style={{ width: `${width}%` }} />
              </div>
              <span className="w-[46px] shrink-0 text-right text-micro tabular-nums text-subtle">{minutes}</span>
            </div>
          )
        })}
      </div>
    </GlassSurface>
  )
}
