import type { Vo2GradeView } from '@/application/usecases/GetVo2Grade'
import { BackButton } from '@/components/ui/BackButton'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import { formatDate, formatKm } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { GradeBandLabel, Vo2GradeCard } from './Vo2GradeCard'

type Graded = Extract<Vo2GradeView, { status: 'graded' }>

const one = (n: number) => formatKm(n, 1)

function rangeText(min: number | null, max: number | null): string {
  const g = t.vo2Grade
  if (min === null) return g.below(one(max!))
  if (max === null) return g.andAbove(one(min))
  return g.range(one(min), one(Math.round((max - 0.1) * 10) / 10))
}

export function Vo2GradeDetail({ view }: { view: Vo2GradeView }) {
  const g = t.vo2Grade

  return (
    <div className="space-y-3">
      <div>
        <BackButton label={g.back} fallbackHref="/athlete" />
        <h1 className="text-display text-foreground">{g.title}</h1>
        {view.status === 'graded' && (
          <p className="mt-1 text-footnote text-muted-foreground">
            <GradeBandLabel band={view.band} /> · {g.source}
          </p>
        )}
      </div>

      {view.status === 'calibrating' ? <Vo2GradeCard view={view} /> : <Ladder view={view} />}
    </div>
  )
}

function Ladder({ view }: { view: Graded }) {
  const g = t.vo2Grade
  return (
    <>
      <GlassSurface variant="card" className="overflow-hidden rounded-card-sm" data-testid="grade-ladder">
        <ul>
          {view.ladder.map((band, i) => {
            const you = band.grade === view.grade
            return (
              <li
                key={band.grade}
                aria-current={you || undefined}
                data-testid={`grade-row-${band.grade}`}
                className={cn('grid items-center gap-3 px-4 py-3', i > 0 && 'border-t border-border', you && 'bg-muted')}
                style={{ gridTemplateColumns: '2.75rem minmax(0,1fr) auto' }}
              >
                <span className="font-display text-title3 font-bold text-foreground">{band.grade}</span>
                <span className="text-subhead text-foreground">
                  {rangeText(band.min, band.max)}
                  {you && <span className="text-muted-foreground"> · {g.you(one(view.value))}</span>}
                </span>
                <span className="text-footnote tabular-nums text-muted-foreground">
                  {band.topPercent !== null ? g.topPct(band.topPercent) : ''}
                </span>
              </li>
            )
          })}
        </ul>
      </GlassSurface>

      <GlassSurface variant="card" className="rounded-card-sm px-4 py-3.5" data-testid="grade-season">
        <p className={cn(EYEBROW_CLASS, 'text-muted-foreground')}>{g.season}</p>
        {/* Past six months the letters step down a size to keep "A−" on one line. */}
        <div className={cn('mt-2.5 grid', view.season.length > 6 ? 'gap-1' : 'gap-2')} style={{ gridTemplateColumns: `repeat(${view.season.length}, minmax(0, 1fr))` }}>
          {view.season.map(({ month, grade }) => (
            <div key={month} className="flex min-w-0 flex-col items-center gap-0.5" data-testid="season-month">
              <span className={cn('whitespace-nowrap font-display font-bold text-foreground', view.season.length > 6 ? 'text-[15px] leading-6' : 'text-title3')}>{grade ?? '—'}</span>
              <span className="text-caption text-muted-foreground">{formatDate(`${month}-01`, { precision: 'month', year: 'never' })}</span>
            </div>
          ))}
        </div>
      </GlassSurface>

      {!view.next && (
        <GlassSurface variant="card" className="rounded-card-sm px-4 py-3.5" data-testid="grade-coach">
          <p className={cn(EYEBROW_CLASS, 'text-muted-foreground')}>{g.coach}</p>
          <p className="mt-1.5 text-subhead leading-snug text-foreground">{g.coachTop}</p>
        </GlassSurface>
      )}
    </>
  )
}
