import { SectionDivider } from '@/components/ui/SectionLabel'
import type { YearOutcome } from '@/application/usecases/GetGoalsData'
import { cardClass } from '@/components/ui/Card'
import { formatKm } from '@/lib/formatters'
import { t } from '@/i18n'
import { OutcomePill } from './OutcomePill'

export function GoalsHistory({ history }: { history: YearOutcome[] }) {
  if (history.length === 0) return null
  const h = t.goals.history

  return (
    <section className="flex flex-col gap-2.5 pt-2" data-testid="goals-history">
      <SectionDivider as="h2" className="px-1">
        {h.title}
      </SectionDivider>
      {history.map((outcome) => {
        const targetsWithResult = outcome.targets.filter((target) => target.achieved !== null)
        const targetsAchieved = targetsWithResult.filter((target) => target.achieved).length
        const summary = [
          outcome.annualGoal ? h.annualKm(formatKm(outcome.annualGoal.actualKm), formatKm(outcome.annualGoal.targetKm)) : null,
          targetsWithResult.length > 0 ? h.targetsCount(targetsAchieved, targetsWithResult.length) : null,
        ].filter((part): part is string => part !== null)

        return (
          <div key={outcome.year} className={cardClass({ className: 'flex items-center gap-3 py-3' })} data-testid="goals-history-year">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-semibold text-foreground">{outcome.year}</span>
              {summary.length > 0 && <span className="text-xs text-muted-foreground">{summary.join(' · ')}</span>}
            </span>
            {outcome.annualGoal && (
              <OutcomePill tone={outcome.annualGoal.achieved ? 'pos' : 'neg'}>
                {outcome.annualGoal.achieved ? h.achieved : h.missed}
              </OutcomePill>
            )}
          </div>
        )
      })}
    </section>
  )
}
