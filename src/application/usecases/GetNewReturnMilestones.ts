import { getLastReturnMilestoneState, saveLastReturnMilestoneState } from '@/infrastructure/repositories/FirestoreConfigRepository'
import type { ReturnMilestone } from '@/domain/training/returnProgress'
import { isRecentRecord } from '@/domain/ai/celebrationWindow'
import { appTodayIso } from '@/lib/calendarDate'
import { getReturnProgress, type ReturnProgress } from './GetReturnProgress'

const keyOf = (progress: ReturnProgress, milestone: ReturnMilestone) => `${progress.breakEnd}:${milestone.key}`

/**
 * Only a milestone inside the celebration window is announced: the first night after a deploy or a reprocess
 * would otherwise push the whole return at once. As getNewPrs, nothing is stored until `commit()`.
 */
export async function getNewReturnMilestones(
  today: string = appTodayIso(),
  progress: ReturnProgress | null = getReturnProgress(today),
): Promise<{ newMilestones: ReturnMilestone[]; commit: () => Promise<void> }> {
  if (!progress) return { newMilestones: [], commit: async () => {} }
  const announced = new Set((await getLastReturnMilestoneState())?.announced ?? [])
  const now = new Date(`${today}T12:00:00`)
  const newMilestones = progress.milestones.filter(
    (milestone) => !announced.has(keyOf(progress, milestone)) && isRecentRecord(milestone.date, now),
  )
  const next = [...new Set([...announced, ...progress.milestones.map((milestone) => keyOf(progress, milestone))])].sort()
  return { newMilestones, commit: () => saveLastReturnMilestoneState({ announced: next }) }
}
