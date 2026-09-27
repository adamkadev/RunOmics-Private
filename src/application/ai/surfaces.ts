import { getTrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { getRunVerdictContexts } from '@/application/usecases/GetRunVerdictInsight'
import { getRecords, getMostRecentRecord, getQualifiedEffortsByActivityId } from '@/application/usecases/GetRecords'
import { getShoeStats } from '@/application/usecases/GetShoeStats'
import { getActivityNotes } from '@/infrastructure/repositories/FirestoreActivityNoteRepository'
import { getShoeDetail } from '@/application/usecases/GetShoeDetail'
import { buildTodayContext, todayInsightSession } from '@/application/usecases/GetTodayInsight'
import { buildPbCelebrationContext } from '@/application/usecases/GetPbCelebrationInsight'
import { wearOutlook } from '@/domain/shoe/wearStatus'
import type { Limits } from '@/domain/ai/prompt'
import type { RunVerdictContext } from '@/domain/ai/runVerdictInsight'
import {
  TODAY_LIMITS,
  TODAY_SURFACE,
  TODAY_SYSTEM_INSTRUCTION,
  todayInsightGuard,
  todayInsightHash,
  todayInsightPrompt,
} from '@/domain/ai/todayInsight'
import {
  PB_CELEBRATION_LIMITS,
  PB_CELEBRATION_SURFACE,
  PB_CELEBRATION_SYSTEM_INSTRUCTION,
  celebratedRecord,
  pbCelebrationInsightHash,
  pbCelebrationInsightPrompt,
} from '@/domain/ai/pbCelebrationInsight'
import {
  SHOE_VERDICT_LIMITS,
  SHOE_VERDICT_SYSTEM_INSTRUCTION,
  shoeVerdictInsightGuard,
  shoeVerdictInsightHash,
  shoeVerdictInsightPrompt,
  shoeVerdictSurface,
  type ShoeVerdictContext,
} from '@/domain/ai/shoeVerdictInsight'

/**
 * One card the insight pass may write: the document it lives in, what the
 * model is asked, the hash that says the stored copy is still current, and the
 * pages to revalidate once it changes.
 */
export interface SurfaceJob {
  surface: string
  limits: Limits
  systemInstruction: string
  hash: string
  guard?: string
  prompt: (recentHeadlines: string[]) => string
  paths: string[]
}

/** A surface with nothing to write about this pass says why, and the reason goes into the report. */
export type SurfacePlan = SurfaceJob | string

/**
 * A read several surfaces share, made the first time one of them asks. Lazy
 * rather than up front, so a data file that makes one of these throw still
 * ends the pass where it always did - after the fresh verdicts - instead of
 * before anything is written.
 */
function once<T>(read: () => T): () => T {
  let result: { value: T } | undefined
  return () => (result ??= { value: read() }).value
}

/**
 * Everything the insight pass writes about, built from the app's own data.
 * One instance per pass: training status and records are each computed once
 * here, where the surfaces used to compute them twice. Only cards a page
 * displays: the season headline and the four Analytics tab cards went when
 * v4.6 replaced them with the rule-based coach read, and stopped being
 * written in v4.16.4.
 */
export function insightSurfaces() {
  const records = once(getRecords)
  const status = once(getTrainingStatus)

  return {
    /**
     * Every run's context, with the athlete's note where there is one. A pass
     * that cannot read the notes leaves them undefined - never an empty note,
     * which would read as the athlete having written nothing (v4.16.5).
     */
    async runVerdicts(): Promise<{ contexts: RunVerdictContext[]; recordActivityIds: ReadonlySet<string> }> {
      const [notes, recordEfforts] = await Promise.all([getActivityNotes(), records()])
      return {
        contexts: getRunVerdictContexts().map((context) => ({
          ...context,
          note: notes.available ? (notes.notes.get(context.activity.id) ?? null) : undefined,
        })),
        recordActivityIds: new Set(Object.keys(getQualifiedEffortsByActivityId(recordEfforts))),
      }
    },

    async today(): Promise<SurfacePlan> {
      const current = await status()
      if (!current) return 'no training status'

      const context = buildTodayContext(current, await todayInsightSession())

      return {
        surface: TODAY_SURFACE,
        limits: TODAY_LIMITS,
        systemInstruction: TODAY_SYSTEM_INSTRUCTION,
        hash: todayInsightHash(context),
        guard: todayInsightGuard(context),
        prompt: (recent) => todayInsightPrompt(context, recent),
        paths: ['/'],
      }
    },

    async pbCelebration(now: Date): Promise<SurfacePlan> {
      const record = celebratedRecord(getMostRecentRecord(await records()), now)
      if (!record) return 'no fresh record'

      const context = buildPbCelebrationContext(record)

      return {
        surface: PB_CELEBRATION_SURFACE,
        limits: PB_CELEBRATION_LIMITS,
        systemInstruction: PB_CELEBRATION_SYSTEM_INSTRUCTION,
        hash: pbCelebrationInsightHash(context),
        prompt: (recent) => pbCelebrationInsightPrompt(context, recent),
        paths: ['/'],
      }
    },

    /** Only the pairs worn far enough to deserve a verdict appear at all. */
    shoeVerdicts(): Record<string, SurfaceJob> {
      const jobs: Record<string, SurfaceJob> = {}

      for (const stats of getShoeStats()) {
        if (stats.retired) continue
        const shoe = getShoeDetail(stats.gearId)
        if (!shoe) continue

        const outlook = wearOutlook(shoe)
        if (outlook.status === 'ok') continue

        const context: ShoeVerdictContext = { shoe, ...outlook, status: outlook.status }
        jobs[shoe.gearId] = {
          surface: shoeVerdictSurface(shoe.gearId),
          limits: SHOE_VERDICT_LIMITS,
          systemInstruction: SHOE_VERDICT_SYSTEM_INSTRUCTION,
          hash: shoeVerdictInsightHash(context),
          guard: shoeVerdictInsightGuard(context),
          prompt: (recent) => shoeVerdictInsightPrompt(context, recent),
          paths: [`/shoes/${shoe.gearId}`],
        }
      }

      return jobs
    },
  }
}

export type InsightSurfaces = ReturnType<typeof insightSurfaces>
