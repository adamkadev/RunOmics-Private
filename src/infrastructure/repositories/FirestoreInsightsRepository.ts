import { getAdminFirestore } from '@/lib/firebase-admin'
import { activeLocale } from '@/i18n'
import type { Insight } from '@/lib/gemini'

const COLLECTION = 'aiInsights'
const HISTORY_SIZE = 5

const READ_TIMEOUT_MS = 2000

const STALE_GRACE_MS = 48 * 60 * 60 * 1000

export interface CachedInsight extends Insight {
  hash: string
  generatedAt: string
  recentHeadlines?: string[]
  guard?: string
}

export interface InsightKey {
  hash: string
  guard?: string
}

function docId(surface: string): string {
  return `${surface}_${activeLocale}`
}

function bySurface<D extends { id: string }, T>(docs: D[], prefix: string, read: (doc: D) => T): Map<string, T> {
  const suffix = `_${activeLocale}`
  return new Map(
    docs
      .filter((doc) => doc.id.startsWith(prefix) && doc.id.endsWith(suffix))
      .map((doc) => [doc.id.slice(0, -suffix.length), read(doc)])
  )
}

function servable(cached: CachedInsight, key: InsightKey, now: number): boolean {
  if (cached.hash === key.hash) return true

  if (key.guard !== undefined && cached.guard !== key.guard) return false

  const age = now - Date.parse(cached.generatedAt)
  return Number.isFinite(age) && age < STALE_GRACE_MS
}

export async function getCachedInsight(surface: string): Promise<CachedInsight | null> {
  const doc = await getAdminFirestore().collection(COLLECTION).doc(docId(surface)).get()
  return doc.exists ? (doc.data() as CachedInsight) : null
}

export function servableInsight(cached: CachedInsight | undefined, key: string | InsightKey, now = Date.now()): Insight | null {
  if (!cached) return null
  const wanted = typeof key === 'string' ? { hash: key } : key
  return servable(cached, wanted, now) ? { headline: cached.headline, body: cached.body, bullets: cached.bullets } : null
}

export async function readVerifiedInsight(surface: string, key: string | InsightKey): Promise<Insight | null> {
  if (!process.env.FIREBASE_PROJECT_ID) return null

  try {
    const cached = await Promise.race([
      getCachedInsight(surface),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), READ_TIMEOUT_MS)),
    ])
    return cached ? servableInsight(cached, key) : null
  } catch {
    return null
  }
}

export async function getCachedInsightsByPrefix(prefix: string): Promise<Map<string, CachedInsight>> {
  const snapshot = await getAdminFirestore().collection(COLLECTION).get()
  return bySurface(snapshot.docs, prefix, (doc) => doc.data() as CachedInsight)
}

export async function listCachedHashes(prefix: string): Promise<Map<string, string>> {
  const snapshot = await getAdminFirestore().collection(COLLECTION).select('hash').get()
  return bySurface(snapshot.docs, prefix, (doc) => doc.get('hash') as string)
}

export async function saveCachedInsight(
  surface: string,
  insight: Insight,
  hash: string,
  previous: CachedInsight | null,
  guard?: string
): Promise<void> {
  const recentHeadlines = [insight.headline, ...(previous?.recentHeadlines ?? [])].slice(0, HISTORY_SIZE)

  await getAdminFirestore()
    .collection(COLLECTION)
    .doc(docId(surface))
    .set({
      ...insight,
      hash,
      ...(guard !== undefined && { guard }),
      generatedAt: new Date().toISOString(),
      recentHeadlines,
    })
}
