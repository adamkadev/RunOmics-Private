import type { RecordEntry } from './GetRecords'
import {
  PB_CELEBRATION_SURFACE,
  celebratedRecord,
  pbCelebrationInsightHash,
} from '@/domain/ai/pbCelebrationInsight'
import { readVerifiedInsight } from '@/infrastructure/repositories/FirestoreInsightsRepository'
import type { Insight } from '@/lib/gemini'

/** The AI word on a fresh record, or null so the overlay shows the record alone. */
export async function getPbCelebrationInsight(
  record: RecordEntry | null,
  now = new Date()
): Promise<Insight | null> {
  const celebrated = celebratedRecord(record, now)
  if (!celebrated) return null
  return readVerifiedInsight(PB_CELEBRATION_SURFACE, pbCelebrationInsightHash(celebrated))
}
