import { Flag, Flame, Footprints, Globe, Hash, Trophy, type LucideIcon } from 'lucide-react'
import type { MilestoneType } from '@/application/usecases/GetMilestones'

export interface MilestoneIcon {
  Icon: LucideIcon
  className: string
}

const NEUTRAL = 'bg-[var(--track)] text-muted-foreground'

/** A record takes the warm amber, a meaning no accent picked in Settings may take over. */
export function milestoneIcon(type: MilestoneType): MilestoneIcon {
  switch (type) {
    case 'distance-tier':
      return { Icon: Flag, className: 'bg-[var(--accent-soft)] text-accent-text' }
    case 'record':
      return { Icon: Trophy, className: 'bg-[color-mix(in_srgb,var(--warn)_18%,transparent)] text-[var(--warn)]' }
    case 'activity-count':
      return { Icon: Hash, className: NEUTRAL }
    case 'lifetime-distance':
      return { Icon: Globe, className: NEUTRAL }
    case 'streak':
      return { Icon: Flame, className: NEUTRAL }
    case 'first-activity':
      return { Icon: Footprints, className: NEUTRAL }
  }
}
