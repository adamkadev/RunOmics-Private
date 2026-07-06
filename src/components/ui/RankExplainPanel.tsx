import { RankLadder } from '@/components/ui/RankLadder'
import type { RankTier } from '@/domain/athlete/rank'
import { t } from '@/i18n'

export function RankExplainPanel({
  tier,
  prefix = 'Grade',
  description,
  detail,
}: {
  tier: RankTier
  prefix?: string
  description: string
  detail?: string
}) {
  return (
    <div className="mt-3 rounded-xl bg-foreground/[0.05] p-3">
      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">
          {prefix} {tier}
        </span>{' '}
        - {t.rankTierLabels[tier]} - {description}
        {detail && <> {detail}</>}
      </p>
      <div className="mt-3">
        <RankLadder current={tier} />
      </div>
    </div>
  )
}
