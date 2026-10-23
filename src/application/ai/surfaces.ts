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

/** `surface` is the document it is stored in, `hash` says whether the stored copy is current, `paths` are revalidated once it changes. */
export interface SurfaceJob {
  surface: string
  limits: Limits
  systemInstruction: string
  hash: string
  guard?: string
  prompt: (recentHeadlines: string[]) => string
  paths: string[]
}

/** A string is the reason a surface has nothing to write this pass, for the report. */
export type SurfacePlan = SurfaceJob | string

/** Lazy, so a read that throws ends the pass after the fresh verdicts are written, not before. */
function once<T>(read: () => T): () => T {
  let result: { value: T } | undefined
  return () => (result ??= { value: read() }).value
}

export function insightSurfaces() {
  const records = once(getRecords)
  const status = once(getTrainingStatus)

  return {
    /** Unreadable notes stay undefined, never empty: an empty note would read as the athlete having written nothing. */
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
