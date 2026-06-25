import { History, CheckCircle2, XCircle } from 'lucide-react'
import type { YearOutcome } from '@/application/usecases/GetGoalsData'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { STATUS } from '@/lib/statusColors'
import { t } from '@/i18n'

function OutcomeBadge({ achieved }: { achieved: boolean }) {
  return (
    <span
      className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        achieved
          ? STATUS.success.badge
          : STATUS.danger.badge
      }`}
    >
      {achieved ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      {achieved ? t.goals.history.achieved : t.goals.history.missed}
    </span>
  )
}

export function GoalsHistory({ history }: { history: YearOutcome[] }) {
  if (history.length === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <History size={16} className="text-subtle" />
        {t.goals.history.title}
      </h2>
      <div className="space-y-2">
        {history.map((outcome) => {
          const targetsWithResult = outcome.targets.filter((target) => target.achieved !== null)
          const targetsAchieved = targetsWithResult.filter((target) => target.achieved).length

          return (
            <GlassSurface
              key={outcome.year}
              variant="card"
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl p-4"
            >
              <span className="font-semibold text-foreground">{outcome.year}</span>
              <div className="flex flex-wrap items-center gap-2">
                {outcome.annualGoal && (
                  <>
                    <span className="text-xs text-subtle">
                      {t.goals.history.annualKm(
                        Math.round(outcome.annualGoal.actualKm),
                        Math.round(outcome.annualGoal.targetKm)
                      )}
                    </span>
                    <OutcomeBadge achieved={outcome.annualGoal.achieved} />
                  </>
                )}
                {targetsWithResult.length > 0 && (
                  <span className="text-xs text-subtle">
                    {t.goals.history.targetsCount(targetsAchieved, targetsWithResult.length)}
                  </span>
                )}
              </div>
            </GlassSurface>
          )
        })}
      </div>
    </section>
  )
}
