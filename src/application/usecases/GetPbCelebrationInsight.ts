import { getTopEfforts, type RecordEntry } from './GetRecords'
import {
  PB_CELEBRATION_SURFACE,
  celebratedRecord,
  pbCelebrationInsightHash,
  type PbCelebrationContext,
} from '@/domain/ai/pbCelebrationInsight'
import { readVerifiedInsight } from '@/infrastructure/repositories/FirestoreInsightsRepository'
import type { Insight } from '@/lib/gemini'

export function buildPbCelebrationContext(record: RecordEntry): PbCelebrationContext {
  const previous = (getTopEfforts(undefined, 2)[record.key] ?? []).find(
    (effort) => effort.activityId !== record.activityId
  )

  return {
    record,
    previous: previous ? { seconds: previous.seconds, date: previous.date } : null,
  }
}

export async function getPbCelebrationInsight(
  record: RecordEntry | null,
  now = new Date()
): Promise<Insight | null> {
  const celebrated = celebratedRecord(record, now)
  if (!celebrated) return null
  return readVerifiedInsight(PB_CELEBRATION_SURFACE, pbCelebrationInsightHash(buildPbCelebrationContext(celebrated)))
}
