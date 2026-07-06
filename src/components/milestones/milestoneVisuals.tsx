import { Trophy, Flame, Milestone as MilestoneIcon } from 'lucide-react'
import type { MilestoneType } from '@/application/usecases/GetMilestones'

export const MILESTONE_ICON: Record<MilestoneType, typeof Trophy> = {
  'distance-tier': MilestoneIcon,
  streak: Flame,
  record: Trophy,
}

export const MILESTONE_ICON_CLASS: Record<MilestoneType, string> = {
  'distance-tier': 'text-blue-500 dark:text-blue-400',
  streak: 'text-orange-500 dark:text-orange-400',
  record: 'text-amber-500 dark:text-amber-400',
}
