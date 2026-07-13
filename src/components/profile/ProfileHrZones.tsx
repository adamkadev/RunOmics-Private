'use client'

import { GlassSurface } from '@/components/ui/GlassSurface'
import { EditableNumber } from '@/components/ui/EditableNumber'
import type { AthleteProfile } from '@/infrastructure/repositories/FirestoreConfigRepository'
import type { ZoneShare } from '@/application/usecases/GetAnalyticsData'
import { formatDurationWords } from '@/lib/formatters'
import { t } from '@/i18n'

type Bounds = [number, number, number, number]

const DEFAULT_LTHR = 170
const ZONE_PERCENTS = [0.80, 0.89, 0.95, 1.00]

// Z1-Z4 read as one accent ramping in intensity; Z5 alone breaks the ramp
// with the semantic "high effort" amber, since it's the one zone worth a
// second look regardless of how little time sits in it.
const ZONE_BAR_OPACITY: Record<number, number> = { 1: 0.4, 2: 0.6, 3: 0.75, 4: 1 }

function defaultBounds(lthr: number): Bounds {
  return ZONE_PERCENTS.map((p) => Math.round(lthr * p)) as Bounds
}

interface Props {
  athlete: AthleteProfile
  onSave: (patch: Partial<AthleteProfile>) => void
  weeklyZoneTime: ZoneShare[]
}

export function ProfileHrZones({ athlete, onSave, weeklyZoneTime }: Props) {
  const s = t.profile.hrZones
  const lthr = athlete.lthrBpm ?? DEFAULT_LTHR
  const bounds = athlete.hrZoneBoundsBpm ?? defaultBounds(lthr)

  function setBound(index: number, n: number) {
    const next = [...bounds] as Bounds
    next[index] = n
    onSave({ hrZoneBoundsBpm: next })
  }

  const zones = [
    { zone: 1, min: 0, max: bounds[0], editableIndex: 0 },
    { zone: 2, min: bounds[0], max: bounds[1], editableIndex: 1 },
    { zone: 3, min: bounds[1], max: bounds[2], editableIndex: 2 },
    { zone: 4, min: bounds[2], max: bounds[3], editableIndex: 3 },
    { zone: 5, min: bounds[3], max: null, editableIndex: null },
  ]

  const timeByZone = new Map(weeklyZoneTime.map((z) => [z.zone, z]))
  const totalWeekSeconds = weeklyZoneTime.reduce((sum, z) => sum + z.seconds, 0)
  const maxZoneSeconds = Math.max(0, ...weeklyZoneTime.map((z) => z.seconds))

  const dominant = weeklyZoneTime.reduce<ZoneShare | null>(
    (best, z) => (best === null || z.seconds > best.seconds ? z : best),
    null
  )
  const insight =
    totalWeekSeconds === 0 || dominant === null
      ? null
      : dominant.percent >= 70 && (timeByZone.get(4)?.percent ?? 0) < 12
        ? s.insight.polarized(dominant.percent, t.activity.zones.labels[dominant.zone] ?? '')
        : s.insight.dominant(dominant.percent, t.activity.zones.labels[dominant.zone] ?? '')

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground">{s.title}</h2>
          <p className="mt-0.5 text-[11px] text-subtle">{s.thisWeek}</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <span>{s.lthr}</span>
          <EditableNumber value={lthr} onCommit={(n) => onSave({ lthrBpm: n })} className="text-xs font-bold text-accent-text" />
        </div>
      </div>

      <div className="flex flex-col gap-3.5">
        {zones.map(({ zone, min, max, editableIndex }) => {
          const time = timeByZone.get(zone)
          const barPercent = time && maxZoneSeconds > 0 ? Math.max(4, Math.round((time.seconds / maxZoneSeconds) * 100)) : 0
          const isDominant = dominant?.zone === zone

          return (
            <div key={zone}>
              <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                <span className="text-foreground/80">
                  <span className="text-muted-foreground">Z{zone}</span> {t.activity.zones.labels[zone]}
                  {' · '}
                  {zone === 1 && (
                    <>
                      &lt;
                      <EditableNumber value={max as number} onCommit={(n) => setBound(editableIndex as number, n)} />
                    </>
                  )}
                  {zone !== 1 && zone !== 5 && (
                    <>
                      {min}–
                      <EditableNumber value={max as number} onCommit={(n) => setBound(editableIndex as number, n)} />
                    </>
                  )}
                  {zone === 5 && <>&ge; {min}</>}
                </span>
                <span className={isDominant ? 'font-semibold text-foreground' : 'tabular-nums text-muted-foreground'}>
                  {time ? formatDurationWords(time.seconds) : `0 ${t.units.min}`}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-foreground/[0.06]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${barPercent}%`,
                    background: zone === 5 ? '#f5b700' : 'var(--accent)',
                    opacity: zone === 5 ? 1 : ZONE_BAR_OPACITY[zone],
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 border-t border-foreground/[0.06] pt-3.5 text-xs leading-snug text-muted-foreground">
        {insight ?? s.noSessionsThisWeek}
      </div>

      <button
        type="button"
        onClick={() => onSave({ hrZoneBoundsBpm: defaultBounds(lthr) })}
        className="mt-3 text-xs font-semibold text-accent-text active:opacity-60"
      >
        {s.recalculate} ›
      </button>
    </GlassSurface>
  )
}
