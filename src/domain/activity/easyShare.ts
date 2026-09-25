import type { HrZone } from './types'
import { easyHardShare } from '@/domain/training/easyHard'

/**
 * "Easy %" had two meanings under one label: /activities read heart-rate zone
 * time, /plan the share of session time in easy sessions, so the same
 * finished week could read 62 % easy on one screen and 80 % on the other.
 * Neither is wrong - they answer different questions - so each gets a name,
 * and the screens say which one they show.
 */

/**
 * The easy share the week is read against. The coaching rules treat 80 % easy
 * as a conservative ceiling on hard volume rather than a law (see the
 * coaching-plan methodology), so screens call it a guide, not a target.
 */
export const EASY_SHARE_GUIDE = 80

/** An easy/hard split in whole percent that adds up to 100. */
export interface EasyHardSplit {
  easy: number
  hard: number
}

/**
 * What the runs were: time in heart-rate zones 1-2 against the rest. Every
 * recorded week is read this way, on the activity list and on the plan alike.
 * Null when the runs carry no zone data.
 */
export function recordedEasyHard(activities: ReadonlyArray<{ hrZones: HrZone[] }>): EasyHardSplit | null {
  const { hardPct } = easyHardShare(activities)
  if (hardPct === null) return null
  const hard = Math.round(hardPct)
  return { easy: 100 - hard, hard }
}

/**
 * What a week is planned to be: the share of its session time spent in easy
 * sessions, the only measure a session nobody has run yet can have. Weighted
 * by duration, so one long run does not count the same as one set of strides.
 */
export function plannedEasyHard(sessions: ReadonlyArray<{ key: boolean; seconds: number }>): EasyHardSplit | null {
  const total = sessions.reduce((sum, s) => sum + s.seconds, 0)
  if (total <= 0) return null
  const keySeconds = sessions.filter((s) => s.key).reduce((sum, s) => sum + s.seconds, 0)
  const hard = Math.round((keySeconds / total) * 100)
  return { easy: 100 - hard, hard }
}
