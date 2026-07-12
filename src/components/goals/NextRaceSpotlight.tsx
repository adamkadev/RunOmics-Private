import type { NextRaceSpotlight as NextRaceSpotlightData } from '@/application/usecases/GetGoalsData'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { formatDate, formatDuration } from '@/lib/formatters'
import { STATUS } from '@/lib/statusColors'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { shortDist } from './YearView'

function gapDisplay(gapSeconds: number | null): { label: string; className: string } {
  if (gapSeconds === null) return { label: '-', className: 'text-subtle' }
  if (gapSeconds <= 0) return { label: `-${formatDuration(Math.abs(gapSeconds))}`, className: STATUS.success.text }
  return { label: `+${formatDuration(gapSeconds)}`, className: STATUS.warning.text }
}

export function NextRaceSpotlight({ spotlight }: { spotlight: NextRaceSpotlightData }) {
  const { race, daysUntil, predictedSeconds, gapSeconds } = spotlight
  const s = t.goals.nextRace
  const gap = gapDisplay(gapSeconds)

  return (
    <GlassSurface
      variant="card"
      className="rounded-2xl p-5"
      style={{
        background: 'linear-gradient(150deg, rgba(249,115,22,0.16), rgba(249,115,22,0.02))',
        borderColor: 'rgba(249,115,22,0.32)',
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#f7a05a' }}>
          {s.title}
        </span>
        <span className="shrink-0 text-xs font-bold tabular-nums" style={{ color: '#f97316' }}>
          {t.nextRace.countdown(daysUntil)}
        </span>
      </div>

      <p className="text-center text-[17px] font-bold text-foreground">
        {race.name} • {shortDist(race.distance)}
      </p>
      <p className="mt-0.5 text-center text-[10.5px] text-muted-foreground">
        {formatDate(race.date)}
        {race.location && ` · ${race.location}`}
      </p>

      {(race.targetSeconds || predictedSeconds !== null) && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(0,0,0,0.25)' }}>
            <div className="text-[10px] uppercase tracking-wide text-subtle">{s.target}</div>
            <div className="mt-0.5 text-sm font-bold text-foreground">
              {race.targetSeconds ? formatDuration(race.targetSeconds) : '-'}
            </div>
          </div>
          <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(0,0,0,0.25)' }}>
            <div className="text-[10px] uppercase tracking-wide text-subtle">{s.predicted}</div>
            <div className="mt-0.5 text-sm font-bold" style={{ color: '#f5b700' }}>
              {predictedSeconds !== null ? formatDuration(predictedSeconds) : '-'}
            </div>
          </div>
          <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(0,0,0,0.25)' }}>
            <div className="text-[10px] uppercase tracking-wide text-subtle">{s.gap}</div>
            <div className={cn('mt-0.5 text-sm font-bold', gap.className)}>{gap.label}</div>
          </div>
        </div>
      )}
    </GlassSurface>
  )
}
