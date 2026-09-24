import { getTrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { getRunVerdictContexts } from '@/application/usecases/GetRunVerdictInsight'
import { getAnalyticsData } from '@/application/usecases/GetAnalyticsData'
import { getYearComparison } from '@/application/usecases/GetYearComparison'
import { getSeasonHeadline } from '@/application/usecases/GetSeasonHeadline'
import { getCurrentWeekPurpose } from '@/application/usecases/GetCurrentWeekPurpose'
import { getRecords, getMostRecentRecord, getQualifiedEffortsByActivityId } from '@/application/usecases/GetRecords'
import { getShoeStats } from '@/application/usecases/GetShoeStats'
import { getShoeDetail } from '@/application/usecases/GetShoeDetail'
import { getTrainingLoad } from '@/application/usecases/GetTrainingLoad'
import { getLoadRiskPanel } from '@/application/usecases/GetLoadRiskPanel'
import { getLoadBalance } from '@/application/usecases/GetLoadBalance'
import { getThresholdHistory } from '@/application/usecases/GetThresholdHistory'
import { getGarminRacePredictions } from '@/application/usecases/GetGarminRacePredictions'
import { getLatestVO2max } from '@/application/usecases/GetVO2maxHistory'
import { analyticsTabFacts } from '@/application/usecases/GetAnalyticsTabFacts'
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
  SEASON_LIMITS,
  SEASON_SURFACE,
  SEASON_SYSTEM_INSTRUCTION,
  seasonInsightGuard,
  seasonInsightHash,
  seasonInsightPrompt,
} from '@/domain/ai/seasonInsight'
import {
  WEEK_PURPOSE_LIMITS,
  WEEK_PURPOSE_SURFACE,
  WEEK_PURPOSE_SYSTEM_INSTRUCTION,
  weekPurposeInsightHash,
  weekPurposeInsightPrompt,
} from '@/domain/ai/weekPurposeInsight'
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
import {
  ANALYTICS_TAB_IDS,
  ANALYTICS_TAB_LIMITS,
  analyticsTabInsightHash,
  analyticsTabInsightPrompt,
  analyticsTabSurface,
  analyticsTabSystemInstruction,
} from '@/domain/ai/analyticsTabInsight'

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
  bulletCount?: number
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
 * One instance per pass: training status, analytics and records are each
 * computed once here, where the surfaces used to compute them twice.
 */
export function insightSurfaces() {
  const records = once(getRecords)
  const status = once(getTrainingStatus)
  const analytics = once(getAnalyticsData)

  return {
    async runVerdicts(): Promise<{ contexts: RunVerdictContext[]; recordActivityIds: ReadonlySet<string> }> {
      return {
        contexts: getRunVerdictContexts(),
        recordActivityIds: new Set(Object.keys(getQualifiedEffortsByActivityId(await records()))),
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

    async weekPurpose(): Promise<SurfacePlan> {
      const week = await getCurrentWeekPurpose()
      if (!week) return 'no week data'

      return {
        surface: WEEK_PURPOSE_SURFACE,
        limits: WEEK_PURPOSE_LIMITS,
        systemInstruction: WEEK_PURPOSE_SYSTEM_INSTRUCTION,
        hash: weekPurposeInsightHash(week),
        prompt: (recent) => weekPurposeInsightPrompt(week, recent),
        paths: ['/plan'],
      }
    },

    async season(): Promise<SurfacePlan> {
      const data = getSeasonHeadline(await analytics(), getYearComparison())
      if (!data) return 'no season reads'

      return {
        surface: SEASON_SURFACE,
        limits: SEASON_LIMITS,
        systemInstruction: SEASON_SYSTEM_INSTRUCTION,
        hash: seasonInsightHash(data),
        guard: seasonInsightGuard(data),
        prompt: (recent) => seasonInsightPrompt(data, recent),
        bulletCount: data.bullets.length,
        paths: ['/analytics'],
      }
    },

    async analyticsTabs(): Promise<Record<string, SurfacePlan>> {
      const facts = analyticsTabFacts({
        data: await analytics(),
        status: await status(),
        load: await getTrainingLoad(),
        loadRisk: await getLoadRiskPanel(),
        loadBalance: getLoadBalance(),
        threshold: getThresholdHistory(),
        racePredictions: getGarminRacePredictions(),
        vo2max: getLatestVO2max(),
      })

      const plans: Record<string, SurfacePlan> = {}
      for (const tab of ANALYTICS_TAB_IDS) {
        const lines = facts[tab]
        plans[tab] = lines.length
          ? {
              surface: analyticsTabSurface(tab),
              limits: ANALYTICS_TAB_LIMITS,
              systemInstruction: analyticsTabSystemInstruction(tab),
              hash: analyticsTabInsightHash(tab, lines),
              prompt: (recent) => analyticsTabInsightPrompt(lines, recent),
              paths: ['/analytics'],
            }
          : 'no reads'
      }
      return plans
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
