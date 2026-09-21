import type { MilestoneType } from '@/application/usecases/GetMilestones'
import { STATUS } from '@/lib/statusColors'

/**
 * One mark, for the one type worth scanning a year for. Six colours keyed to
 * six types read as a legend, but each row's label already says which type it
 * is - so they were decoration pretending to carry information.
 *
 * The mark is the gold Records paints 1st place in, not the accent: "this one
 * is a record" is a meaning, and a meaning cannot be a colour the user picks in
 * Settings. Taking it from STATUS keeps the two screens identical by
 * construction rather than by coincidence.
 */
export function milestoneDotClass(type: MilestoneType): string | null {
  return type === 'record' ? STATUS.gold.dot : null
}
