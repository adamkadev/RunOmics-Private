import { Trophy, Flame, Milestone as MilestoneIcon, Globe, Hash, Rocket } from 'lucide-react'
import type { MilestoneType } from '@/application/usecases/GetMilestones'

export const MILESTONE_ICON: Record<MilestoneType, typeof Trophy> = {
  'distance-tier': MilestoneIcon,
  streak: Flame,
  record: Trophy,
  'lifetime-distance': Globe,
  'activity-count': Hash,
  'first-activity': Rocket,
}

export const MILESTONE_ICON_CLASS: Record<MilestoneType, string> = {
  'distance-tier': 'text-blue-500 dark:text-blue-400',
  streak: 'text-orange-500 dark:text-orange-400',
  record: 'text-amber-500 dark:text-amber-400',
  'lifetime-distance': 'text-teal-500 dark:text-teal-400',
  'activity-count': 'text-violet-500 dark:text-violet-400',
  'first-activity': 'text-rose-500 dark:text-rose-400',
}

export const MILESTONE_NODE_CLASS: Record<MilestoneType, string> = {
  'distance-tier': 'border-blue-500/25 bg-blue-500/10',
  streak: 'border-orange-500/25 bg-orange-500/10',
  record: 'border-amber-500/25 bg-amber-500/10',
  'lifetime-distance': 'border-teal-500/25 bg-teal-500/10',
  'activity-count': 'border-violet-500/25 bg-violet-500/10',
  'first-activity': 'border-rose-500/25 bg-rose-500/10',
}
