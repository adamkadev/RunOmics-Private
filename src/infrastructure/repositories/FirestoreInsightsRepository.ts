import { FieldPath } from 'firebase-admin/firestore'
import { getAdminFirestore } from '@/lib/firebase-admin'
import { activeLocale } from '@/i18n'
import type { Insight } from '@/lib/gemini'

const COLLECTION = 'aiInsights'
const HISTORY_SIZE = 5

const READ_TIMEOUT_MS = 2000

const STALE_GRACE_MS = 48 * 60 * 60 * 1000

const ID_RANGE_END = '\uf8ff'

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

/**
 * The whole stored document, not just the three fields a card renders - callers
 * that need to know *when* a surface was last written (and not only what it
 * says) would otherwise have to read it a second time.
 */
export async function readVerifiedCachedInsight(
  surface: string,
  key: string | InsightKey
): Promise<CachedInsight | null> {
  if (!process.env.FIREBASE_PROJECT_ID) return null

  try {
    const cached = await Promise.race([
      getCachedInsight(surface),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), READ_TIMEOUT_MS)),
    ])
    if (!cached) return null
    const wanted = typeof key === 'string' ? { hash: key } : key
    return servable(cached, wanted, Date.now()) ? cached : null
  } catch {
    return null
  }
}

export async function readVerifiedInsight(surface: string, key: string | InsightKey): Promise<Insight | null> {
  const cached = await readVerifiedCachedInsight(surface, key)
  return cached ? { headline: cached.headline, body: cached.body, bullets: cached.bullets } : null
}

function surfaceRange(prefix: string) {
  return getAdminFirestore()
    .collection(COLLECTION)
    .orderBy(FieldPath.documentId())
    .startAt(prefix)
    .endAt(`${prefix}${ID_RANGE_END}`)
}

export async function listCachedHashes(prefix: string): Promise<Map<string, string>> {
  const snapshot = await surfaceRange(prefix).select('hash').get()
  return bySurface(snapshot.docs, prefix, (doc) => doc.get('hash') as string)
}

const PHRASING_SURFACE = 'verdictPhrasing'
const PHRASING_SIZE = 10

export interface VerdictPhrasing {
  headline: string
  body: string
}

function isPhrasing(value: unknown): value is VerdictPhrasing {
  const entry = value as Partial<VerdictPhrasing> | null
  return !!entry && typeof entry.headline === 'string' && typeof entry.body === 'string'
}

export async function readVerdictPhrasing(): Promise<VerdictPhrasing[]> {
  if (!process.env.FIREBASE_PROJECT_ID) return []

  try {
    const doc = await Promise.race([
      getAdminFirestore().collection(COLLECTION).doc(docId(PHRASING_SURFACE)).get(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), READ_TIMEOUT_MS)),
    ])
    const recent = doc?.exists ? (doc.data() as { recent?: unknown }).recent : undefined
    return Array.isArray(recent) ? recent.filter(isPhrasing) : []
  } catch {
    return []
  }
}

export async function saveVerdictPhrasing(recent: VerdictPhrasing[]): Promise<void> {
  await getAdminFirestore()
    .collection(COLLECTION)
    .doc(docId(PHRASING_SURFACE))
    .set({ recent: recent.slice(0, PHRASING_SIZE), updatedAt: new Date().toISOString() })
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
