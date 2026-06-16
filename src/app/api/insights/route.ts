import { NextResponse } from 'next/server'
import { InsightsService, type InsightsResult } from '@/infrastructure/llm/insights/InsightsService'
import { createProvider } from '@/infrastructure/llm/providers'
import type { InsightsInput } from '@/infrastructure/llm/insights/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6h
const MAX_BODY_BYTES = 16_384

// Module-level caches survive across requests within a single server process.
// `cache` serves identical snapshots; `inflight` deduplicates concurrent calls.
const cache = new Map<string, { result: InsightsResult; expires: number }>()
const inflight = new Map<string, Promise<InsightsResult>>()

const service = new InsightsService(createProvider())

function hashKey(input: unknown): string {
  const json = JSON.stringify(input)
  let h = 0x811c9dc5
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

function isInsightsInput(value: unknown): value is InsightsInput {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.volume === 'object' && typeof v.period === 'object'
}

export async function POST(request: Request) {
  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ insights: [] }, { status: 413 })
  }

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ insights: [] }, { status: 400 })
  }

  if (!isInsightsInput(body)) {
    return NextResponse.json({ insights: [] }, { status: 400 })
  }

  const key = hashKey(body)
  const now = Date.now()

  const cached = cache.get(key)
  if (cached && cached.expires > now) {
    return respond(cached.result, 'hit')
  }

  const pending = inflight.get(key)
  if (pending) {
    return respond(await pending, 'coalesced')
  }

  const promise = service.getInsights(body).finally(() => inflight.delete(key))
  inflight.set(key, promise)

  const result = await promise
  cache.set(key, { result, expires: now + CACHE_TTL_MS })

  return respond(result, 'miss')
}

function respond(result: InsightsResult, cacheStatus: string) {
  return NextResponse.json(result.output, {
    headers: {
      'x-insights-source': result.source,
      'x-insights-provider': result.provider ?? 'none',
      'x-insights-cache': cacheStatus,
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  })
}
