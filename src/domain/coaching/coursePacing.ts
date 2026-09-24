import type { TargetEvent } from './types'

export function hasCoursePacing(event: Pick<TargetEvent, 'courseContext'>): boolean {
  return Boolean(event.courseContext?.pacingNotes.length || event.courseContext?.paceProSplits?.length)
}
